const test = require('node:test');
const assert = require('node:assert/strict');

test('日本時間の日替わり挑戦', async t => {
  const { japanDate, validDay, dailyChallenge, challengeFromUrl, challengeUrl, DAILY_RECORDS_ID } = await import('../client/src/challenge.js');
  const { createGame, updateGame, RULES_ID } = await import('../client/src/game.js');
  const { createRecords, recordKey } = await import('../client/src/records.js');
  await t.test('日本時間0時・年末・閏日の境界', () => {
    assert.equal(japanDate('2026-10-06T14:59:59.999Z'), '2026-10-06');
    assert.equal(japanDate('2026-10-06T15:00:00Z'), '2026-10-07');
    assert.equal(japanDate('2026-12-31T15:00:00Z'), '2027-01-01');
    assert.equal(japanDate('2028-02-28T15:00:00Z'), '2028-02-29');
    assert.equal(japanDate('2028-02-29T15:00:00Z'), '2028-03-01');
    assert.equal(japanDate(new Date('2026-10-06T15:00:00Z').getTime()), '2026-10-07');
  });
  await t.test('実在する日付だけ受け入れ、不正URLは今日へ正規化', () => {
    for (const day of ['2026-02-29', '2026-04-31', '2026-13-01', '2026-1-01', '', null, '<script>']) {
      assert.equal(validDay(day), false);
      assert.equal(challengeFromUrl(new URLSearchParams({ mode: 'daily', date: day }), 'random', '2026-10-06T15:00:00Z').day, '2026-10-07');
      assert.throws(() => dailyChallenge(day));
    }
    assert.equal(validDay('2028-02-29'), true);
  });
  await t.test('同日同ルールの順番を再現し、URLのseedに上書きされない', () => {
    const a = dailyChallenge('2026-10-07');
    const b = challengeFromUrl(new URLSearchParams('mode=daily&date=2026-10-07&seed=other'), 'random');
    assert.deepEqual(a, b);
    let first = updateGame(createGame(a.seed), { type: 'start' });
    let second = updateGame(createGame(b.seed), { type: 'start' });
    for (let i = 0; i < 12; i++) {
      assert.deepEqual(first, second);
      first = updateGame(first, { type: 'hardDrop' });
      second = updateGame(second, { type: 'hardDrop' });
    }
    assert.notEqual(a.seed, dailyChallenge('2026-10-08').seed);
    assert(a.seed.includes(RULES_ID));
  });
  await t.test('日付・時計を変えても共有済みの挑戦日は維持', () => {
    const selected = dailyChallenge('2026-10-07');
    const url = challengeUrl(new URLSearchParams('seed=old&extra=keep'), selected);
    assert.equal(url.has('seed'), false);
    assert.equal(url.get('extra'), 'keep');
    for (const now of ['2026-10-08T15:00:00Z', '2026-10-01T00:00:00Z']) {
      assert.deepEqual(challengeFromUrl(url, 'random', now), selected);
    }
    const normal = challengeUrl(url, { mode: 'normal', seed: 'practice' });
    assert.equal(normal.has('mode'), false);
    assert.equal(normal.has('date'), false);
    assert.equal(normal.get('seed'), 'practice');
  });
  await t.test('同じseedでも通常と日替わりの保存・再読込・削除を分離', () => {
    const values = new Map();
    const storage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) };
    const options = { storage, key: recordKey(DAILY_RECORDS_ID) };
    const normal = createRecords({ storage });
    const daily = createRecords(options);
    const seed = dailyChallenge('2026-10-07').seed;
    const result = elapsedMs => ({ status: 'won', rulesId: RULES_ID, seed, elapsedMs, score: 100 });
    normal.complete(result(100));
    assert.equal(daily.get(seed).seedBest, null);
    daily.complete(result(200));
    daily.complete({ ...result(300), seed: dailyChallenge('2026-10-08').seed });
    assert.equal(normal.get(seed).seedBest.elapsedMs, 100);
    assert.equal(createRecords(options).get(seed).seedBest.elapsedMs, 200);
    daily.clear();
    assert.equal(values.get(recordKey(DAILY_RECORDS_ID)), undefined);
    assert.equal(normal.get(seed).seedBest.elapsedMs, 100);
    assert(values.has(recordKey()));
  });
});
