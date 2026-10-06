import './styles.css';
import { BOARD_WIDTH, BOARD_HEIGHT, TARGET_LINES, RULES_ID, createPiece, getGhostY } from './game.js';
import { createController } from './controller.js';
import { createRecords, recordKey } from './records.js';
import { DAILY_RECORDS_ID, japanDate, dailyChallenge, challengeFromUrl, challengeUrl } from './challenge.js';

const COLORS = {
  I: '#62d9e7', J: '#7a9cf3', L: '#f6b76d', O: '#f7d96b',
  S: '#80d9a9', T: '#c99cf0', Z: '#f28b93',
};
const root = document.querySelector('#root');
root.innerHTML = `
  <div class="app-shell">
    <header class="site-header">
      <a class="brand" href="./" aria-label="BLOCK SPRINT ホーム"><span class="brand-mark" aria-hidden="true">▦</span> BLOCK SPRINT</a>
      <span class="header-note">ひとりで、20ライン。</span>
    </header>
    <main class="game-layout">
      <section class="intro-panel" aria-labelledby="game-title">
        <span class="eyebrow"><span class="live-dot"></span> 20 LINE CHALLENGE</span>
        <h1 id="game-title">積んで、消して。<br><span>ゴールまで。</span></h1>
        <p class="intro-copy">ブロックを揃えて20ラインを消そう。<br>自分のペースで、最速を目指す。</p>
        <section class="challenge-card" aria-label="遊ぶモード">
          <div class="mode-buttons">
            <button id="normal-mode" class="secondary-button" aria-pressed="true">通常</button>
            <button id="daily-mode" class="secondary-button" aria-pressed="false">今日の20ライン</button>
          </div>
          <p id="challenge-label"></p>
          <p id="challenge-detail" class="record-detail"></p>
          <p id="day-notice" role="status" class="record-detail"></p>
          <button id="refresh-day" class="secondary-button" hidden>今日の挑戦へ更新</button>
        </section>
        <div class="mission-card">
          <span class="small-label">今回の目標</span>
          <p><strong>20</strong><span>ライン消去</span></p>
          <span class="mission-detail">上まで積み上がるとゲーム終了</span>
        </div>
        <div class="keyboard-help" id="instructions">
          <h2>キーボード</h2>
          <dl>
            <div><dt><kbd>←</kbd> <kbd>→</kbd></dt><dd>移動</dd></div>
            <div><dt><kbd>Space</kbd> <kbd>X</kbd> / <kbd>Z</kbd></dt><dd>右 / 左回転</dd></div>
            <div><dt><kbd>↓</kbd></dt><dd>ソフトドロップ</dd></div>
            <div><dt><kbd>↑</kbd></dt><dd>ハードドロップ</dd></div>
            <div><dt><kbd>P</kbd> / <kbd>Esc</kbd></dt><dd>一時停止 / 続ける</dd></div>
            <div><dt><kbd>Enter</kbd></dt><dd>開始 / 終了後に再開</dd></div>
          </dl>
        </div>
      </section>
      <section class="board-panel" aria-label="ゲーム盤面">
        <div class="board-topline"><span id="status-label" role="status" aria-live="polite">準備完了</span><span class="time-readout" id="time">00:00.0</span></div>
        <div class="board-frame">
          <canvas id="board" width="300" height="600" tabindex="0" role="img" aria-label="10列20行の盤面。淡い枠は落下位置のガイド。" aria-describedby="instructions"></canvas>
          <div class="board-overlay" id="overlay">
            <span class="overlay-icon" id="overlay-icon" aria-hidden="true">▶</span>
            <h2 id="overlay-title">準備はいい？</h2>
            <p id="overlay-message">スタートで、タイマー開始。</p>
            <button id="overlay-action" class="primary-button">スタート</button>
          </div>
        </div>
        <div class="board-caption"><span class="ghost-key" aria-hidden="true"></span> 淡い枠が着地点。↑で一気に落下。</div>
      </section>
      <aside class="side-panel" aria-label="進行と操作">
        <section class="progress-card">
          <h2 class="small-label">LINES</h2>
          <p class="line-count"><strong id="lines">0</strong><span>/ 20</span></p>
          <progress id="progress" value="0" max="20" aria-label="消去したライン"></progress>
          <p id="remaining" class="remaining">ゴールまで、あと20ライン</p>
          <div class="score-row"><span class="small-label">SCORE</span><strong id="score">0</strong></div>
        </section>
        <section class="next-card">
          <h2 class="small-label">NEXT <span>次の3個</span></h2>
          <canvas id="next" width="150" height="210" role="img" aria-label="次のピース3個"></canvas>
        </section>
        <div class="session-actions">
          <button id="session-action" class="primary-button">スタート</button>
          <button id="restart" class="secondary-button">同じ順番でやり直す</button>
          <button id="new-seed" class="secondary-button">新しい順番で遊ぶ</button>
        </div>
        <p class="seed-note">同じシードは同じ順番<br><span id="seed"></span></p>
      </aside>
      <section class="touch-controls" aria-label="画面ボタン">
        <div class="control-row">
          <button data-action="moveLeft" data-repeat="true" aria-label="左へ移動"><span>←</span>移動</button>
          <button data-action="rotateLeft" aria-label="左に回転"><span>↶</span>左回転</button>
          <button data-action="rotateRight" aria-label="右に回転"><span>↷</span>右回転</button>
          <button data-action="moveRight" data-repeat="true" aria-label="右へ移動"><span>→</span>移動</button>
        </div>
        <div class="control-row drop-controls">
          <button data-action="softDrop" data-repeat="true"><span>↓</span>ソフトドロップ</button>
          <button data-action="hardDrop" class="drop-button"><span>⇓</span>ハードドロップ</button>
        </div>
      </section>
      <section class="records-card" aria-label="端末内の自己ベスト">
        <h2 class="small-label">自己ベスト</h2>
        <p id="overall-row">全体 <strong id="best-overall">—</strong></p>
        <p><span id="seed-best-label">この順番</span> <strong id="best-seed">—</strong></p>
        <p id="records-detail" class="record-detail"></p>
        <p id="record-status" role="status" class="record-detail"></p>
        <button id="clear-records" class="secondary-button">記録を削除</button>
        <span id="clear-confirm" hidden><button id="confirm-clear" class="secondary-button">削除する</button><button id="cancel-clear" class="secondary-button">やめる</button></span>
      </section>
    </main>
    <footer>10 × 20 · 7-BAG · OFFLINE <span>水平の壁キック / 接地猶予300ms・延長8回まで</span></footer>
  </div>`;

const elements = Object.fromEntries([
  'board', 'next', 'status-label', 'time', 'overlay', 'overlay-icon', 'overlay-title',
  'overlay-message', 'overlay-action', 'session-action', 'restart', 'lines', 'progress',
  'remaining', 'score', 'seed', 'new-seed', 'best-overall', 'best-seed', 'record-status',
  'clear-records', 'clear-confirm', 'confirm-clear', 'cancel-clear',
  'normal-mode', 'daily-mode', 'challenge-label', 'challenge-detail', 'day-notice',
  'refresh-day', 'overall-row', 'seed-best-label', 'records-detail',
].map(id => [id, document.getElementById(id)]));
const boardContext = elements.board.getContext('2d');
const nextContext = elements.next.getContext('2d');
let parameters = new URLSearchParams(location.search);
const randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
let challenge = challengeFromUrl(parameters, randomSeed());
const seed = challenge.seed;
let storage;
try { storage = window.localStorage; } catch { /* The game also works with storage denied. */ }
const normalRecords = createRecords({ storage });
const dailyRecords = createRecords({ storage, key: recordKey(DAILY_RECORDS_ID) });
let records = challenge.mode === 'daily' ? dailyRecords : normalRecords;
let recordNotice = '';
function renderChallenge() {
  const daily = challenge.mode === 'daily';
  elements['normal-mode'].setAttribute('aria-pressed', String(!daily));
  elements['daily-mode'].setAttribute('aria-pressed', String(daily));
  elements['challenge-label'].textContent = daily ? `${challenge.day} の20ライン` : '通常の20ライン';
  elements['challenge-detail'].textContent = daily
    ? `日本時間の毎日0:00に更新 · ルール ${RULES_ID}。日付は端末の時計から決まります。`
    : '好きな順番で練習。モードを切り替えると盤面をリセットします。';
  elements['new-seed'].hidden = daily;
  elements['overall-row'].hidden = daily;
  elements['seed-best-label'].textContent = daily ? '挑戦日のベスト' : 'この順番';
  elements['records-detail'].textContent = daily
    ? 'この端末・この挑戦日だけの完走記録。通常の記録とは別に保存します。削除は日替わりの全日付が対象です。'
    : '全体は異なる出現順を含みます。この端末・同じルール内の完走だけ。削除は通常の記録が対象です。';
  elements.seed.textContent = challenge.seed;
  elements.seed.title = challenge.seed;
  parameters = challengeUrl(parameters, challenge);
  history.replaceState(null, '', `${location.pathname}?${parameters}${location.hash}`);
  renderDayNotice();
}
let observedDay = '';
function renderDayNotice() {
  const today = japanDate();
  observedDay = today;
  const changed = challenge.mode === 'daily' && challenge.day !== today;
  elements['day-notice'].textContent = changed
    ? `端末の現在日は${today}（日本時間）。この挑戦は${challenge.day}のままです。更新すると盤面をリセットします。` : '';
  elements['refresh-day'].hidden = !changed;
}
renderChallenge();
function renderRecords(currentSeed) {
  const saved = records.get(currentSeed);
  elements['best-overall'].textContent = saved.overall ? formatTime(saved.overall.elapsedMs) : '—';
  elements['best-seed'].textContent = saved.seedBest ? formatTime(saved.seedBest.elapsedMs) : '—';
  elements['record-status'].textContent = saved.warning || recordNotice;
}

function formatTime(milliseconds) {
  const tenths = Math.floor(milliseconds / 100);
  return `${String(Math.floor(tenths / 600)).padStart(2, '0')}:${String(Math.floor(tenths / 10) % 60).padStart(2, '0')}.${tenths % 10}`;
}

function cell(context, x, y, size, color, ghost = false) {
  context.save();
  context.beginPath();
  context.roundRect(x + 1.5, y + 1.5, size - 3, size - 3, 3);
  if (ghost) {
    context.globalAlpha = 0.55;
    context.strokeStyle = color;
    context.lineWidth = 1.5;
    context.stroke();
  } else {
    context.fillStyle = color;
    context.fill();
    context.fillStyle = '#ffffff44';
    context.fillRect(x + 5, y + 5, size - 10, 2);
  }
  context.restore();
}

function drawPiece(context, piece, y, ghost = false) {
  piece.matrix.forEach((row, dy) => row.forEach((filled, dx) => {
    if (filled) cell(context, (piece.x + dx) * 30, (y + dy) * 30, 30, COLORS[piece.type], ghost);
  }));
}

function drawBoard(state) {
  boardContext.fillStyle = '#0a1220';
  boardContext.fillRect(0, 0, 300, 600);
  boardContext.strokeStyle = '#ffffff08';
  boardContext.lineWidth = 1;
  for (let x = 1; x < BOARD_WIDTH; x++) {
    boardContext.beginPath();
    boardContext.moveTo(x * 30, 0);
    boardContext.lineTo(x * 30, 600);
    boardContext.stroke();
  }
  for (let y = 1; y < BOARD_HEIGHT; y++) {
    boardContext.beginPath();
    boardContext.moveTo(0, y * 30);
    boardContext.lineTo(300, y * 30);
    boardContext.stroke();
  }
  state.board.forEach((row, y) => row.forEach((type, x) => {
    if (type) cell(boardContext, x * 30, y * 30, 30, COLORS[type]);
  }));
  if (state.active && state.status !== 'lost') {
    const ghostY = getGhostY(state);
    if (ghostY !== null) drawPiece(boardContext, state.active, ghostY, true);
    drawPiece(boardContext, state.active, state.active.y);
  }
}

function drawNext(state) {
  nextContext.clearRect(0, 0, 150, 210);
  state.next.forEach((type, index) => {
    const matrix = createPiece(type);
    const occupied = matrix.flatMap((row, y) => row.flatMap((value, x) => value ? [{ x, y }] : []));
    const minX = Math.min(...occupied.map(value => value.x));
    const maxX = Math.max(...occupied.map(value => value.x));
    const minY = Math.min(...occupied.map(value => value.y));
    const maxY = Math.max(...occupied.map(value => value.y));
    const offsetX = (150 - (maxX - minX + 1) * 22) / 2;
    const offsetY = index * 70 + (70 - (maxY - minY + 1) * 22) / 2;
    occupied.forEach(({ x, y }) => cell(nextContext, offsetX + (x - minX) * 22,
      offsetY + (y - minY) * 22, 22, COLORS[type]));
  });
  elements.next.setAttribute('aria-label', `次のピース: ${state.next.join('、')}`);
}

const STATUS = { ready: '準備完了', playing: 'プレイ中', paused: '一時停止', won: '20ライン達成！', lost: 'ゲーム終了' };
let previousNext = '';
let previousStatus = '';
function render(state) {
  if (previousStatus !== state.status) {
    if (state.status === 'won') {
      recordNotice = records.complete(state) ? '自己ベスト更新！' : '完走を記録しました。';
    } else if (state.status === 'playing') recordNotice = '';
    elements['clear-confirm'].hidden = true;
    elements['clear-records'].hidden = false;
    renderRecords(state.seed);
  }
  drawBoard(state);
  const nextKey = state.next.join('');
  if (nextKey !== previousNext) {
    drawNext(state);
    previousNext = nextKey;
  }
  elements.time.textContent = formatTime(state.elapsedMs);
  elements.lines.textContent = state.lines;
  elements.progress.value = Math.min(state.lines, TARGET_LINES);
  elements.remaining.textContent = state.status === 'won' ? 'ゴール！ おつかれさま。' : `ゴールまで、あと${Math.max(0, TARGET_LINES - state.lines)}ライン`;
  elements.score.textContent = state.score.toLocaleString('ja-JP');
  if (previousStatus !== state.status) {
    const buttonText = { ready: 'スタート', playing: '一時停止', paused: '続ける', won: 'もう一度', lost: 'もう一度' }[state.status];
    elements['session-action'].textContent = buttonText;
    elements['overlay-action'].textContent = buttonText;
    elements['status-label'].textContent = STATUS[state.status];
    elements.overlay.hidden = state.status === 'playing';
    previousStatus = state.status;
  }
  const overlay = {
    ready: ['▶', '準備はいい？', 'スタートで、タイマー開始。'],
    paused: ['Ⅱ', 'ひとやすみ。', 'タイマーと落下は止まっています。'],
    won: ['✦', 'SPRINT CLEAR', `${formatTime(state.elapsedMs)} で20ライン達成！`],
    lost: ['↻', 'GAME OVER', `${state.lines}ライン / ${formatTime(state.elapsedMs)}。もう一度挑戦しよう。`],
  }[state.status];
  if (overlay) {
    elements['overlay-icon'].textContent = overlay[0];
    elements['overlay-title'].textContent = overlay[1];
    elements['overlay-message'].textContent = overlay[2];
  }
}

export const controller = createController({ seed, onChange: render });
render(controller.getState());
function changeChallenge(next) {
  // Finish clock synchronization with the old mode before changing its record store.
  if (controller.getState().status === 'playing') controller.dispatch('pause');
  challenge = next;
  records = challenge.mode === 'daily' ? dailyRecords : normalRecords;
  recordNotice = '';
  renderChallenge();
  controller.dispatch('restart', { seed: challenge.seed });
  renderRecords(challenge.seed);
  elements.board.focus({ preventScroll: true });
}
elements['daily-mode'].addEventListener('click', () => {
  if (challenge.mode !== 'daily') changeChallenge(dailyChallenge());
});
elements['normal-mode'].addEventListener('click', () => {
  if (challenge.mode !== 'normal') changeChallenge({ mode: 'normal', seed: randomSeed() });
});
elements['refresh-day'].addEventListener('click', () => changeChallenge(dailyChallenge()));
function sessionAction() {
  const { status } = controller.getState();
  controller.dispatch(status === 'playing' ? 'pause' : ['won', 'lost'].includes(status) ? 'restart' : 'start');
  if (controller.getState().status === 'playing') elements.board.focus({ preventScroll: true });
}
elements['session-action'].addEventListener('click', sessionAction);
elements['overlay-action'].addEventListener('click', sessionAction);
elements.restart.addEventListener('click', () => {
  controller.dispatch('restart');
  elements.board.focus({ preventScroll: true });
});

const KEY_ACTIONS = {
  ArrowLeft: 'moveLeft', ArrowRight: 'moveRight', ArrowDown: 'softDrop',
  Space: 'rotateRight', KeyX: 'rotateRight', KeyW: 'rotateRight',
  KeyZ: 'rotateLeft', KeyQ: 'rotateLeft', ArrowUp: 'hardDrop',
  KeyP: 'pause', Escape: 'pause', KeyR: 'restart',
};
window.addEventListener('keydown', event => {
  if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
  if (event.target.closest('button') && ['Enter', 'Space'].includes(event.code)) return;
  if (event.code === 'Enter') {
    event.preventDefault();
    if (!event.repeat && controller.getState().status !== 'playing') sessionAction();
    return;
  }
  const action = KEY_ACTIONS[event.code];
  if (!action) return;
  event.preventDefault();
  if (event.repeat) return;
  if (['pause', 'restart'].includes(action)) controller.dispatch(action);
  else controller.press(`key:${event.code}`, action);
});
elements['new-seed'].addEventListener('click', () => {
  const previousSeed = controller.getState().seed;
  const generated = randomSeed();
  const nextSeed = generated === previousSeed ? `${generated}-new` : generated;
  changeChallenge({ mode: 'normal', seed: nextSeed });
});
elements['clear-records'].addEventListener('click', () => {
  if (controller.getState().status === 'playing') controller.dispatch('pause');
  elements['clear-confirm'].hidden = false;
  elements['clear-records'].hidden = true;
  elements['confirm-clear'].focus();
});
elements['cancel-clear'].addEventListener('click', () => {
  elements['clear-confirm'].hidden = true;
  elements['clear-records'].hidden = false;
  elements['clear-records'].focus();
});
elements['confirm-clear'].addEventListener('click', () => {
  records.clear();
  recordNotice = '記録を削除しました。';
  renderRecords(controller.getState().seed);
  elements['clear-confirm'].hidden = true;
  elements['clear-records'].hidden = false;
  elements['clear-records'].focus();
});
window.addEventListener('keyup', event => controller.release(`key:${event.code}`));

for (const button of root.querySelectorAll('[data-action]')) {
  button.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    controller.press(`pointer:${event.pointerId}`, button.dataset.action);
  });
  button.addEventListener('click', event => {
    if (event.detail === 0) controller.dispatch(button.dataset.action);
  });
  const release = event => controller.release(`pointer:${event.pointerId}`);
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', release);
  button.addEventListener('pointermove', event => {
    const bounds = button.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom) release(event);
  });
}
function pauseWhenAway() {
  controller.clearInput();
  if (controller.getState().status === 'playing') controller.dispatch('pause');
}
window.addEventListener('blur', pauseWhenAway);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseWhenAway();
});
function frame(timestamp) {
  controller.tick(timestamp);
  if (japanDate() !== observedDay) renderDayNotice();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

