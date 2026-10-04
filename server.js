const { createServer } = require('node:http');
const { existsSync } = require('node:fs');
const { open, realpath } = require('node:fs/promises');
const { pipeline } = require('node:stream/promises');
const path = require('node:path');

const DEFAULT_DIRECTORY = path.join(__dirname, 'client', 'dist');
const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
};

function isWithin(directory, target) {
  const relative = path.relative(directory, target);
  return relative === '' || (
    relative !== '..' &&
    !relative.startsWith('..' + path.sep) &&
    !path.isAbsolute(relative)
  );
}

function sendText(request, response, status, text, extraHeaders = {}) {
  response.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    ...extraHeaders,
  });
  response.end(request.method === 'HEAD' ? undefined : text);
}

async function serveStatic(request, response, staticDirectory) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    sendText(request, response, 405, 'Method not allowed\n', { Allow: 'GET, HEAD' });
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent((request.url || '/').split('?')[0]);
  } catch {
    sendText(request, response, 400, 'Bad request\n');
    return;
  }
  if (!pathname.startsWith('/') || pathname.includes('\0')) {
    sendText(request, response, 400, 'Bad request\n');
    return;
  }
  // Reject Windows separators/alternate data streams and hidden/dot segments.
  if (
    pathname.includes('\\') || pathname.includes(':') ||
    pathname.split('/').some(segment => segment.startsWith('.'))
  ) {
    sendText(request, response, 403, 'Forbidden\n');
    return;
  }

  const target = path.resolve(staticDirectory, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!isWithin(staticDirectory, target)) {
    sendText(request, response, 403, 'Forbidden\n');
    return;
  }

  let file;
  try {
    const directory = await realpath(staticDirectory);
    const resolvedTarget = await realpath(target);
    if (!isWithin(directory, resolvedTarget)) {
      sendText(request, response, 403, 'Forbidden\n');
      return;
    }
    file = await open(resolvedTarget, 'r');
    const stats = await file.stat();
    if (!stats.isFile()) {
      await file.close();
      file = undefined;
      sendText(request, response, 404, 'Not found\n');
      return;
    }

    response.writeHead(200, {
      'Content-Type': CONTENT_TYPES[path.extname(resolvedTarget).toLowerCase()] || 'application/octet-stream',
      'Content-Length': stats.size,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    if (request.method === 'HEAD') {
      await file.close();
      file = undefined;
      response.end();
      return;
    }
    const stream = file.createReadStream();
    file = undefined;
    await pipeline(stream, response);
  } catch (error) {
    if (file) await file.close().catch(() => {});
    if (response.headersSent) {
      response.destroy();
      return;
    }
    const missing = ['ENOENT', 'ENOTDIR', 'EISDIR'].includes(error.code);
    const status = missing ? 404 : error.code === 'EACCES' ? 403 : 500;
    sendText(request, response, status, status === 404 ? 'Not found\n' : status === 403 ? 'Forbidden\n' : 'Server error\n');
  }
}

function createGameServer({ staticDirectory = DEFAULT_DIRECTORY } = {}) {
  const directory = path.resolve(staticDirectory);
  const server = createServer((request, response) => {
    serveStatic(request, response, directory).catch(() => {
      if (response.headersSent) response.destroy();
      else sendText(request, response, 500, 'Server error\n');
    });
  });
  return { server };
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    console.error('PORT must be an integer between 0 and 65535.');
    process.exitCode = 1;
  } else if (!existsSync(path.join(DEFAULT_DIRECTORY, 'index.html'))) {
    console.error('Client build is missing. Run npm run build before npm start.');
    process.exitCode = 1;
  } else {
    const { server } = createGameServer();
    server.on('error', error => {
      console.error('Server failed to start: ' + error.message);
      process.exitCode = 1;
    });
    server.listen(port, () => {
      console.log('Server listening on http://localhost:' + server.address().port);
    });
  }
}

module.exports = { createGameServer };
