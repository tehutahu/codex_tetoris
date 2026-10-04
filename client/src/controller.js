import { createGame, updateGame } from './game.js';

// The browser and automated acceptance checks use this same clock/input adapter.
export function createController({ seed, now = () => performance.now(), onChange = () => {} } = {}) {
  let state = createGame(seed);
  let lastTime = now();
  function publish(next) {
    if (next !== state) {
      state = next;
      onChange(state);
    }
  }
  function tick(time = now()) {
    if (!Number.isFinite(time)) return;
    const monotonicTime = Math.max(lastTime, time);
    const deltaMs = monotonicTime - lastTime;
    lastTime = monotonicTime;
    publish(updateGame(state, { type: 'tick', deltaMs }));
  }
  function dispatch(type) {
    tick();
    publish(updateGame(state, { type }));
  }
  return {
    dispatch, tick,
    getState: () => structuredClone(state),
  };
}

