import type { TimedEvent, WavePhase } from '../types';
import { RUN } from '../config';

/**
 * Spawn timeline. Each phase is active from tStart until the next one.
 * Weights pick which enemy spawns; spawnInterval + maxAlive set the pressure.
 */
export const WAVE_PHASES: WavePhase[] = [
  // Wave 1: readable melee pressure teaches movement and the basic attack.
  { tStart: 0, spawnIntervalMs: 1050, maxAlive: 16, pool: [
    { type: 'skeleton', weight: 7 }, { type: 'zombie', weight: 3 }
  ] },
  // Wave 2: fast and airborne enemies punish a single defensive answer.
  { tStart: RUN.WAVE_DURATION_SEC, spawnIntervalMs: 850, maxAlive: 22, pool: [
    { type: 'imp', weight: 5 }, { type: 'spider', weight: 4 }, { type: 'skeleton', weight: 2 }
  ] },
  // Wave 3: ranged pressure asks the player to use their route mechanic.
  { tStart: RUN.WAVE_DURATION_SEC * 2, spawnIntervalMs: 720, maxAlive: 28, pool: [
    { type: 'cultist', weight: 4 }, { type: 'ghost', weight: 3 },
    { type: 'brute', weight: 2 }, { type: 'spider', weight: 3 }
  ] },
  // Boss duel keeps a little minion pressure without obscuring telegraphs.
  { tStart: RUN.BOSS_AT, spawnIntervalMs: 1800, maxAlive: 9, pool: [
    { type: 'skeleton', weight: 4 }, { type: 'cultist', weight: 1 }
  ] }
];

/** One-off scripted moments. kind 'ring' = circle of enemies closing in. */
export const TIMED_EVENTS: TimedEvent[] = [
  { t: 18, kind: 'ring', type: 'skeleton', count: 10 },
  { t: 42, kind: 'elite', type: 'spider' },
  { t: 65, kind: 'swarm', type: 'imp', count: 12 },
  { t: RUN.BOSS_AT, kind: 'boss', type: 'boss_reaper' }
];

/** fresh copy for a new run (events carry a runtime `fired` flag) */
export function freshEvents(): TimedEvent[] {
  return TIMED_EVENTS.map(e => ({ ...e, fired: false }));
}
