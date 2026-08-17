import type { SaveData } from '../types';

const KEY = 'gravehorde-save-v1';

const DEFAULTS: SaveData = {
  bestTimeSec: 0,
  bestKills: 0,
  wins: 0,
  runs: 0,
  muted: false,
  volume: 1,
  gold: 0,
  meta: {}
};

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS, meta: {} };
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    // fresh meta object so mutations never touch DEFAULTS; old saves get the new fields
    return { ...DEFAULTS, ...parsed, meta: { ...(parsed.meta ?? {}) } };
  } catch {
    return { ...DEFAULTS, meta: {} };
  }
}

export function storeSave(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* storage unavailable (private mode etc.) — play on without persistence */
  }
}
