const test = require('node:test');
const assert = require('node:assert/strict');

test('入力反復と接地猶予の時間境界', async t => {
  const { createController } = await import('../client/src/controller.js');
  const { createInput } = await import('../client/src/input.js');
  const { createGame, createPiece, createBoard, updateGame, RULES_ID } = await import('../client/src/game.js');
  const act = (s, type, deltaMs) => updateGame(s, { type, deltaMs });
  const floor = () => ({ ...act(createGame('floor'), 'start'),
    active: { type: 'O', matrix: createPiece('O'), x: 4, y: 18 } });
  const clock = () => {
    let time = 0;
    const c = createController({ seed: 'acceptance-20', now: () => time });
    c.dispatch('start');
    return { c, advance: ms => { time += ms; c.tick(); } };
  };

  await t.test('横移動は即時・180ms・55ms、OS repeat相当の重複pressを無視', () => {
    const { c, advance } = clock();
    const x = c.getState().active.x;
    c.press('left', 'moveLeft');
    c.press('left', 'moveLeft');
    assert.equal(c.getState().active.x, x - 1);
    advance(179);
    assert.equal(c.getState().active.x, x - 1);
    advance(1);
    assert.equal(c.getState().active.x, x - 2);
    advance(54);
    assert.equal(c.getState().active.x, x - 2);
    advance(1);
    assert.equal(c.getState().active.x, x - 3);
    c.release('left');
    advance(500);
    assert.equal(c.getState().active.x, x - 3);
  });
  await t.test('左右同時押しは最後を優先、解除で残る方向を180ms後から再開', () => {
    const { c, advance } = clock();
    const x = c.getState().active.x;
    c.press('left', 'moveLeft');
    c.press('right', 'moveRight');
    advance(180);
    assert.equal(c.getState().active.x, x + 1);
    c.release('right');
    advance(179);
    assert.equal(c.getState().active.x, x + 1);
    advance(1);
    assert.equal(c.getState().active.x, x);
  });
  await t.test('キーボードとpointerの同じ操作を二重反復せず独立して解除', () => {
    const input = createInput();
    const actions = [];
    const emit = a => actions.push(a);
    input.press('key', 'softDrop', 0, emit);
    input.press('pointer', 'softDrop', 0, emit);
    assert.deepEqual(actions, ['softDrop']);
    input.release('key', 20);
    assert.equal(input.nextTime(), 45);
    input.repeat(45, emit);
    input.release('pointer', 46);
    assert.equal(input.nextTime(), Infinity);
    assert.deepEqual(actions, ['softDrop', 'softDrop']);
  });
  await t.test('低い描画頻度でも反復・落下・固定を同じ順番で処理', () => {
    const fast = clock();
    const slow = clock();
    for (const { c } of [fast, slow]) {
      c.press('right', 'moveRight');
      c.press('soft', 'softDrop');
    }
    for (let i = 0; i < 160; i++) fast.advance(10);
    slow.advance(1600);
    assert.deepEqual(slow.c.getState(), fast.c.getState());
    assert(slow.c.getState().pieces > 0);
  });
  await t.test('回転とhardDropは保持中1回、解除後の再押下だけ再発火', () => {
    const { c, advance } = clock();
    c.press('drop', 'hardDrop');
    advance(250);
    c.press('drop', 'hardDrop');
    assert.equal(c.getState().pieces, 1);
    const before = c.getState().active.matrix;
    c.press('rotate', 'rotateRight');
    const rotated = c.getState().active.matrix;
    assert.notDeepEqual(rotated, before);
    advance(200);
    c.press('rotate', 'rotateRight');
    assert.deepEqual(c.getState().active.matrix, rotated);
    c.release('drop');
    c.press('drop', 'hardDrop');
    assert.equal(c.getState().pieces, 2);
  });
  await t.test('pause・restart・明示解除後は保持入力が再開しない', () => {
    for (const action of ['pause', 'restart', 'clear']) {
      const { c, advance } = clock();
      c.press('left', 'moveLeft');
      if (action === 'clear') c.clearInput();
      else c.dispatch(action);
      if (action === 'pause') {
        const before = c.getState();
        advance(10000);
        assert.deepEqual(c.getState(), before);
        c.dispatch('start');
      }
      const x = c.getState().active.x;
      advance(400);
      assert.equal(c.getState().active.x, x);
    }
  });
  await t.test('接地の299msでは未固定、300msで固定、次のピースへ時間を持ち越す', () => {
    const s = floor();
    assert.equal(s.rulesId, RULES_ID);
    const before = act(s, 'tick', 299);
    assert.equal(before.pieces, 0);
    const locked = act(before, 'tick', 1);
    assert.equal(locked.pieces, 1);
    assert.equal(locked.lockElapsedMs, 0);
    assert.equal(locked.lockResets, 0);
    assert.equal(s.lockElapsedMs, 0);
    assert.deepEqual(act(s, 'tick', 1100), act(locked, 'tick', 800));
  });
  await t.test('自然落下で着地した瞬間から300msを数える', () => {
    const s = { ...floor(), active: { ...floor().active, y: 17 } };
    const landed = act(s, 'tick', 800);
    assert.equal(landed.active.y, 18);
    assert.equal(landed.lockElapsedMs, 0);
    assert.equal(act(landed, 'tick', 299).pieces, 0);
    assert.equal(act(landed, 'tick', 300).pieces, 1);
  });
  await t.test('成功した接地移動は8回まで延長、9回目と失敗では延長しない', () => {
    let s = floor();
    for (let i = 0; i < 8; i++) {
      s = act(s, 'tick', 299);
      s = act(s, i % 2 ? 'moveLeft' : 'moveRight');
      assert.equal(s.lockElapsedMs, 0);
      assert.equal(s.lockResets, i + 1);
    }
    s = act(s, 'tick', 299);
    s = act(s, 'moveLeft');
    assert.equal(s.lockElapsedMs, 299);
    assert.equal(act(s, 'tick', 1).pieces, 1);
    const wall = act({ ...floor(), active: { ...floor().active, x: 0 } }, 'tick', 299);
    assert.strictEqual(act(wall, 'moveLeft'), wall);
    assert.strictEqual(act(wall, 'rotateRight'), wall); // O does not rotate.
    assert.equal(act(wall, 'tick', 1).pieces, 1);
  });
  await t.test('接地回転の成功と失敗、空中では残る猶予を停止して無限リセットを防ぐ', () => {
    const board = createBoard();
    board[18][4] = 'J';
    let s = { ...floor(), board,
      active: { type: 'T', matrix: createPiece('T'), x: 3, y: 16 } };
    s = act(s, 'tick', 200);
    const rotated = act(s, 'rotateRight');
    assert.equal(rotated.lockResets, 1);
    assert.equal(rotated.lockElapsedMs, 0);
    const failed = { ...floor(), active: { type: 'T', matrix: createPiece('T'), x: 3, y: 18 }, lockElapsedMs: 299 };
    assert.strictEqual(act(failed, 'rotateRight'), failed);
    assert.equal(act(failed, 'tick', 1).pieces, 1);
    const ledge = createBoard();
    ledge[18][4] = 'J';
    const onLedge = { ...floor(), board: ledge, active: { ...floor().active, y: 16 }, lockElapsedMs: 200, lockResets: 8 };
    const airborne = act(onLedge, 'moveRight');
    assert.equal(act(airborne, 'tick', 100).lockElapsedMs, 200);
    const returned = act(act(airborne, 'tick', 100), 'moveLeft');
    assert.equal(act(returned, 'tick', 100).pieces, 1);
  });
  await t.test('pause中の固定猶予停止、softDropで延長しない、hardDropは即固定', () => {
    const s = act(floor(), 'tick', 299);
    const paused = act(s, 'pause');
    assert.strictEqual(act(paused, 'tick', 10000), paused);
    assert.equal(act(act(paused, 'start'), 'tick', 1).pieces, 1);
    assert.equal(act(act(s, 'softDrop'), 'tick', 1).pieces, 1);
    assert.equal(act(s, 'hardDrop').pieces, 1);
  });
  await t.test('固定猶予満了でも行消去後に達成・出現衝突を判定', () => {
    const board = createBoard();
    board[0][4] = 'J';
    board[19].fill('Z');
    board[19][4] = board[19][5] = null;
    const won = act({ ...floor(), board, lines: 19 }, 'tick', 1000);
    assert.equal(won.status, 'won');
    assert.equal(won.elapsedMs, 300);
    assert.equal(won.lines, 20);
    assert.equal(won.active, null);
  });
});
