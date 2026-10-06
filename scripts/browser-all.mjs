import { spawnSync } from 'node:child_process';

let failed = false;
for (const engine of ['chromium', 'firefox', 'webkit']) {
  const result = spawnSync(process.execPath, ['scripts/browser-smoke.mjs'], {
    stdio: 'inherit', env: { ...process.env, PW_BROWSER: engine },
  });
  if (result.error) console.error(result.error);
  if (result.status !== 0) failed = true;
}
process.exitCode = failed ? 1 : 0;
