export const MOVE_DELAY_MS = 180;
export const MOVE_REPEAT_MS = 55;
export const SOFT_REPEAT_MS = 45;

// Each source is a physical key or pointer ID; releases remain independent.
export function createInput() {
  const held = new Map();
  let horizontal = null;
  let horizontalAt = Infinity;
  let softAt = Infinity;
  const direction = () => [...held.values()].reverse().find(action =>
    action === 'moveLeft' || action === 'moveRight') ?? null;
  const syncDirection = time => {
    const next = direction();
    if (next !== horizontal) {
      horizontal = next;
      horizontalAt = next ? time + MOVE_DELAY_MS : Infinity;
      return true;
    }
    return false;
  };
  return {
    press(source, action, time, emit) {
      if (held.has(source)) return;
      const softHeld = [...held.values()].includes('softDrop');
      held.set(source, action);
      const changed = syncDirection(time);
      if (action === 'moveLeft' || action === 'moveRight') {
        if (changed) emit(action);
      } else if (action === 'softDrop') {
        if (!softHeld) {
          softAt = time + SOFT_REPEAT_MS;
          emit(action);
        }
      } else emit(action);
    },
    release(source, time) {
      held.delete(source);
      syncDirection(time);
      if (![...held.values()].includes('softDrop')) softAt = Infinity;
    },
    nextTime: () => Math.min(horizontalAt, softAt),
    repeat(time, emit) {
      if (horizontalAt <= time) {
        horizontalAt += MOVE_REPEAT_MS;
        emit(horizontal);
      }
      if (softAt <= time) {
        softAt += SOFT_REPEAT_MS;
        emit('softDrop');
      }
    },
    clear() {
      held.clear();
      horizontal = null;
      horizontalAt = softAt = Infinity;
    },
  };
}
