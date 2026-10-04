const { spawn } = require('node:child_process');
const path = require('node:path');

const root = path.join(__dirname, '..');
const vite = path.join(path.dirname(require.resolve('vite/package.json')), 'bin', 'vite.js');
const children = [
  spawn(process.execPath, ['server.js'], { cwd: root, stdio: 'inherit' }),
  spawn(process.execPath, [vite], { cwd: path.join(root, 'client'), stdio: 'inherit' }),
];
let stopping = false;

function stop(exitCode) {
  if (stopping) return;
  stopping = true;
  process.exitCode = exitCode;
  for (const child of children) child.kill();
}

for (const child of children) {
  child.on('error', error => {
    console.error(error);
    stop(1);
  });
  child.on('exit', (code, signal) => {
    stop(code ?? (signal ? 1 : 0));
  });
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
