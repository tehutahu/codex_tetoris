import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium, firefox, webkit } from 'playwright';
import { createGameServer } from '../server.js';
import { createGame, updateGame, RULES_ID } from '../client/src/game.js';
import { recordKey } from '../client/src/records.js';
import { touchAcceptance } from './touch-acceptance.mjs';
import { ACCEPTANCE_SEED, sprintPlan } from './sprint-plan.mjs';
import { dailyAcceptance } from './daily-acceptance.mjs';

const browserName = process.env.PW_BROWSER || 'chromium';
const browserType = { chromium, firefox, webkit }[browserName];
if (!browserType) throw new Error(`Unknown PW_BROWSER: ${browserName}`);
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const sourceDirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8' }).trim().length > 0;
const output = resolve('output/playwright', browserName);
await mkdir(output, { recursive: true });
const plan = sprintPlan();
const created = createGameServer();
const server = created.server ?? created;
let browser;
let page;
const errors = [];
const externalRequests = [];
const failedResponses = [];
const keys = {
  moveLeft: 'ArrowLeft', moveRight: 'ArrowRight',
  rotateLeft: 'z', rotateRight: 'Space', softDrop: 'ArrowDown', hardDrop: 'ArrowUp',
};
let origin;
function observe(target) {
  target.on('pageerror', error => errors.push(String(error)));
  target.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  target.on('request', request => {
    if (!request.url().startsWith(origin + '/') && !request.url().startsWith('data:'))
      externalRequests.push(request.url());
  });
  target.on('response', response => {
    if (response.status() >= 400) failedResponses.push(response.status() + ' ' + response.url());
  });
}
try {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  origin = 'http://127.0.0.1:' + server.address().port;
  browser = await browserType.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  page = await context.newPage();
  await page.addInitScript(() => {
    window.recordWrites = 0;
    window.addEventListener('pointerdown', event => { window.lastPointerId = event.pointerId; }, true);
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key.startsWith('block-sprint.records.')) window.recordWrites++;
      return original.call(this, key, value);
    };
  });
  observe(page);
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
  await page.keyboard.press('ArrowUp'); // The initial O cannot verify rotation; the next S can.
  assert.ok(await number('#score') > 0, 'ArrowUp immediately drops and locks the initial piece');
  const rotationScore = await number('#score');
  const rotationNext = await page.locator('#next').getAttribute('aria-label');
  const beforeRotate = await bitmap();
  await page.keyboard.press('Space');
  assert.notEqual(await bitmap(), beforeRotate, 'right rotation changes the non-square piece');
  assert.equal(await number('#score'), rotationScore, 'Space rotates without dropping or scoring');
  assert.equal(await page.locator('#next').getAttribute('aria-label'), rotationNext, 'Space does not lock or spawn a piece');
  await page.keyboard.press('z');
  assert.equal(await bitmap(), beforeRotate, 'left rotation returns the non-square piece');
  const beforeSoftScore = await number('#score');
  await page.keyboard.press('ArrowDown');
  assert.equal(await number('#score'), beforeSoftScore + 1, 'soft drop awards one point');
  const beforeGravity = await bitmap();
  await page.clock.runFor(816);
  assert.notEqual(await bitmap(), beforeGravity, 'gravity advances on the real frame loop');
  assert.notEqual(await text('#time'), '00:00.0', 'playing time advances on the displayed clock');
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
  // Use production events and visible pixels/score; never rewrite the board.
  const restart = async () => {
    await page.locator('#restart').click();
    await page.locator('#board').click();
  };
  await page.keyboard.down('ArrowLeft');
  const immediateLeft = await bitmap();
  await page.clock.runFor(160);
  assert.equal(await bitmap(), immediateLeft, 'horizontal repeat waits');
  await page.clock.runFor(40);
  assert.notEqual(await bitmap(), immediateLeft, 'horizontal hold repeats');
  await page.keyboard.up('ArrowLeft');
  const released = await bitmap();
  await page.clock.runFor(100);
  assert.equal(await bitmap(), released, 'keyup stops repeat');
  await restart();
  await page.keyboard.down('ArrowDown');
  await page.clock.runFor(100);
  assert.equal(await number('#score'), 3, 'soft drop repeats every 45ms');
  await page.keyboard.up('ArrowDown');
  await page.clock.runFor(100);
  assert.equal(await number('#score'), 3, 'soft release stops scoring');
  await restart();
  await page.keyboard.down('ArrowUp');
  const dropScore = await number('#score');
  await page.clock.runFor(200);
  assert.equal(await number('#score'), dropScore, 'hard drop does not repeat');
  await page.keyboard.up('ArrowUp');
  await page.keyboard.down('Space');
  const heldRotation = await bitmap();
  await page.clock.runFor(200);
  assert.equal(await bitmap(), heldRotation, 'rotation does not repeat');
  await page.keyboard.up('Space');
  await restart();
  await page.keyboard.down('ArrowLeft');
  await page.keyboard.press('p');
  await page.clock.runFor(1000);
  await page.keyboard.press('p');
  const resumed = await bitmap();
  await page.clock.runFor(250);
  assert.equal(await bitmap(), resumed, 'pause clears held keys');
  await restart();
  const resetHeld = await bitmap();
  await page.clock.runFor(250);
  assert.equal(await bitmap(), resetHeld, 'restart clears held keys');
  await page.keyboard.up('ArrowLeft');
  await restart();
  for (let i = 0; i < 18; i++) await page.keyboard.press('ArrowDown');
  const nextBeforeLock = await page.locator('#next').getAttribute('aria-label');
  await page.clock.runFor(200);
  assert.equal(await page.locator('#next').getAttribute('aria-label'), nextBeforeLock,
    'landed piece stays adjustable');
  await page.keyboard.press('ArrowLeft');
  await page.clock.runFor(200);
  assert.equal(await page.locator('#next').getAttribute('aria-label'), nextBeforeLock,
    'successful grounded movement extends the delay');
  await page.clock.runFor(120);
  assert.notEqual(await page.locator('#next').getAttribute('aria-label'), nextBeforeLock,
    'piece locks after the extended delay');
  await restart();
  const pointerButton = page.locator('[data-action="softDrop"]');
  await pointerButton.scrollIntoViewIfNeeded();
  const pointerBounds = await pointerButton.boundingBox();
  const pointerDown = async () => {
    await page.mouse.move(pointerBounds.x + pointerBounds.width / 2, pointerBounds.y + pointerBounds.height / 2);
    await page.mouse.down();
  };
  await pointerDown();
  await page.clock.runFor(100);
  assert.equal(await number('#score'), 3, 'pointer hold shares keyboard timing');
  await page.mouse.move(pointerBounds.x - 10, pointerBounds.y);
  await page.clock.runFor(100);
  assert.equal(await number('#score'), 3, 'moving outside releases the held pointer');
  await page.mouse.up();
  for (const eventName of ['pointercancel', 'lostpointercapture']) {
    await restart();
    await pointerDown();
    const pointerId = await page.evaluate(() => window.lastPointerId);
    if (eventName === 'pointercancel') {
      await pointerButton.dispatchEvent('pointercancel', { pointerId });
    } else {
      // Activate the pending capture before releasing it; cancelling a pending
      // capture has no lostpointercapture event in the Pointer Events model.
      await page.mouse.move(pointerBounds.x + pointerBounds.width / 2 + 1, pointerBounds.y + pointerBounds.height / 2);
      await pointerButton.evaluate((button, id) => button.releasePointerCapture(id), pointerId);
      await page.mouse.move(pointerBounds.x + pointerBounds.width / 2 + 2, pointerBounds.y + pointerBounds.height / 2);
    }
    const score = await number('#score');
    await page.clock.runFor(100);
    assert.equal(await number('#score'), score, eventName + ' clears input');
    await page.mouse.up();
  }
  await restart();
  await page.keyboard.down('ArrowLeft');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.locator('#session-action').click();
  await page.locator('#board').click();
  const afterBlur = await bitmap();
  await page.clock.runFor(250);
  assert.equal(await bitmap(), afterBlur, 'blur clears held keys on resume');
  await page.keyboard.up('ArrowLeft');
  await restart();
  await page.screenshot({ path: resolve(output, 'desktop.png'), fullPage: true });
  await page.clock.runFor(320); // A controlled elapsed time, not a human speed record.

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
  await page.keyboard.press('ArrowUp');
  assert.equal(await number('#score'), wonScore, 'terminal game ignores drop input');
  const readSaved = () => page.evaluate(key => localStorage.getItem(key), recordKey());
  const savedCompletion = await readSaved();
  const saved = JSON.parse(savedCompletion);
  assert.equal(saved.rulesId, RULES_ID);
  assert.equal(saved.overall.seed, ACCEPTANCE_SEED);
  assert.equal(saved.overall.score, wonScore);
  assert(saved.overall.elapsedMs > 0);
  assert.equal(await page.evaluate(() => window.recordWrites), 1, 'one write per completed run');
  await page.clock.runFor(1000);
  assert.equal(await readSaved(), savedCompletion, 'terminal rendering does not save again');
  const savedBestText = await text('#best-overall');
  await page.screenshot({ path: resolve(output, 'won.png'), fullPage: true });
  await page.reload();
  await page.locator('#status-label').waitFor();
  assert.equal(await text('#best-overall'), savedBestText, 'best survives reload');
  assert.equal(await text('#best-seed'), savedBestText, 'seed best survives reload');

  await page.keyboard.press('Enter');
  assert.equal(await text('#status-label'), 'プレイ中');
  assert.equal(await number('#lines'), 0);
  let lost = updateGame(createGame(ACCEPTANCE_SEED), { type: 'start' });
  let lostPieces = 0;
  while (lost.status === 'playing' && lostPieces < 30) {
    lost = updateGame(lost, { type: 'hardDrop' });
    await page.keyboard.press('ArrowUp');
    lostPieces++;
  }
  assert.equal(lost.status, 'lost');
  assert.equal(await text('#status-label'), 'ゲーム終了');
  assert.equal(await readSaved(), savedCompletion, 'lost never creates a completion record');
  await page.locator('#overlay-action').click();
  await page.locator('#board').click();
  assert.equal(await text('#status-label'), 'プレイ中');
  assert.equal(await number('#lines'), 0);
  assert.equal(await number('#score'), 0);

  // Headless tabs do not model desktop focus. Exercise the production blur listener explicitly.
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  assert.equal(await text('#status-label'), '一時停止');
  const blurTime = await text('#time');
  await page.clock.runFor(1600);
  assert.equal(await text('#time'), blurTime, 'blur handler freezes the displayed timer');
  assert.equal(await readSaved(), savedCompletion, 'interruption never creates a completion record');
  await page.locator('#session-action').click();
  await page.locator('#board').click();
  assert.equal(await text('#status-label'), 'プレイ中');

  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true,
    'mobile viewport has no horizontal overflow');
  await page.locator('[data-action="hardDrop"]').click();
  assert(await number('#score') > 0, 'screen drop fixes the initial square');
  const beforeMobileMove = await bitmap();
  await page.locator('[data-action="moveLeft"]').click();
  assert.notEqual(await bitmap(), beforeMobileMove, 'screen left button moves the piece');
  await page.locator('[data-action="moveRight"]').click();
  assert.equal(await bitmap(), beforeMobileMove, 'screen right button returns the piece');
  await page.locator('[data-action="rotateRight"]').click();
  assert.notEqual(await bitmap(), beforeMobileMove, 'screen right rotation changes the non-square piece');
  await page.locator('[data-action="rotateLeft"]').click();
  assert.equal(await bitmap(), beforeMobileMove, 'screen left rotation returns the piece');
  const beforeMobileSoft = await number('#score');
  await page.locator('[data-action="softDrop"]').click();
  assert.equal(await number('#score'), beforeMobileSoft + 1, 'screen soft drop awards a point');
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
  await restart();
  await page.clock.runFor(100);
  for (const piece of plan) {
    for (const action of piece.actions) await page.keyboard.press(keys[action]);
  }
  assert.equal(await text('#status-label'), '20ライン達成！');
  const faster = JSON.parse(await readSaved());
  const daily = await dailyAcceptance({ browser, origin, output, observe, normalRecord: await readSaved() });
  assert(faster.overall.elapsedMs < saved.overall.elapsedMs, 'a faster legal completion updates best');
  assert.equal(await text('#record-status'), '自己ベスト更新！');
  await restart();
  const sameSeedBoard = await bitmap();
  const sameSeedNext = await page.locator('#next').getAttribute('aria-label');
  await page.keyboard.press('ArrowUp');
  await restart();
  assert.equal(await bitmap(), sameSeedBoard, 'same-order retry restores initial piece');
  assert.equal(await page.locator('#next').getAttribute('aria-label'), sameSeedNext);
  await page.locator('#new-seed').click();
  const freshSeed = await text('#seed');
  assert.notEqual(freshSeed, ACCEPTANCE_SEED);
  assert.equal(new URL(page.url()).searchParams.get('seed'), freshSeed);
  assert.equal(await number('#score'), 0);
  assert.equal(await number('#lines'), 0);
  assert.equal(await text('#time'), '00:00.0');
  assert.equal(await text('#best-seed'), '—');
  assert.notEqual(await text('#best-overall'), '—');
  await page.locator('#clear-records').click();
  await page.locator('#cancel-clear').click();
  assert.notEqual(await readSaved(), null, 'cancel preserves records');
  await page.locator('#clear-records').click();
  await page.locator('#confirm-clear').click();
  assert.equal(await readSaved(), null);
  assert.equal(await text('#best-overall'), '—');
  assert.equal(await text('#best-seed'), '—');
  // A separate context models a browser policy rejecting storage access.
  const deniedContext = await browser.newContext();
  await deniedContext.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage denied'); } });
  });
  const deniedPage = await deniedContext.newPage();
  observe(deniedPage);
  await deniedPage.clock.install({ time: startTime });
  await deniedPage.goto(origin + '/?seed=' + ACCEPTANCE_SEED);
  await deniedPage.clock.pauseAt(new Date(startTime.getTime() + 1000));
  assert.match(await deniedPage.locator('#record-status').textContent(), /読み込めません/);
  await deniedPage.locator('#overlay-action').click();
  await deniedPage.locator('#board').click();
  for (const piece of plan) for (const action of piece.actions) await deniedPage.keyboard.press(keys[action]);
  assert.equal(await deniedPage.locator('#status-label').textContent(), '20ライン達成！');
  assert.match(await deniedPage.locator('#record-status').textContent(), /保存できません/);
  await deniedPage.locator('#overlay-action').click();
  assert.equal(await deniedPage.locator('#status-label').textContent(), 'プレイ中');
  await deniedContext.close();
  const touch = await touchAcceptance({ browser, browserName, origin, output, plan, observe });
  assert.deepEqual(errors, [], 'no console or runtime errors');
  assert.deepEqual(externalRequests, [], 'no external runtime request');
  assert.deepEqual(failedResponses, [], 'no missing production asset');
  const report = {
    commit, sourceDirty, platform: process.platform, runtime: process.version,
    engine: browserName, browser: await browser.version(),
    seed: ACCEPTANCE_SEED, winningPieces: plan.length, losingPieces: lostPieces,
    lines: plan.at(-1).lines, score: plan.at(-1).score,
    checks: ['start', 'move', 'rotate', 'soft-drop', 'gravity', 'pause-time',
      'hard-drop', 'line-clear', 'win', 'game-over', 'restart', 'blur-event-pause',
      'keyboard-hold-release', 'pointer-hold-outside-release', 'pointercancel-event',
      'lostpointercapture', 'one-shot-rotation-drop', 'grounded-adjustment',
      'pause-restart-blur-input-clear', 'mobile-buttons', 'mobile-layout',
      'best-save-once', 'reload-best', 'faster-completion-best', 'lost-pause-no-save',
      'same-new-seed-retry', 'delete-cancel-confirm', 'storage-denied-complete-retry',
      'offline-continuation', 'console', 'network'],
    daily, touch, errors, externalRequests, failedResponses,
  };
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  if (page && !page.isClosed()) await page.screenshot({ path: resolve(output, 'failure.png'), fullPage: true }).catch(() => {});
  await writeFile(resolve(output, 'failure.json'), JSON.stringify({ commit, engine: browserName,
    error: String(error), errors, externalRequests, failedResponses }, null, 2) + '\n');
  console.error(error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.closeAllConnections();
  await new Promise(resolveClose => server.close(resolveClose));
}
