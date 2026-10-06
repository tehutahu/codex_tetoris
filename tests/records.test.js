const test = require('node:test');
const assert = require('node:assert/strict');

test('端末内の完走記録と再挑戦', async t => {
  const { createRecords, recordKey, MAX_SEED_RECORDS } = await import('../client/src/records.js');
  const { RULES_ID, createGame, updateGame } = await import('../client/src/game.js');
  const { createController } = await import('../client/src/controller.js');
  const date = '2026-10-06T00:00:00Z';
  const memory = () => {
    const values = new Map();
    return { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) };
  };
  const result = (elapsedMs, seed = 'a', rulesId = RULES_ID) => ({ status: 'won', elapsedMs, seed, score: 100, rulesId });
  const store = storage => createRecords({ storage, now: () => date });

  await t.test('最速だけ更新し、同タイム・遅い完走でもseed別ベストを分離', () => {
    const storage = memory();
    const r = store(storage);
    assert.equal(r.complete(result(1000)), true);
    assert.equal(r.complete({ ...result(1000), score: 999 }), false);
    assert.equal(r.get('a').overall.score, 100);
    assert.equal(r.complete(result(1100)), false);
    assert.equal(r.get('a').seedBest.elapsedMs, 1000);
    assert.equal(r.complete(result(1200, 'b')), false);
    assert.equal(r.get('b').seedBest.elapsedMs, 1200);
    assert.equal(r.complete(result(900, 'b')), true);
    assert.equal(r.get('a').overall.seed, 'b');
    assert.equal(r.get('a').seedBest.elapsedMs, 1000);
    assert.deepEqual(store(storage).get('b'), r.get('b'));
    const snapshot = r.get('b');
    snapshot.overall.elapsedMs = 99;
    assert.equal(r.get('b').overall.elapsedMs, 900);
  });
  await t.test('ゲームオーバー・中断・異なる規則は保存しない、規則ごとに別キー', () => {
    const storage = memory();
    const r = store(storage);
    for (const status of ['ready', 'playing', 'paused', 'lost']) {
      assert.equal(r.complete({ ...result(100), status }), false);
    }
    assert.equal(r.complete(result(100, 'a', 'older')), false);
    assert.equal(storage.getItem(recordKey()), null);
    const older = createRecords({ storage, rulesId: 'older', now: () => date });
    older.complete(result(99, 'a', 'older'));
    assert.equal(r.get('a').overall, null);
    r.complete(result(101));
    r.clear();
    assert.equal(createRecords({ storage, rulesId: 'older' }).get('a').overall.elapsedMs, 99);
  });
  await t.test('不正JSON・未知版・不正値・重複seed・比較矛盾を読み捨てる', () => {
    const storage = memory();
    store(storage).complete(result(100));
    const good = JSON.parse(storage.getItem(recordKey()));
    const bad = ['{', JSON.stringify(null), JSON.stringify({ ...good, version: 9 }),
      JSON.stringify({ ...good, rulesId: 'unknown' }),
      JSON.stringify({ ...good, seeds: [good.seeds[0], good.seeds[0]] }),
      JSON.stringify({ ...good, overall: null }),
      JSON.stringify({ ...good, overall: { ...good.overall, elapsedMs: 200 } })];
    for (const key of ['seed', 'elapsedMs', 'score', 'date']) {
      for (const value of [null, {}, -1, 'invalid']) {
        if (key === 'seed' && value === 'invalid') continue;
        bad.push(JSON.stringify({ ...good, seeds: [{ ...good.seeds[0], [key]: value }] }));
      }
    }
    for (const raw of bad) {
      storage.setItem(recordKey(), raw);
      const r = store(storage);
      assert.equal(r.get('a').overall, null);
      assert(r.get('a').warning);
      r.complete(result(500));
      assert.equal(store(storage).get('a').overall.elapsedMs, 500);
    }
  });
  await t.test('読み書き・容量・削除例外でも画面内の比較を維持', () => {
    const denied = { getItem() { throw Error('denied'); }, setItem() { throw Error('quota'); }, removeItem() { throw Error('denied'); } };
    for (const storage of [undefined, denied]) {
      const r = store(storage);
      assert(r.get('a').warning);
      assert.equal(r.complete(result(100)), true);
      assert.equal(r.get('a').overall.elapsedMs, 100);
      assert(r.get('a').warning);
      r.clear();
      assert.equal(r.get('a').overall, null);
      assert(r.get('a').warning);
    }
  });
  await t.test('seed別128件の上限を保ち、古い全体ベストは別枠で残す', () => {
    const storage = memory();
    const r = store(storage);
    r.complete(result(1, 'old-best'));
    for (let i = 0; i < MAX_SEED_RECORDS + 10; i++) r.complete(result(100 + i, `seed-${i}`));
    assert.equal(r.get('old-best').count, MAX_SEED_RECORDS);
    assert.equal(r.get('old-best').seedBest, null);
    assert.equal(r.get('old-best').overall.elapsedMs, 1);
    assert.equal(store(storage).get('last').overall.elapsedMs, 1);
    r.clear();
    assert.equal(storage.getItem(recordKey()), null);
    assert.equal(store(storage).get('old-best').count, 0);
  });
  await t.test('不正な完走値を拒否し、保存時間はミリ秒へ丸める', () => {
    const r = store(memory());
    for (const value of [-1, NaN, Infinity, '100']) assert.equal(r.complete(result(value)), false);
    assert.equal(r.complete({ ...result(100), score: -1 }), false);
    assert.equal(r.complete(result(100, '')), false);
    assert.equal(r.complete(result(100.6)), true);
    assert.equal(r.get('a').overall.elapsedMs, 101);
  });
  await t.test('同じseedは初期順を復元、新しいseedは状態と保持入力をリセット', () => {
    let time = 0;
    const c = createController({ seed: 'a', now: () => time });
    c.dispatch('start');
    const original = c.getState();
    c.dispatch('hardDrop');
    c.press('left', 'moveLeft');
    time = 500;
    c.dispatch('restart');
    assert.deepEqual(c.getState(), original);
    c.dispatch('restart', { seed: 'b' });
    assert.deepEqual(c.getState(), updateGame(createGame('b'), { type: 'start' }));
    const x = c.getState().active.x;
    time += 200;
    c.tick();
    assert.equal(c.getState().active.x, x);
  });
});
