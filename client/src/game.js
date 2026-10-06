export const BOARD_WIDTH = 10;
export const BOARD_HEIGHT = 20;
export const TARGET_LINES = 20;
export const DROP_INTERVAL_MS = 800;
export const RULES_ID = 'sprint-20-lock300-v1';
export const LOCK_DELAY_MS = 300;
export const MAX_LOCK_RESETS = 8;
export const PIECE_TYPES = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];

const SHAPES = {
  I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
  J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
  L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
  O: [[1, 1], [1, 1]],
  S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
  T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
  Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
};

export function createBoard() {
  return Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(null));
}

export function createPiece(type) {
  if (!SHAPES[type]) throw new Error(`Unknown piece: ${type}`);
  return SHAPES[type].map(row => [...row]);
}

export function rotateMatrix(matrix, direction = 1) {
  const size = matrix.length;
  return Array.from({ length: size }, (_, y) => Array.from({ length: size }, (_, x) =>
    direction > 0 ? matrix[size - 1 - x][y] : matrix[x][size - 1 - y]));
}

export function collides(board, piece, x = piece.x, y = piece.y, matrix = piece.matrix) {
  return matrix.some((row, dy) => row.some((filled, dx) => filled && (
    x + dx < 0 || x + dx >= BOARD_WIDTH || y + dy < 0 ||
    y + dy >= BOARD_HEIGHT || board[y + dy][x + dx] !== null
  )));
}

export function clearLines(board) {
  const remaining = board.filter(row => row.some(cell => cell === null));
  const count = BOARD_HEIGHT - remaining.length;
  return {
    board: [...Array.from({ length: count }, () => Array(BOARD_WIDTH).fill(null)),
      ...remaining.map(row => [...row])],
    count,
  };
}

function hashSeed(seed) {
  let hash = 2166136261;
  for (const character of String(seed)) {
    hash = Math.imul(hash ^ character.codePointAt(0), 16777619);
  }
  return hash >>> 0 || 1;
}

function random(state) {
  let value = state.randomState;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  state.randomState = value >>> 0;
  return state.randomState / 4294967296;
}

function takePiece(state) {
  if (!state.bag.length) {
    state.bag = [...PIECE_TYPES];
    for (let i = state.bag.length - 1; i > 0; i--) {
      const j = Math.floor(random(state) * (i + 1));
      [state.bag[i], state.bag[j]] = [state.bag[j], state.bag[i]];
    }
  }
  return state.bag.shift();
}

function spawn(type) {
  const matrix = createPiece(type);
  return { type, matrix, x: Math.floor((BOARD_WIDTH - matrix.length) / 2), y: 0 };
}

export function createGame(seed = 'sprint') {
  const state = {
    seed: String(seed), status: 'ready', board: createBoard(), active: null,
    next: [], bag: [], randomState: hashSeed(seed), lines: 0, score: 0,
    elapsedMs: 0, dropElapsedMs: 0, pieces: 0, lastClear: 0,
    rulesId: RULES_ID, lockElapsedMs: 0, lockResets: 0,
  };
  state.active = spawn(takePiece(state));
  state.next = Array.from({ length: 3 }, () => takePiece(state));
  return state;
}

export function getGhostY(state) {
  if (!state.active || collides(state.board, state.active)) return null;
  let y = state.active.y;
  while (!collides(state.board, state.active, state.active.x, y + 1)) y++;
  return y;
}

function lockPiece(state) {
  const board = state.board.map(row => [...row]);
  state.active.matrix.forEach((row, dy) => row.forEach((filled, dx) => {
    if (filled) board[state.active.y + dy][state.active.x + dx] = state.active.type;
  }));
  const cleared = clearLines(board);
  state.board = cleared.board;
  state.lines += cleared.count;
  state.lastClear = cleared.count;
  state.score += [0, 100, 300, 500, 800][cleared.count];
  state.pieces++;
  state.dropElapsedMs = 0;
  state.lockElapsedMs = 0;
  state.lockResets = 0;
  if (state.lines >= TARGET_LINES) {
    state.status = 'won';
    state.active = null;
    return;
  }
  state.active = spawn(state.next.shift());
  state.next.push(takePiece(state));
  if (collides(state.board, state.active)) state.status = 'lost';
}

function fall(state, soft = false) {
  if (collides(state.board, state.active, state.active.x, state.active.y + 1)) {
    return;
  } else {
    state.active = { ...state.active, y: state.active.y + 1 };
    if (soft) state.score++;
  }
}

// Actions return a new state; the previous state and its board remain unchanged.
export function updateGame(previous, action) {
  const { type } = action;
  if (type === 'restart') return { ...createGame(previous.seed), status: 'playing' };
  if (type === 'start' && ['ready', 'paused'].includes(previous.status)) {
    return { ...previous, status: 'playing' };
  }
  if (type === 'pause' && ['playing', 'paused'].includes(previous.status)) {
    return { ...previous, status: previous.status === 'playing' ? 'paused' : 'playing' };
  }
  if (previous.status !== 'playing') return previous;
  const state = { ...previous, next: [...previous.next], bag: [...previous.bag] };
  const wasGrounded = collides(state.board, state.active, state.active.x, state.active.y + 1);
  switch (type) {
    case 'moveLeft':
    case 'moveRight': {
      const x = state.active.x + (type === 'moveLeft' ? -1 : 1);
      if (collides(state.board, state.active, x)) return previous;
      state.active = { ...state.active, x };
      if (wasGrounded && state.lockResets < MAX_LOCK_RESETS) {
        state.lockElapsedMs = 0;
        state.lockResets++;
      }
      break;
    }
    case 'rotateLeft':
    case 'rotateRight': {
      if (state.active.type === 'O') return previous;
      const matrix = rotateMatrix(state.active.matrix, type === 'rotateRight' ? 1 : -1);
      const offset = [0, -1, 1, -2, 2].find(dx =>
        !collides(state.board, state.active, state.active.x + dx, state.active.y, matrix));
      if (offset === undefined) return previous;
      state.active = { ...state.active, x: state.active.x + offset, matrix };
      if (wasGrounded && state.lockResets < MAX_LOCK_RESETS) {
        state.lockElapsedMs = 0;
        state.lockResets++;
      }
      break;
    }
    case 'softDrop':
      fall(state, true);
      state.dropElapsedMs = 0;
      break;
    case 'hardDrop': {
      const y = getGhostY(state);
      state.score += (y - state.active.y) * 2;
      state.active = { ...state.active, y };
      lockPiece(state);
      break;
    }
    case 'tick': {
      let remaining = action.deltaMs;
      if (!Number.isFinite(remaining) || remaining <= 0) return previous;
      while (remaining > 0 && state.status === 'playing') {
        const grounded = collides(state.board, state.active, state.active.x, state.active.y + 1);
        const advance = Math.min(remaining, DROP_INTERVAL_MS - state.dropElapsedMs,
          grounded ? LOCK_DELAY_MS - state.lockElapsedMs : Infinity);
        state.elapsedMs += advance;
        state.dropElapsedMs += advance;
        if (grounded) state.lockElapsedMs += advance;
        remaining -= advance;
        if (grounded && state.lockElapsedMs >= LOCK_DELAY_MS) {
          lockPiece(state);
        } else if (state.dropElapsedMs >= DROP_INTERVAL_MS) {
          state.dropElapsedMs = 0;
          fall(state);
        }
      }
      break;
    }
    default:
      return previous;
  }
  return state;
}
