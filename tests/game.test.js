const test = require('node:test');
const assert = require('node:assert/strict');

// Import the actual browser modules; no renderer or replacement test engine is used.
test('20ライン・スプリントの規則', async t => {
  const {
    BOARD_WIDTH, BOARD_HEIGHT, DROP_INTERVAL_MS, PIECE_TYPES, createBoard,
    createPiece, rotateMatrix, collides, clearLines, createGame, updateGame, getGhostY,
  } = await import('../client/src/game.js');
  const { createController } = await import('../client/src/controller.js');
  const play = (seed = 'test') => updateGame(createGame(seed), { type: 'start' });
  const act = (state, type, extra = {}) => updateGame(state, { type, ...extra });
  const piece = (type, x, y, matrix = createPiece(type)) => ({ type, x, y, matrix });

  await t.test('盤面、出現、NEXTと開始前の停止', () => {
    const state = createGame('first');
    assert.equal(state.board.length, BOARD_HEIGHT);
    assert.ok(state.board.every(row => row.length === BOARD_WIDTH && row.every(cell => cell === null)));
    assert.equal(state.next.length, 3);
    assert.equal(state.status, 'ready');
    assert.equal(collides(state.board, state.active), false);
    assert.strictEqual(act(state, 'tick', { deltaMs: 10000 }), state);
    assert.strictEqual(act(state, 'hardDrop'), state);
    assert.equal(act(state, 'start').status, 'playing');
  });

  await t.test('同じseedから再現可能な7-bagを4袋分検証', () => {
    function sequence(seed) {
      let state = play(seed);
      const result = [];
      for (let index = 0; index < 28; index++) {
        result.push(state.active.type);
        state = act({ ...state, board: createBoard() }, 'hardDrop');
      }
      return result;
    }
    const first = sequence('replay-2026');
    assert.deepEqual(first, sequence('replay-2026'));
    assert.notDeepEqual(first, sequence('different-seed'));
    for (let i = 0; i < first.length; i += 7) {
      assert.deepEqual(first.slice(i, i + 7).sort(), [...PIECE_TYPES].sort());
    }
  });

  await t.test('左右端・床・固定ブロックの衝突と空白セル', () => {
    const board = createBoard();
    assert.equal(collides(board, piece('O', -1, 0)), true);
    assert.equal(collides(board, piece('O', 9, 0)), true);
    assert.equal(collides(board, piece('O', 0, 19)), true);
    assert.equal(collides(board, piece('O', 0, -1)), true);
    assert.equal(collides(board, piece('O', 8, 18)), false);
    board[1][0] = 'Z';
    assert.equal(collides(board, piece('O', 0, 0)), true);
    board[1][0] = null;
    board[0][0] = 'Z';
    assert.equal(collides(board, piece('I', 0, 0)), false);
  });

  await t.test('移動の壁止めと元状態の保護', () => {
    const state = { ...play(), active: piece('O', 0, 0) };
    assert.strictEqual(act(state, 'moveLeft'), state);
    const moved = act(state, 'moveRight');
    assert.equal(moved.active.x, 1);
    assert.equal(state.active.x, 0);
    assert.deepEqual(state.board, createBoard());
  });

  await t.test('左右回転、4回転の復元、Oの不変', () => {
    const matrix = createPiece('T');
    assert.deepEqual(rotateMatrix(rotateMatrix(matrix, 1), -1), matrix);
    assert.deepEqual(matrix, createPiece('T'));
    let state = { ...play(), active: piece('T', 3, 4) };
    for (let index = 0; index < 4; index++) state = act(state, 'rotateRight');
    assert.deepEqual(state.active, piece('T', 3, 4));
    const square = { ...play(), active: piece('O', 4, 2) };
    assert.strictEqual(act(square, 'rotateLeft'), square);
  });

  await t.test('Iの水平壁キックと床で回転できない場合の復元', () => {
    const vertical = rotateMatrix(createPiece('I'));
    const state = { ...play(), active: piece('I', -2, 3, vertical) };
    assert.equal(collides(state.board, state.active), false);
    const rotated = act(state, 'rotateRight');
    assert.equal(rotated.active.x, 0);
    assert.equal(collides(rotated.board, rotated.active), false);
    const floor = { ...play(), active: piece('T', 3, 18) };
    assert.strictEqual(act(floor, 'rotateRight'), floor);
  });

  await t.test('固定ブロックで全キック先が塞がる回転はキャンセル', () => {
    const board = createBoard();
    board[6].fill('Z');
    const state = { ...play(), board, active: piece('T', 3, 4) };
    assert.equal(collides(board, state.active), false);
    assert.strictEqual(act(state, 'rotateRight'), state);
  });

  await t.test('最上段と連続する複数行を消し、残る行を保持', () => {
    const board = createBoard();
    board[0].fill('I');
    board[18].fill('J');
    board[19].fill('L');
    board[1][2] = 'T';
    const before = structuredClone(board);
    const cleared = clearLines(board);
    assert.equal(cleared.count, 3);
    assert.equal(cleared.board.length, 20);
    assert.equal(cleared.board[3][2], 'T');
    assert.deepEqual(cleared.board.slice(0, 3), createBoard().slice(0, 3));
    assert.deepEqual(board, before);
  });

  await t.test('空きがある行は消去しない', () => {
    const board = createBoard();
    board[19].fill('I');
    board[19][9] = null;
    assert.deepEqual(clearLines(board), { board, count: 0 });
  });

  await t.test('ゴーストとハードドロップは同じ着地点に固定', () => {
    const state = { ...play(), active: piece('O', 4, 0) };
    assert.equal(getGhostY(state), 18);
    const dropped = act(state, 'hardDrop');
    assert.equal(dropped.pieces, 1);
    assert.equal(dropped.score, 36);
    assert.equal(dropped.board[18][4], 'O');
    assert.equal(dropped.board[19][5], 'O');
    assert.equal(dropped.active.type, state.next[0]);
    assert.equal(dropped.next.length, 3);
    assert.deepEqual(state.board, createBoard());
  });

  await t.test('ゴーストは固定ブロックの上で止まる', () => {
    const board = createBoard();
    board[12][4] = 'T';
    const state = { ...play(), board, active: piece('O', 4, 0) };
    assert.equal(getGhostY(state), 10);
    assert.equal(act(state, 'hardDrop').board[11][4], 'O');
  });

  await t.test('ソフトドロップは接地猶予を短縮せず加点する', () => {
    const state = { ...play(), active: piece('O', 4, 17), dropElapsedMs: 700 };
    const moved = act(state, 'softDrop');
    assert.equal(moved.active.y, 18);
    assert.equal(moved.score, 1);
    assert.equal(moved.dropElapsedMs, 0);
    const touching = act(moved, 'softDrop');
    assert.equal(touching.pieces, 0);
    const locked = act(touching, 'tick', { deltaMs: 300 });
    assert.equal(locked.pieces, 1);
    assert.equal(locked.score, 1);
  });

  await t.test('行消去の得点（1〜4行）と累積ライン', () => {
    for (let count = 1; count <= 4; count++) {
      const board = createBoard();
      for (let y = 20 - count; y < 20; y++) {
        board[y].fill('J');
        board[y][4] = null;
      }
      const active = piece('I', 2, 16, rotateMatrix(createPiece('I')));
      const state = { ...play(), board, active, lines: 5 };
      const cleared = act(state, 'hardDrop');
      assert.equal(cleared.lines, 5 + count);
      assert.equal(cleared.score, [0, 100, 300, 500, 800][count]);
      assert.equal(cleared.lastClear, count);
    }
  });

  await t.test('最上部の行消去を先に行い、出現衝突を誤判定しない', () => {
    const board = createBoard();
    board[0].fill('J');
    board[1].fill('J');
    for (let y = 0; y < 2; y++) {
      board[y][4] = null;
      board[y][5] = null;
    }
    board[2][4] = 'Z';
    board[2][5] = 'Z';
    const state = { ...play(), board, active: piece('O', 4, 0), next: ['O', 'I', 'T'] };
    const cleared = act(state, 'hardDrop');
    assert.equal(cleared.lines, 2);
    assert.equal(cleared.score, 300);
    assert.equal(cleared.status, 'playing');
    assert.equal(cleared.active.type, 'O');
    assert.equal(collides(cleared.board, cleared.active), false);
    assert.ok(cleared.board[0].every(cell => cell === null));
    assert.ok(cleared.board[1].every(cell => cell === null));
  });

  await t.test('出現領域が埋まった場合は終了し、操作と時計が止まる', () => {
    const board = createBoard();
    board[0][4] = 'J';
    const state = { ...play(), board, active: piece('O', 0, 18), next: ['O', 'I', 'T'] };
    const lost = act(state, 'hardDrop');
    assert.equal(lost.status, 'lost');
    for (const action of ['moveLeft', 'rotateRight', 'hardDrop', 'softDrop', 'pause']) {
      assert.strictEqual(act(lost, action), lost);
    }
    assert.strictEqual(act(lost, 'tick', { deltaMs: 1000 }), lost);
  });

  await t.test('20ライン達成は次の出現より優先し、勝利後は止まる', () => {
    const board = createBoard();
    board[0][4] = 'J';
    board[19].fill('Z');
    board[19][4] = null;
    board[19][5] = null;
    const state = { ...play(), board, active: piece('O', 4, 18), next: ['O', 'I', 'T'], lines: 19 };
    const won = act(state, 'hardDrop');
    assert.equal(won.status, 'won');
    assert.equal(won.lines, 20);
    assert.equal(won.active, null);
    assert.deepEqual(won.next, state.next);
    assert.strictEqual(act(won, 'tick', { deltaMs: 10000 }), won);
    assert.strictEqual(act(won, 'hardDrop'), won);
  });

  await t.test('重力は800ms境界を含み、余剰時間を次の落下へ持ち越す', () => {
    const state = { ...play(), active: piece('O', 4, 0) };
    const before = act(state, 'tick', { deltaMs: DROP_INTERVAL_MS - 1 });
    assert.equal(before.active.y, 0);
    const boundary = act(before, 'tick', { deltaMs: 1 });
    assert.equal(boundary.active.y, 1);
    assert.equal(boundary.dropElapsedMs, 0);
    const longFrame = act(state, 'tick', { deltaMs: 2500 });
    assert.equal(longFrame.active.y, 3);
    assert.equal(longFrame.dropElapsedMs, 100);
    assert.equal(longFrame.elapsedMs, 2500);
    assert.equal(longFrame.score, 0);
  });

  await t.test('1回のtickが終了へ達した時点で余剰時間を数えない', () => {
    const board = createBoard();
    board[0][4] = 'J';
    const state = { ...play(), board, active: piece('O', 0, 18), next: ['O', 'I', 'T'], dropElapsedMs: 700 };
    const lost = act(state, 'tick', { deltaMs: 5000 });
    assert.equal(lost.status, 'lost');
    assert.equal(lost.elapsedMs, 300);
  });

  await t.test('無効なdelta、未知の入力、ポーズ中は状態を変えない', () => {
    const state = play();
    for (const deltaMs of [-1, 0, NaN, Infinity]) {
      assert.strictEqual(act(state, 'tick', { deltaMs }), state);
    }
    assert.strictEqual(act(state, 'unknown'), state);
    const paused = act(state, 'pause');
    assert.equal(paused.status, 'paused');
    for (const type of ['tick', 'moveLeft', 'rotateRight', 'hardDrop']) {
      assert.strictEqual(act(paused, type, { deltaMs: 10000 }), paused);
    }
    assert.equal(act(paused, 'pause').status, 'playing');
  });

  await t.test('再開で全盤面・得点・時計をリセットして同じseedを使う', () => {
    const original = play('same-order');
    const changed = act(act(original, 'hardDrop'), 'tick', { deltaMs: 500 });
    const restarted = act({ ...changed, status: 'lost', lines: 9 }, 'restart');
    assert.deepEqual(restarted, original);
  });

  await t.test('生産controllerの入力時計・ポーズ・再開・snapshot保護', () => {
    let time = 0;
    const events = [];
    const controller = createController({ seed: 'clock', now: () => time, onChange: state => events.push(state.status) });
    time = 10000;
    controller.dispatch('start');
    time += 800;
    controller.tick();
    assert.equal(controller.getState().elapsedMs, 800);
    controller.tick(time - 10);
    controller.tick(time);
    assert.equal(controller.getState().elapsedMs, 800);
    controller.dispatch('pause');
    time += 50000;
    controller.dispatch('start');
    time += 100;
    controller.tick();
    assert.equal(controller.getState().elapsedMs, 900);
    const snapshot = controller.getState();
    snapshot.board[0][0] = 'Z';
    snapshot.active.x = 99;
    assert.equal(controller.getState().board[0][0], null);
    assert.notEqual(controller.getState().active.x, 99);
    controller.dispatch('restart');
    assert.equal(controller.getState().elapsedMs, 0);
    assert.equal(controller.getState().pieces, 0);
    assert.ok(events.includes('paused'));
  });
});

