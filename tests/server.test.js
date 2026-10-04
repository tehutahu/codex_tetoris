const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { mkdtemp, writeFile, rm } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');
const clientRequire = createRequire(path.join(__dirname, '..', 'client', 'package.json'));
const { io: connect } = clientRequire('socket.io-client');
const { createGameServer } = require('../server');

async function startServer(t) {
  const staticDirectory = await mkdtemp(path.join(os.tmpdir(), 'codex-tetoris-test-'));
  await writeFile(path.join(staticDirectory, 'index.html'), '<!doctype html><title>test game</title>');
  await writeFile(path.join(staticDirectory, 'game.js'), 'console.log("game loaded");');
  const game = createGameServer({ staticDirectory });
  t.after(async () => {
    await new Promise(resolve => game.io.close(resolve));
    await rm(staticDirectory, { recursive: true, force: true });
  });
  game.server.listen(0, '127.0.0.1');
  await once(game.server, 'listening');
  return `http://127.0.0.1:${game.server.address().port}`;
}

test('production server serves static assets and the SPA fallback', async t => {
  const url = await startServer(t);
  for (const route of ['/', '/play']) {
    const response = await fetch(`${url}${route}`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/html/);
    assert.equal(await response.text(), '<!doctype html><title>test game</title>');
  }
  const response = await fetch(`${url}/game.js`);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'console.log("game loaded");');
});

test('production server relays state to other real clients without echoing to its sender', { timeout: 5000 }, async t => {
  const url = await startServer(t);
  const sender = connect(url, { transports: ['websocket'], autoConnect: false });
  const receiver = connect(url, { transports: ['websocket'], autoConnect: false });
  t.after(() => {
    sender.disconnect();
    receiver.disconnect();
  });
  const connections = [sender, receiver].map(socket => {
    const ready = once(socket, 'connect');
    socket.connect();
    return ready;
  });
  await Promise.all(connections);
  let echoed = false;
  sender.on('state', () => { echoed = true; });
  const received = once(receiver, 'state');
  const state = { arena: [[0, 1]], player: { pos: { x: 2, y: 3 }, score: 10 }, gameOver: false };
  sender.emit('state', state);
  const [actual] = await received;
  assert.deepEqual(actual, state);
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.equal(echoed, false);
});
