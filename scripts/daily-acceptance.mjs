import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { dailyChallenge, DAILY_RECORDS_ID } from '../client/src/challenge.js';
import { recordKey } from '../client/src/records.js';
import { sprintPlan } from './sprint-plan.mjs';

export async function dailyAcceptance({ browser, origin, output, observe, normalRecord }) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  observe(page);
  try {
    const start = new Date('2026-10-06T14:59:57Z');
    await page.clock.install({ time: start });
    await page.goto(`${origin}/?seed=practice`);
    await page.locator('#status-label').waitFor();
    await page.clock.pauseAt(new Date(start.getTime() + 1000));
    await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: recordKey(), value: normalRecord });
    await page.locator('#daily-mode').click();
    const text = id => page.locator(id).textContent();
    const bitmap = () => page.locator('#board').evaluate(c => c.toDataURL());
    const read = key => page.evaluate(k => localStorage.getItem(k), key);
    const day = dailyChallenge('2026-10-06');
    assert.equal(await text('#seed'), day.seed);
    assert.equal(new URL(page.url()).searchParams.get('date'), day.day);
    assert.equal(await page.locator('#new-seed').isVisible(), false);
    assert.equal(await text('#best-seed'), '—');
    const board = await bitmap();
    const next = await page.locator('#next').getAttribute('aria-label');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('r');
    assert.equal(await bitmap(), board);
    assert.equal(await page.locator('#next').getAttribute('aria-label'), next);
    await page.clock.runFor(100);
    const keys = { moveLeft: 'ArrowLeft', moveRight: 'ArrowRight', rotateRight: 'Space', hardDrop: 'ArrowUp' };
    for (const piece of sprintPlan(day.seed)) {
      for (const action of piece.actions) await page.keyboard.press(keys[action]);
      assert.equal(Number(await text('#lines')), piece.lines);
    }
    assert.equal(await text('#status-label'), '20ライン達成！');
    const dailySaved = await read(recordKey(DAILY_RECORDS_ID));
    assert.equal(JSON.parse(dailySaved).seeds[0].seed, day.seed);
    assert.equal(await read(recordKey()), normalRecord, 'daily completion preserves normal records');
    const best = await text('#best-seed');
    await page.reload();
    await page.locator('#status-label').waitFor();
    assert.equal(await text('#best-seed'), best, 'daily best survives reload');
    await page.keyboard.press('Enter');
    await page.clock.setSystemTime(new Date('2026-10-06T15:00:00Z'));
    await page.clock.runFor(20);
    assert.equal(await text('#seed'), day.seed, 'midnight keeps the selected challenge');
    assert.equal(new URL(page.url()).searchParams.get('date'), day.day);
    assert.equal(await page.locator('#refresh-day').isVisible(), true);
    await page.clock.setSystemTime(new Date('2026-10-05T15:00:00Z'));
    await page.clock.runFor(20);
    assert.equal(await text('#seed'), day.seed, 'clock rewind keeps the selected challenge');
    await page.clock.setSystemTime(new Date('2026-10-06T15:00:00Z'));
    await page.clock.runFor(20);
    await page.locator('#refresh-day').click();
    assert.equal(await text('#seed'), dailyChallenge('2026-10-07').seed);
    assert.equal(await text('#score'), '0');
    assert.equal(await text('#time'), '00:00.0');
    assert.equal(await text('#best-seed'), '—');
    assert.equal(await page.locator('#refresh-day').isVisible(), false);
    await page.screenshot({ path: resolve(output, 'daily-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: resolve(output, 'daily-mobile.png'), fullPage: true });
    await page.locator('#clear-records').click();
    await page.locator('#cancel-clear').click();
    assert.equal(await read(recordKey(DAILY_RECORDS_ID)), dailySaved);
    await page.locator('#clear-records').click();
    await page.locator('#confirm-clear').click();
    assert.equal(await read(recordKey(DAILY_RECORDS_ID)), null);
    assert.equal(await read(recordKey()), normalRecord, 'daily deletion preserves normal records');
    await page.locator('#normal-mode').click();
    assert.equal(new URL(page.url()).searchParams.has('mode'), false);
    assert.notEqual(await text('#best-overall'), '—');
    assert.equal(await page.locator('#new-seed').isVisible(), true);
    await page.goto(`${origin}/?mode=daily&date=2026-02-30&seed=ignored`);
    await page.locator('#status-label').waitFor();
    assert.equal(new URL(page.url()).searchParams.get('date'), '2026-10-07');
    assert.equal(new URL(page.url()).searchParams.has('seed'), false);
    return { day: day.day, checks: ['daily-legal-win', 'daily-reload-best', 'same-day-retry',
      'midnight-fixed-date', 'clock-rewind', 'explicit-day-refresh', 'separate-save-delete',
      'normal-mode-return', 'daily-mobile-layout', 'invalid-date-normalization'] };
  } finally {
    await context.close();
  }
}
