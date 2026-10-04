import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { createGameServer } from '../server.js';
import { createGame, updateGame } from '../client/src/game.js';
import { ACCEPTANCE_SEED, sprintPlan } from './sprint-plan.mjs';

const output = resolve('output/playwright');
await mkdir(output, { recursive: true });
const plan = sprintPlan();
const created = createGameServer();
const server = created.server ?? created;
let browser;
const errors = [];
const externalRequests = [];
const failedResponses = [];
const keys = {
  moveLeft: 'ArrowLeft', moveRight: 'ArrowRight',
  rotateLeft: 'z', rotateRight: 'x', softDrop: 'ArrowDown', hardDrop: 'Space',
};
try {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('request', request => {
    if (!request.url().startsWith(origin + '/') && !request.url().startsWith('data:'))
      externalRequests.push(request.url());
  });
  page.on('response', response => {
    if (response.status() >= 400) failedResponses.push(response.status() + ' ' + response.url());
  });
  const startTime = new Date('2026-10-04T00:00:00Z');
  await page.clock.install({ time: startTime });
  const response = await page.goto(origin + '/?seed=' + ACCEPTANCE_SEED);
  assert.equal(response.status(), 200);
  await page.locator('#status-label').waitFor();
  await page.clock.pauseAt(new Date(startTime.getTime() + 1000));
  const text = selector => page.locator(selector).textContent();
  const bitmap = () => page.locator('#board').evaluate(canvas => canvas.toDataURL());
  const number = async selector => Number((await text(selector)).replaceAll(',', ''));
  assert.equal(await text('#status-label'), '準備完了');
  assert.equal(await number('#lines'), 0);
  assert.equal(await page.locator('#next').evaluate(canvas =>
    canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.some(value => value > 0)), true);

  await page.locator('#overlay-action').click();
  await page.locator('#board').click();
  assert.equal(await text('#status-label'), 'プレイ中');
  const beforeMove = await bitmap();
  await page.keyboard.press('ArrowLeft');
  assert.notEqual(await bitmap(), beforeMove, 'left input changes the drawn piece');
  await page.keyboard.press('ArrowRight');
  assert.equal(await bitmap(), beforeMove, 'right input returns the piece');
  await page.keyboard.press('x');
  await page.keyboard.press('z');
  assert.equal(await bitmap(), beforeMove, 'opposite rotations return the piece');
  await page.keyboard.press('ArrowDown');
  assert.equal(await number('#score'), 1, 'soft drop awards one point');
  const beforeGravity = await bitmap();
  await page.clock.runFor(816);
  assert.notEqual(await bitmap(), beforeGravity, 'gravity advances on the real frame loop');
  await page.keyboard.press('p');
  assert.equal(await text('#status-label'), '一時停止');
  const pausedTime = await text('#time');
  const pausedBoard = await bitmap();
  await page.clock.runFor(2400);
  await page.keyboard.press('ArrowLeft');
  assert.equal(await text('#time'), pausedTime, 'pause freezes the timer');
  assert.equal(await bitmap(), pausedBoard, 'pause freezes gravity and movement');
  await page.keyboard.press('p');
  assert.equal(await text('#status-label'), 'プレイ中');
  await page.locator('#restart').click();
  await page.locator('#board').click();
  assert.equal(await number('#score'), 0);
  assert.equal(await number('#lines'), 0);
  assert.equal(await text('#time'), '00:00.0');
  await page.screenshot({ path: resolve(output, 'desktop.png'), fullPage: true });

  let firstClearChecked = false;
  for (const piece of plan) {
    for (const action of piece.actions) await page.keyboard.press(keys[action]);
    assert.equal(await number('#lines'), piece.lines, 'displayed lines match the legal plan');
    assert.equal(await number('#score'), piece.score, 'displayed score matches the legal plan');
    if (!firstClearChecked && piece.lines > 0) {
      firstClearChecked = true;
      await page.screenshot({ path: resolve(output, 'line-clear.png'), fullPage: true });
    }
  }
  assert(firstClearChecked, 'ordinary inputs clear at least one line');
  assert.equal(await text('#status-label'), '20ライン達成！');
  assert.equal(await page.locator('#progress').getAttribute('max'), '20');
  assert.equal(await page.locator('#progress').evaluate(element => element.value), 20);
  const wonScore = await number('#score');
  await page.keyboard.press('Space');
  assert.equal(await number('#score'), wonScore, 'terminal game ignores drop input');
  await page.screenshot({ path: resolve(output, 'won.png'), fullPage: true });

  await page.keyboard.press('Enter');
  assert.equal(await text('#status-label'), 'プレイ中');
  assert.equal(await number('#lines'), 0);
  let lost = updateGame(createGame(ACCEPTANCE_SEED), { type: 'start' });
  let lostPieces = 0;
  while (lost.status === 'playing' && lostPieces < 30) {
    lost = updateGame(lost, { type: 'hardDrop' });
    await page.keyboard.press('Space');
    lostPieces++;
  }
  assert.equal(lost.status, 'lost');
  assert.equal(await text('#status-label'), 'ゲーム終了');
  await page.locator('#overlay-action').click();
  await page.locator('#board').click();
  assert.equal(await text('#status-label'), 'プレイ中');
  assert.equal(await number('#lines'), 0);
  assert.equal(await number('#score'), 0);

  // Focus loss is a real browser event and must pause the live game.
  const other = await context.newPage();
  await other.goto('about:blank');
  await page.waitForFunction(() => document.querySelector('#status-label').textContent === '一時停止');
  await other.close();
  await page.bringToFront();
  await page.locator('#session-action').click();
  await page.locator('#board').click();
  assert.equal(await text('#status-label'), 'プレイ中');

  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true,
    'mobile viewport has no horizontal overflow');
  await page.locator('[data-action="moveLeft"]').click();
  await page.locator('[data-action="rotateRight"]').click();
  await page.locator('[data-action="softDrop"]').click();
  const mobileScore = await number('#score');
  await page.locator('[data-action="hardDrop"]').click();
  assert(await number('#score') > mobileScore, 'screen drop button reaches the same input path');
  await page.screenshot({ path: resolve(output, 'mobile.png'), fullPage: true });

  // Cached assets are enough for continued play, without gameplay networking.
  await context.setOffline(true);
  await page.locator('#restart').click();
  await page.locator('[data-action="hardDrop"]').click();
  assert(await number('#score') > 0);
  await context.setOffline(false);
  assert.deepEqual(errors, [], 'no console or runtime errors');
  assert.deepEqual(externalRequests, [], 'no external runtime request');
  assert.deepEqual(failedResponses, [], 'no missing production asset');
  const report = {
    runtime: process.version, browser: await browser.version(),
    seed: ACCEPTANCE_SEED, winningPieces: plan.length, losingPieces: lostPieces,
    lines: plan.at(-1).lines, score: plan.at(-1).score,
    checks: ['start', 'move', 'rotate', 'soft-drop', 'gravity', 'pause-time',
      'hard-drop', 'line-clear', 'win', 'game-over', 'restart', 'blur-pause',
      'mobile-buttons', 'mobile-layout', 'offline-continuation', 'console', 'network'],
    errors, externalRequests, failedResponses,
  };
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.closeAllConnections();
  await new Promise(resolveClose => server.close(resolveClose));
}