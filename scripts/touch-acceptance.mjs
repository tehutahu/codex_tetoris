import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { recordKey } from '../client/src/records.js';
import { ACCEPTANCE_SEED } from './sprint-plan.mjs';

// Touch emulation is explicitly reported separately from physical-device acceptance.
export async function touchAcceptance({ browser, browserName, origin, output, plan, observe }) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  try {
    const page = await context.newPage();
    observe(page);
    const time = new Date('2026-10-06T00:00:00Z');
    await page.clock.install({ time });
    await page.goto(`${origin}/?seed=${ACCEPTANCE_SEED}`);
    await page.clock.pauseAt(new Date(time.getTime() + 1000));
    const tap = async selector => {
      const button = page.locator(selector);
      await button.scrollIntoViewIfNeeded();
      const b = await button.boundingBox();
      await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    };
    const score = async () => Number((await page.locator('#score').textContent()).replaceAll(',', ''));
    await tap('#overlay-action');
    await tap('[data-action="softDrop"]');
    assert.equal(await score(), 1, 'native emulated touch tap moves once');
    const checks = ['touch-tap', 'touch-legal-completion', 'touch-retry', 'portrait-landscape'];
    if (browserName === 'chromium') {
      const cdp = await context.newCDPSession(page);
      const b = await page.locator('[data-action="softDrop"]').boundingBox();
      const rotate = await page.locator('[data-action="rotateRight"]').boundingBox();
      const first = { x: b.x + b.width / 2, y: b.y + b.height / 2, id: 1 };
      const second = { x: rotate.x + rotate.width / 2, y: rotate.y + rotate.height / 2, id: 2 };
      const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
      await touch('touchStart', [first]);
      await page.clock.runFor(120);
      const heldScore = await score();
      assert(heldScore >= 3, 'native touch hold repeats beyond its immediate input');
      await touch('touchStart', [first, second]);
      await page.clock.runFor(80);
      const combinedScore = await score();
      assert(combinedScore > heldScore, 'second finger does not cancel soft drop');
      // CDP touchMove describes remaining active points; touchEnd ends all.
      await touch('touchMove', [first]);
      await page.clock.runFor(80);
      assert(await score() > combinedScore, 'releasing second finger preserves first');
      await touch('touchMove', [{ ...first, x: b.x - 10 }]);
      await page.clock.runFor(16); // Deliver native events before testing the released interval.
      const outsideScore = await score();
      await page.clock.runFor(100);
      assert.equal(await score(), outsideScore, 'finger outside releases held action');
      await touch('touchEnd', []);
      await touch('touchStart', [{ ...first, id: 3 }]);
      await page.clock.runFor(16);
      await touch('touchCancel', []);
      await page.clock.runFor(16);
      const cancelScore = await score();
      await page.clock.runFor(100);
      assert.equal(await score(), cancelScore, 'native touch cancel releases held action');
      await cdp.detach();
      checks.push('native-touch-hold', 'two-finger-combination', 'finger-outside-release', 'native-touch-cancel');
    }
    await tap('#restart');
    await page.clock.runFor(100);
    for (const piece of plan) {
      for (const action of piece.actions) await tap(`[data-action="${action}"]`);
    }
    assert.equal(await page.locator('#status-label').textContent(), '20ライン達成！');
    assert.notEqual(await page.evaluate(key => localStorage.getItem(key), recordKey()), null);
    await page.screenshot({ path: resolve(output, 'touch-won.png'), fullPage: true });
    await tap('#overlay-action');
    assert.equal(await page.locator('#lines').textContent(), '0');
    assert.equal(await page.locator('#status-label').textContent(), 'プレイ中');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.setViewportSize({ width: 844, height: 390 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: resolve(output, 'touch-landscape.png'), fullPage: true });
    return { emulated: true, physicalDevice: false, checks,
      holdCoverage: browserName === 'chromium' ? 'CDP native touch events' : 'mouse pointer holds in the desktop scenario; touch taps here' };
  } finally {
    await context.close();
  }
}
