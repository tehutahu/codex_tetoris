import { RULES_ID } from './game.js';

export const DAILY_RECORDS_ID = `daily-jst-v1:${RULES_ID}`;
export function japanDate(time = Date.now()) {
  return new Date(new Date(time).getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
export function validDay(day) {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const time = Date.parse(`${day}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === day;
}
export function dailyChallenge(day = japanDate()) {
  if (!validDay(day)) throw new Error('Invalid challenge date');
  return Object.freeze({ mode: 'daily', day, seed: `daily-jst-v1:${RULES_ID}:${day}` });
}
export function challengeFromUrl(parameters, randomSeed, time = Date.now()) {
  if (parameters.get('mode') === 'daily') {
    const day = parameters.get('date');
    return dailyChallenge(validDay(day) ? day : japanDate(time));
  }
  return Object.freeze({ mode: 'normal', seed: parameters.get('seed') || randomSeed });
}
export function challengeUrl(parameters, challenge) {
  const result = new URLSearchParams(parameters);
  if (challenge.mode === 'daily') {
    result.set('mode', 'daily');
    result.set('date', challenge.day);
    result.delete('seed');
  } else {
    result.delete('mode');
    result.delete('date');
    result.set('seed', challenge.seed);
  }
  return result;
}
