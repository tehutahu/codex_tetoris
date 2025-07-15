import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import io from 'socket.io-client';

const CELL_SIZE = 20;
const BOARD_WIDTH = 12;
const BOARD_HEIGHT = 20;

// Colors for pieces
const COLORS = [
  null,
  '#FF0D72',
  '#0DC2FF',
  '#0DFF72',
  '#F538FF',
  '#FF8E0D',
  '#FFE138',
  '#3877FF',
];

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
    default:
      return [[0]];
  }
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

class TetrisScene extends Phaser.Scene {
  constructor() {
    super('tetris');
    this.arena = createMatrix(BOARD_WIDTH, BOARD_HEIGHT);
    this.player = {
      pos: { x: 0, y: 0 },
      matrix: null,
      score: 0,
      gameOver: false,
    };
    this.nextPieces = [];
    for (let i = 0; i < 5; ++i) {
      this.nextPieces.push(this.getRandomPiece());
    }
    this.dropCounter = 0;
    this.dropInterval = 1000;
    this.socket = null;
    this.remoteArena = createMatrix(BOARD_WIDTH, BOARD_HEIGHT);
    this.remotePlayer = {
      pos: { x: 0, y: 0 },
      matrix: createMatrix(0, 0),
      score: 0,
    };
    this.remoteNextPieces = [];
    this.remoteGameOver = false;
  }

  getRandomPiece() {
    const pieces = 'ILJOTSZ';
    return pieces[(pieces.length * Math.random()) | 0];
  }

  collide(arena, player) {
    const [m, o] = [player.matrix, player.pos];
    for (let y = 0; y < m.length; ++y) {
      for (let x = 0; x < m[y].length; ++x) {
        if (
          m[y][x] !== 0 &&
          (arena[y + o.y] && arena[y + o.y][x + o.x]) !== 0
        ) {
          return true;
        }
      }
    }
    return false;
  }

  merge(arena, player) {
    player.matrix.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value !== 0) {
          arena[y + player.pos.y][x + player.pos.x] = value;
        }
      });
    });
  }

  playerReset() {
    this.player.matrix = createPiece(this.nextPieces.shift());
    this.nextPieces.push(this.getRandomPiece());
    this.player.pos.y = 0;
    this.player.pos.x =
      ((this.arena[0].length / 2) | 0) -
      ((this.player.matrix[0].length / 2) | 0);
    if (this.collide(this.arena, this.player)) {
      this.player.gameOver = true;
      this.showMessage('GAME OVER');
      return;
    }
  }

  playerDrop() {
    this.player.pos.y++;
    if (this.collide(this.arena, this.player)) {
      this.player.pos.y--;
      this.merge(this.arena, this.player);
      this.playerReset();
      this.arenaSweep();
      this.updateScore();
    }
    this.dropCounter = 0;
  }

  playerHardDrop() {
    while (!this.collide(this.arena, this.player)) {
      this.player.pos.y++;
    }
    this.player.pos.y--;
    this.merge(this.arena, this.player);
    this.playerReset();
    this.arenaSweep();
    this.updateScore();
    this.dropCounter = 0;
  }

  playerMove(dir) {
    this.player.pos.x += dir;
    if (this.collide(this.arena, this.player)) {
      this.player.pos.x -= dir;
    }
  }

  playerRotate(dir) {
    const pos = this.player.pos.x;
    let offset = 1;
    rotate(this.player.matrix, dir);
    while (this.collide(this.arena, this.player)) {
      this.player.pos.x += offset;
      offset = -(offset + (offset > 0 ? 1 : -1));
      if (offset > this.player.matrix[0].length) {
        rotate(this.player.matrix, -dir);
        this.player.pos.x = pos;
        return;
      }
    }
  }

  arenaSweep() {
    outer: for (let y = this.arena.length - 1; y > 0; --y) {
      for (let x = 0; x < this.arena[y].length; ++x) {
        if (this.arena[y][x] === 0) {
          continue outer;
        }
      }
      const row = this.arena.splice(y, 1)[0].fill(0);
      this.arena.unshift(row);
      ++y;
      this.player.score += 10;
    }
  }

  showMessage(text) {
    if (!this.messageText) {
      this.messageText = this.add
        .text(BOARD_WIDTH * CELL_SIZE, 200, text, {
          fontFamily: 'monospace',
          fontSize: '32px',
          color: '#ffffff',
        })
        .setOrigin(0.5);
    } else {
      this.messageText.setText(text);
      this.messageText.setVisible(true);
    }
  }

  hideMessage() {
    if (this.messageText) {
      this.messageText.setVisible(false);
    }
  }

  updateScore() {
    if (!this.scoreText) {
      this.scoreText = this.add.text(110, 10, `Player 1: ${this.player.score}`, {
        fontFamily: 'monospace',
        color: '#ffffff',
      });
    } else {
      this.scoreText.setText(`Player 1: ${this.player.score}`);
    }
  }

  updateRemoteScore() {
    if (!this.remoteScoreText) {
      this.remoteScoreText = this.add.text(
        BOARD_WIDTH * CELL_SIZE + 130,
        10,
        `Player 2: ${this.remotePlayer.score}`,
        {
          fontFamily: 'monospace',
          color: '#ffffff',
        }
      );
    } else {
      this.remoteScoreText.setText(`Player 2: ${this.remotePlayer.score}`);
    }
  }

  drawMatrix(matrix, offset, graphics) {
    matrix.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value !== 0) {
          graphics.fillStyle(Phaser.Display.Color.HexStringToColor(COLORS[value]).color, 1);
          graphics.fillRect(
            (x + offset.x) * CELL_SIZE,
            (y + offset.y) * CELL_SIZE,
            CELL_SIZE,
            CELL_SIZE
          );
        }
      });
    });
  }

  drawNextPieces(nextPieces, offsetX, graphics) {
    if (!nextPieces || nextPieces.length === 0) return;
    
    nextPieces.forEach((pieceType, index) => {
      const piece = createPiece(pieceType);
      const yOffset = index * 60 + 60; // Spacing between pieces
      
      // Draw background for each next piece
      graphics.fillStyle(0x333333, 1);
      graphics.fillRect(offsetX, yOffset, 80, 50);
      graphics.lineStyle(1, 0xffffff, 1);
      graphics.strokeRect(offsetX, yOffset, 80, 50);
      
      // Draw the piece
      piece.forEach((row, y) => {
        row.forEach((value, x) => {
          if (value !== 0) {
            graphics.fillStyle(Phaser.Display.Color.HexStringToColor(COLORS[value]).color, 1);
            graphics.fillRect(
              offsetX + x * 15 + 5,
              yOffset + y * 15 + 5,
              15,
              15
            );
          }
        });
      });
    });
  }

  draw() {
    this.graphics.clear();
    this.remoteGraphics.clear();
    
    // Draw player 1 board
    this.graphics.fillStyle(0x000000, 1);
    this.graphics.fillRect(0, 0, BOARD_WIDTH * CELL_SIZE, BOARD_HEIGHT * CELL_SIZE);
    this.graphics.lineStyle(2, 0xffffff, 1);
    this.graphics.strokeRect(0, 0, BOARD_WIDTH * CELL_SIZE, BOARD_HEIGHT * CELL_SIZE);
    
    // Draw player 2 board
    this.remoteGraphics.fillStyle(0x000000, 1);
    this.remoteGraphics.fillRect(0, 0, BOARD_WIDTH * CELL_SIZE, BOARD_HEIGHT * CELL_SIZE);
    this.remoteGraphics.lineStyle(2, 0xffffff, 1);
    this.remoteGraphics.strokeRect(0, 0, BOARD_WIDTH * CELL_SIZE, BOARD_HEIGHT * CELL_SIZE);
    
    // Draw game pieces
    this.drawMatrix(this.arena, { x: 0, y: 0 }, this.graphics);
    this.drawMatrix(this.player.matrix, this.player.pos, this.graphics);

    this.drawMatrix(this.remoteArena, { x: 0, y: 0 }, this.remoteGraphics);
    this.drawMatrix(this.remotePlayer.matrix, this.remotePlayer.pos, this.remoteGraphics);
    
    // Draw next pieces for both players
    this.drawNextPieces(this.nextPieces, -90, this.graphics);  // 自分のネクストを左側に
    this.drawNextPieces(this.remoteNextPieces, BOARD_WIDTH * CELL_SIZE + 10, this.remoteGraphics);  // 相手のネクストを右側に
  }

  create() {
    this.graphics = this.add.graphics({ x: 100, y: 0 });  // 左側にスペースを確保
    this.remoteGraphics = this.add.graphics({ x: BOARD_WIDTH * CELL_SIZE + 120, y: 0 });  // 右側も調整
    
    // Add player labels
    this.add.text(110, 30, 'Player 1', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#ffffff',
    });
    this.add.text(BOARD_WIDTH * CELL_SIZE + 130, 30, 'Player 2', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#ffffff',
    });
    
    this.updateScore();
    this.updateRemoteScore();
    this.playerReset();

    this.socket = io();
    this.socket.on('state', (state) => {
      this.remoteArena.splice(0, this.remoteArena.length, ...state.arena.map((r) => r.slice()));
      this.remotePlayer.pos = state.player.pos;
      this.remotePlayer.matrix = state.player.matrix;
      this.remotePlayer.score = state.player.score;
      this.remoteNextPieces = state.nextPieces || [];
      this.updateRemoteScore();
      this.remoteGameOver = state.gameOver;
    });

    this.input.keyboard.on('keydown', (event) => {
      if (this.player.gameOver) {
        if (event.key === 'Enter') {
          this.resetGame();
        }
        return;
      }
      if (event.key === 'ArrowLeft') {
        this.playerMove(-1);
      } else if (event.key === 'ArrowRight') {
        this.playerMove(1);
      } else if (event.key === 'ArrowDown') {
        this.playerDrop();
      } else if (event.key === 'ArrowUp') {
        this.playerHardDrop();
      } else if (event.key === 'q') {
        this.playerRotate(-1);
      } else if (event.key === 'w') {
        this.playerRotate(1);
      }
    });
  }

  resetGame() {
    this.arena.forEach((row) => row.fill(0));
    this.nextPieces.splice(0, this.nextPieces.length);
    for (let i = 0; i < 5; ++i) {
      this.nextPieces.push(this.getRandomPiece());
    }
    this.player.score = 0;
    this.updateScore();
    this.player.gameOver = false;
    this.hideMessage();
    this.dropCounter = 0;
    this.playerReset();
  }

  update(time, delta) {
    if (!this.player.gameOver) {
      this.dropCounter += delta;
      if (this.dropCounter > this.dropInterval) {
        this.playerDrop();
      }
    } else if (this.remoteGameOver) {
      this.showMessage('DRAW');
    }

    this.draw();
    this.socket.emit('state', {
      arena: this.arena,
      player: this.player,
      nextPieces: this.nextPieces,
      gameOver: this.player.gameOver,
    });
  }
}

export default function Game() {
  const gameContainer = useRef(null);

  useEffect(() => {
    if (gameContainer.current) {
      const game = new Phaser.Game({
        type: Phaser.CANVAS,
        width: BOARD_WIDTH * CELL_SIZE * 2 + 20 + 200,  // 左右にネクスト用スペース100pxずつ追加
        height: BOARD_HEIGHT * CELL_SIZE,
        parent: gameContainer.current,
        scene: TetrisScene,
      });

      return () => {
        game.destroy(true);
      };
    }
  }, [gameContainer]);

  return <div ref={gameContainer}></div>;
}
