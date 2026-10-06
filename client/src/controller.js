import { createGame, updateGame } from './game.js';
import { createInput } from './input.js';

// The browser and automated acceptance checks use this same clock/input adapter.
export function createController({ seed, now = () => performance.now(), onChange = () => {} } = {}) {
  let state = createGame(seed);
  let lastTime = now();
  const input = createInput();
  function publish(next) {
    if (next !== state) {
      state = next;
      if (state.status !== 'playing') input.clear();
      onChange(state);
    }
  }
  function tick(time = now()) {
    if (!Number.isFinite(time)) return;
    const end = Math.max(lastTime, time);
    while (input.nextTime() <= end) {
      const next = input.nextTime();
      publish(updateGame(state, { type: 'tick', deltaMs: next - lastTime }));
      lastTime = next;
      input.repeat(next, type => publish(updateGame(state, { type })));
    }
    publish(updateGame(state, { type: 'tick', deltaMs: end - lastTime }));
    lastTime = end;
  }
  function dispatch(type) {
    tick();
    if (['start', 'pause', 'restart'].includes(type)) input.clear();
    publish(updateGame(state, { type }));
  }
  return {
    dispatch, tick,
    press(source, action) {
      tick();
      if (state.status === 'playing') input.press(source, action, lastTime,
        type => publish(updateGame(state, { type })));
    },
    release(source) {
      tick();
      input.release(source, lastTime);
    },
    clearInput() {
      tick();
      input.clear();
    },
    getState: () => structuredClone(state),
  };
}

