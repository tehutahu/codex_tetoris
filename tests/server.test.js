const assert = require('node:assert/strict');
const { after, before, describe, test } = require('node:test');
const { request } = require('node:http');
const { mkdtemp, mkdir, rm, symlink, writeFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { createGameServer } = require('../server');

function get(server, url, method = 'GET') {
  return new Promise((resolve, reject) => {
    const outgoing = request({
      hostname: '127.0.0.1',
      port: server.address().port,
      path: url,
      method,
    }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('error', reject);
      response.on('end', () => resolve({
        status: response.statusCode,
        headers: response.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      }));
    });
    outgoing.on('error', reject);
    outgoing.end();
  });
}

describe('production static server', () => {
  let fixture;
  let server;
  const html = '<!doctype html><html lang="ja"><title>ひとりスプリント</title></html>';
  const javascript = 'console.log("local game");';

  before(async () => {
    fixture = await mkdtemp(path.join(tmpdir(), 'codex-tetoris-static-'));
    const directory = path.join(fixture, 'dist');
    await mkdir(path.join(directory, 'assets'), { recursive: true });
    await mkdir(path.join(fixture, 'outside'));
    await Promise.all([
      writeFile(path.join(directory, 'index.html'), html),
      writeFile(path.join(directory, 'assets', 'game.js'), javascript),
      writeFile(path.join(directory, 'assets', 'game.css'), 'body { color: white; }'),
      writeFile(path.join(directory, 'assets', 'game icon.svg'), '<svg></svg>'),
      writeFile(path.join(directory, 'assets', 'data.bin'), 'binary data'),
      writeFile(path.join(directory, '.env'), 'private contents'),
      writeFile(path.join(fixture, 'outside', 'secret.txt'), 'outside secret'),
    ]);
    await symlink(path.join(fixture, 'outside'), path.join(directory, 'external'), 'junction');
    ({ server } = createGameServer({ staticDirectory: directory }));
    assert.equal(server.listening, false, 'factory must not open a port when imported');
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  });

  after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    if (fixture) await rm(fixture, { recursive: true, force: true });
  });

  test('serves the actual configured index at / and /index.html', async () => {
    for (const url of ['/', '/index.html', '/?seed=42']) {
      const response = await get(server, url);
      assert.equal(response.status, 200);
      assert.equal(response.body, html);
      assert.equal(response.headers['content-type'], 'text/html; charset=utf-8');
      assert.equal(Number(response.headers['content-length']), Buffer.byteLength(html));
      assert.equal(response.headers['x-content-type-options'], 'nosniff');
    }
  });

  test('serves JS/CSS and an encoded asset name with browser-compatible MIME types', async () => {
    const js = await get(server, '/assets/game.js?v=1');
    assert.equal(js.status, 200);
    assert.equal(js.body, javascript);
    assert.equal(js.headers['content-type'], 'application/javascript; charset=utf-8');
    const css = await get(server, '/assets/game.css');
    assert.equal(css.status, 200);
    assert.equal(css.headers['content-type'], 'text/css; charset=utf-8');
    const svg = await get(server, '/assets/game%20icon.svg');
    assert.equal(svg.status, 200);
    assert.equal(svg.headers['content-type'], 'image/svg+xml');
    const binary = await get(server, '/assets/data.bin');
    assert.equal(binary.status, 200);
    assert.equal(binary.headers['content-type'], 'application/octet-stream');
  });

  test('HEAD has the GET headers without an HTML body', async () => {
    const response = await get(server, '/', 'HEAD');
    assert.equal(response.status, 200);
    assert.equal(response.body, '');
    assert.equal(Number(response.headers['content-length']), Buffer.byteLength(html));
    assert.equal(response.headers['content-type'], 'text/html; charset=utf-8');
  });

  test('missing assets, directories, routes and the removed Socket.IO endpoint return 404', async () => {
    for (const url of ['/assets/missing.js', '/assets/', '/unknown-route', '/socket.io/?EIO=4&transport=polling']) {
      const response = await get(server, url);
      assert.equal(response.status, 404, url);
      assert.equal(response.body, 'Not found\n');
      assert.doesNotMatch(response.body, /outside secret|doctype/);
    }
  });

  test('HEAD errors also omit the response body', async () => {
    const response = await get(server, '/missing', 'HEAD');
    assert.equal(response.status, 404);
    assert.equal(response.body, '');
    assert.equal(Number(response.headers['content-length']), Buffer.byteLength('Not found\n'));
  });

  test('rejects methods that cannot retrieve static files', async () => {
    const response = await get(server, '/', 'POST');
    assert.equal(response.status, 405);
    assert.equal(response.headers.allow, 'GET, HEAD');
  });

  test('rejects raw and encoded traversal, Windows separators and alternate data streams', async () => {
    for (const url of [
      '/../outside/secret.txt',
      '/%2e%2e/outside/secret.txt',
      '/assets/%2e%2e/%2e%2e/outside/secret.txt',
      '/..%5coutside%5csecret.txt',
      '/index.html%3a%3a$DATA',
      '/.env',
    ]) {
      const response = await get(server, url);
      assert.equal(response.status, 403, url);
      assert.equal(response.body, 'Forbidden\n');
    }
  });

  test('rejects files reached through a junction outside the static directory', async () => {
    const response = await get(server, '/external/secret.txt');
    assert.equal(response.status, 403);
    assert.equal(response.body, 'Forbidden\n');
  });

  test('rejects malformed encoding and decoded null bytes without crashing subsequent requests', async () => {
    for (const url of ['/%zz', '/%E0%A4%A', '/assets/game%00.js']) {
      const response = await get(server, url);
      assert.equal(response.status, 400, url);
    }
    assert.equal((await get(server, '/')).status, 200);
  });
});

test('an absent build directory returns 404 through the production factory', async t => {
  const fixture = await mkdtemp(path.join(tmpdir(), 'codex-tetoris-unbuilt-'));
  const { server } = createGameServer({ staticDirectory: path.join(fixture, 'missing-dist') });
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await rm(fixture, { recursive: true, force: true });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  assert.equal((await get(server, '/')).status, 404);
});
