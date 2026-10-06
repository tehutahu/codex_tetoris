import { RULES_ID } from './game.js';

export const RECORD_VERSION = 1;
export const MAX_SEED_RECORDS = 128;
export const recordKey = (rulesId = RULES_ID) => `block-sprint.records.v1:${rulesId}`;
const empty = rulesId => ({ version: RECORD_VERSION, rulesId, overall: null, seeds: [] });
const validRecord = r => r && typeof r.seed === 'string' && r.seed.length > 0 &&
  Number.isSafeInteger(r.elapsedMs) && r.elapsedMs >= 0 &&
  Number.isSafeInteger(r.score) && r.score >= 0 &&
  typeof r.date === 'string' && Number.isFinite(Date.parse(r.date));
const validData = (d, rulesId) => d && d.version === RECORD_VERSION && d.rulesId === rulesId &&
  (d.overall === null || validRecord(d.overall)) && Array.isArray(d.seeds) &&
  d.seeds.length <= MAX_SEED_RECORDS && d.seeds.every(validRecord) &&
  new Set(d.seeds.map(r => r.seed)).size === d.seeds.length &&
  (d.seeds.length === 0 || (d.overall && d.seeds.every(r => d.overall.elapsedMs <= r.elapsedMs)));

// Storage and date are injectable; denied/corrupt storage never stops play.
export function createRecords({ storage, rulesId = RULES_ID, key = recordKey(rulesId), now = () => new Date().toISOString() } = {}) {
  let data = empty(rulesId);
  let warning = '';
  try {
    if (!storage) throw new Error('Storage unavailable');
    const raw = storage.getItem(key);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (!validData(parsed, rulesId)) throw new Error('Invalid records');
      data = parsed;
    }
  } catch {
    warning = '保存済み記録を読み込めません。今回の表示はこの画面内だけです。';
  }
  function persist() {
    try {
      if (!storage) throw new Error('Storage unavailable');
      storage.setItem(key, JSON.stringify(data));
      warning = '';
    } catch {
      warning = '記録を保存できません。この画面内では比較できます。';
    }
  }
  return {
    get(seed) {
      return structuredClone({ overall: data.overall,
        seedBest: data.seeds.find(r => r.seed === seed) ?? null, count: data.seeds.length, warning });
    },
    complete(result) {
      if (result.status !== 'won' || result.rulesId !== rulesId ||
          !Number.isFinite(result.elapsedMs) || result.elapsedMs < 0) return false;
      const record = { seed: result.seed, elapsedMs: Math.round(result.elapsedMs),
        score: result.score, date: now() };
      if (!validRecord(record)) return false;
      const previous = data.seeds.find(r => r.seed === record.seed);
      const improved = !data.overall || record.elapsedMs < data.overall.elapsedMs;
      if (improved) data.overall = record;
      if (!previous || record.elapsedMs < previous.elapsedMs) {
        data.seeds = [record, ...data.seeds.filter(r => r.seed !== record.seed)].slice(0, MAX_SEED_RECORDS);
      }
      persist();
      return improved;
    },
    clear() {
      data = empty(rulesId);
      try {
        if (!storage) throw new Error('Storage unavailable');
        storage.removeItem(key);
        warning = '';
      } catch {
        warning = '保存済み記録を削除できません。再読み込みで戻る場合があります。';
      }
    },
  };
}
