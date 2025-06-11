const canvas = document.getElementById('tetris');
const context = canvas.getContext('2d');
context.scale(20, 20);

// Remote player canvas
const remoteCanvas = document.getElementById('remote-tetris');
const remoteContext = remoteCanvas.getContext('2d');
remoteContext.scale(20, 20);

const socket = io();

const nextContainer = document.getElementById('next-container');
const nextContexts = [];
for (let i = 0; i < 5; ++i) {
  const c = document.createElement('canvas');
  c.width = 60;
  c.height = 60;
  c.classList.add('next-piece');
  nextContainer.appendChild(c);
  const ctx = c.getContext('2d');
  ctx.scale(15, 15);
  nextContexts.push(ctx);
}

const remoteNextContainer = document.getElementById('remote-next-container');
const remoteNextContexts = [];
for (let i = 0; i < 5; ++i) {
  const c = document.createElement('canvas');
  c.width = 60;
  c.height = 60;
  c.classList.add('next-piece');
  remoteNextContainer.appendChild(c);
  const ctx = c.getContext('2d');
  ctx.scale(15, 15);
  remoteNextContexts.push(ctx);
}

const colors = [
  null,
  '#FF0D72',
  '#0DC2FF',
  '#0DFF72',
  '#F538FF',
  '#FF8E0D',
  '#FFE138',
  '#3877FF',
];

const pieces = 'ILJOTSZ';

function getRandomPiece() {
  return pieces[(pieces.length * Math.random()) | 0];
}

const nextPieces = [];
for (let i = 0; i < 5; ++i) {
  nextPieces.push(getRandomPiece());
}

let remoteNextPieces = [];

function arenaSweep() {
  outer: for (let y = arena.length - 1; y > 0; --y) {
    for (let x = 0; x < arena[y].length; ++x) {
      if (arena[y][x] === 0) {
        continue outer;
      }
    }
    const row = arena.splice(y, 1)[0].fill(0);
    arena.unshift(row);
    ++y;
    player.score += 10;
  }
}

function collide(arena, player) {
  const [m, o] = [player.matrix, player.pos];
  for (let y = 0; y < m.length; ++y) {
    for (let x = 0; x < m[y].length; ++x) {
      if (m[y][x] !== 0 &&
          (arena[y + o.y] &&
           arena[y + o.y][x + o.x]) !== 0) {
        return true;
      }
    }
  }
  return false;
}

function createMatrix(w, h) {
  const matrix = [];
  while (h--) {
    matrix.push(new Array(w).fill(0));
  }
  return matrix;
}

function createPiece(type) {
  switch (type) {
    case 'T':
      return [
        [0, 0, 0],
        [1, 1, 1],
        [0, 1, 0],
      ];
    case 'O':
      return [
        [2, 2],
        [2, 2],
      ];
    case 'L':
      return [
        [0, 3, 0],
        [0, 3, 0],
        [0, 3, 3],
      ];
    case 'J':
      return [
        [0, 4, 0],
        [0, 4, 0],
        [4, 4, 0],
      ];
    case 'I':
      return [
        [0, 5, 0, 0],
        [0, 5, 0, 0],
        [0, 5, 0, 0],
        [0, 5, 0, 0],
      ];
    case 'S':
      return [
        [0, 6, 6],
        [6, 6, 0],
        [0, 0, 0],
      ];
    case 'Z':
      return [
        [7, 7, 0],
        [0, 7, 7],
        [0, 0, 0],
      ];
  }
}

function drawMatrixOn(matrix, offset, ctx) {
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        ctx.fillStyle = colors[value];
        ctx.fillRect(x + offset.x, y + offset.y, 1, 1);
      }
    });
  });
}

function drawMatrix(matrix, offset) {
  drawMatrixOn(matrix, offset, context);
}

function draw() {
  context.fillStyle = '#000';
  context.fillRect(0, 0, canvas.width, canvas.height);

  drawMatrix(arena, {x: 0, y: 0});
  drawMatrix(player.matrix, player.pos);
}

function drawRemote() {
  remoteContext.fillStyle = '#000';
  remoteContext.fillRect(0, 0, remoteCanvas.width, remoteCanvas.height);

  drawMatrixOn(remoteArena, {x: 0, y: 0}, remoteContext);
  drawMatrixOn(remotePlayer.matrix, remotePlayer.pos, remoteContext);
}

function drawNext() {
  nextContexts.forEach((ctx, idx) => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 4, 4);
    const matrix = createPiece(nextPieces[idx]);
    const offX = ((4 - matrix[0].length) / 2) | 0;
    const offY = ((4 - matrix.length) / 2) | 0;
    drawMatrixOn(matrix, {x: offX, y: offY}, ctx);
  });
}

function drawRemoteNext() {
  remoteNextContexts.forEach((ctx, idx) => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 4, 4);
    const matrix = createPiece(remoteNextPieces[idx] || 'I');
    const offX = ((4 - matrix[0].length) / 2) | 0;
    const offY = ((4 - matrix.length) / 2) | 0;
    drawMatrixOn(matrix, {x: offX, y: offY}, ctx);
  });
}

function merge(arena, player) {
  player.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        arena[y + player.pos.y][x + player.pos.x] = value;
      }
    });
  });
}

function rotate(matrix, dir) {
  for (let y = 0; y < matrix.length; ++y) {
    for (let x = 0; x < y; ++x) {
      [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
    }
  }
  if (dir > 0) {
    matrix.forEach(row => row.reverse());
  } else {
    matrix.reverse();
  }
}

function playerDrop() {
  player.pos.y++;
  if (collide(arena, player)) {
    player.pos.y--;
    merge(arena, player);
    playerReset();
    arenaSweep();
    updateScore();
  }
  dropCounter = 0;
}

function playerHardDrop() {
  while (!collide(arena, player)) {
    player.pos.y++;
  }
  player.pos.y--;
  merge(arena, player);
  playerReset();
  arenaSweep();
  updateScore();
  dropCounter = 0;
}

function playerMove(dir) {
  player.pos.x += dir;
  if (collide(arena, player)) {
    player.pos.x -= dir;
  }
}

function playerReset() {
  player.matrix = createPiece(nextPieces.shift());
  nextPieces.push(getRandomPiece());
  player.pos.y = 0;
  player.pos.x = (arena[0].length / 2 | 0) -
                 (player.matrix[0].length / 2 | 0);
  if (collide(arena, player)) {
    arena.forEach(row => row.fill(0));
    player.score = 0;
    updateScore();
  }
}

function playerRotate(dir) {
  const pos = player.pos.x;
  let offset = 1;
  rotate(player.matrix, dir);
  while (collide(arena, player)) {
    player.pos.x += offset;
    offset = -(offset + (offset > 0 ? 1 : -1));
    if (offset > player.matrix[0].length) {
      rotate(player.matrix, -dir);
      player.pos.x = pos;
      return;
    }
  }
}

document.addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft') {
    playerMove(-1);
  } else if (event.key === 'ArrowRight') {
    playerMove(1);
  } else if (event.key === 'ArrowDown') {
    playerDrop();
  } else if (event.key === 'ArrowUp') {
    playerHardDrop();
  } else if (event.key === 'q') {
    playerRotate(-1);
  } else if (event.key === 'w') {
    playerRotate(1);
  }
});

let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;

function update(time = 0) {
  const deltaTime = time - lastTime;
  lastTime = time;

  dropCounter += deltaTime;
  if (dropCounter > dropInterval) {
    playerDrop();
  }

  draw();
  drawNext();
  socket.emit('state', { arena, player, nextPieces });
  requestAnimationFrame(update);
}

function updateScore() {
  document.getElementById('score').innerText = player.score;
}

function updateRemoteScore() {
  document.getElementById('remote-score').innerText = remotePlayer.score;
}

const arena = createMatrix(12, 20);
const player = {
  pos: {x: 0, y: 0},
  matrix: null,
  score: 0,
};

const remoteArena = createMatrix(12, 20);
const remotePlayer = {
  pos: {x: 0, y: 0},
  matrix: createMatrix(0, 0),
  score: 0,
};

socket.on('state', state => {
  remoteArena.splice(0, remoteArena.length, ...state.arena.map(row => row.slice()));
  remotePlayer.pos = state.player.pos;
  remotePlayer.matrix = state.player.matrix;
  remotePlayer.score = state.player.score;
  remoteNextPieces = state.nextPieces || remoteNextPieces;
  updateRemoteScore();
  drawRemote();
  drawRemoteNext();
});

playerReset();
updateScore();
drawRemote();
update();
