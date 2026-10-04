import { createGame, updateGame } from '../client/src/game.js';

export const ACCEPTANCE_SEED = 'acceptance-20';

// Evaluate reachable placements; plans contain only ordinary player actions.
function placements(state) {
  const result = [];
  let rotated = state;
  for (let rotation = 0; rotation < 4; rotation++) {
    if (rotation) rotated = updateGame(rotated, { type: 'rotateRight' });
    let leftmost = rotated;
    let leftCount = 0;
    for (;;) {
      const next = updateGame(leftmost, { type: 'moveLeft' });
      if (next === leftmost) break;
      leftmost = next;
      leftCount++;
    }
    let candidate = leftmost;
    for (let rightCount = 0; rightCount < 10; rightCount++) {
      const after = updateGame(candidate, { type: 'hardDrop' });
      if (after.status !== 'lost') {
        result.push({
          state: after,
          actions: [
            ...Array(rotation).fill('rotateRight'),
            ...Array(leftCount).fill('moveLeft'),
            ...Array(rightCount).fill('moveRight'),
            'hardDrop',
          ],
        });
      }
      const next = updateGame(candidate, { type: 'moveRight' });
      if (next === candidate) break;
      candidate = next;
    }
  }
  return result;
}

function value(state, initialLines) {
  if (state.status === 'won') return 1e6;
  const heights = Array(state.board[0].length).fill(0);
  let holes = 0;
  for (let x = 0; x < heights.length; x++) {
    let filled = false;
    for (let y = 0; y < state.board.length; y++) {
      if (state.board[y][x] !== null) {
        if (!filled) heights[x] = state.board.length - y;
        filled = true;
      } else if (filled) holes++;
    }
  }
  const aggregate = heights.reduce((sum, height) => sum + height, 0);
  const bumpiness = heights.slice(1).reduce((sum, height, i) => sum + Math.abs(height - heights[i]), 0);
  return (state.lines - initialLines) * 4 - aggregate * 0.5 - holes * 3 - bumpiness * 0.2;
}

export function sprintPlan(seed = ACCEPTANCE_SEED) {
  let state = updateGame(createGame(seed), { type: 'start' });
  const plan = [];
  while (state.status === 'playing' && plan.length < 160) {
    let best;
    let bestValue = -Infinity;
    for (const candidate of placements(state)) {
      const next = candidate.state.status === 'won' ? [] : placements(candidate.state);
      const evaluation = next.length
        ? Math.max(...next.map(second => value(second.state, state.lines)))
        : value(candidate.state, state.lines);
      if (evaluation > bestValue) {
        bestValue = evaluation;
        best = candidate;
      }
    }
    if (!best) throw new Error('No legal acceptance placement');
    state = best.state;
    plan.push({ actions: best.actions, lines: state.lines, score: state.score, status: state.status });
  }
  if (state.status !== 'won') throw new Error('Acceptance seed did not reach the goal');
  return plan;
}