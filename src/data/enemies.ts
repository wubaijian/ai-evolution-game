import type { EnemyDef, EnemyTypeId } from '../types';
import { F } from './frames';

/**
 * Enemy bestiary. hp/damage are base values at t=0 and scale with run time
 * (see DIFFICULTY in config.ts). radius is the arcade body circle.
 */
export const ENEMIES: Record<EnemyTypeId, EnemyDef> = {
  imp: {
    id: 'imp', name: '墓翼蝠', texture: 'tiles', hp: 8, speed: 105, damage: 8, xp: 1,
    radius: 8, scale: 2.0, knockbackResist: 0
  },
  skeleton: {
    id: 'skeleton', name: '瘟疫鼠', texture: 'tiles', hp: 18, speed: 62, damage: 10, xp: 1,
    radius: 9, scale: 2.2, knockbackResist: 0
  },
  zombie: {
    id: 'zombie', name: '墓穴软泥', texture: 'tiles', hp: 34, speed: 40, damage: 14, xp: 2,
    radius: 10, scale: 2.4, knockbackResist: 0.3
  },
  spider: {
    id: 'spider', name: '地穴蜘蛛', texture: 'tiles', hp: 14, speed: 122, damage: 9, xp: 2,
    radius: 9, scale: 2.2, knockbackResist: 0
  },
  ghost: {
    id: 'ghost', name: '怨灵', texture: 'tiles', hp: 28, speed: 74, damage: 12, xp: 3,
    radius: 9, scale: 2.4, knockbackResist: 1, drifter: true
  },
  cultist: {
    id: 'cultist', name: '墓穴侍从', texture: 'tiles', hp: 38, speed: 55, damage: 10, xp: 4,
    radius: 9, scale: 2.4, knockbackResist: 0.2,
    ranged: { intervalMs: 2600, range: 470, keepDistance: 250, projSpeed: 150, projDamage: 11 }
  },
  brute: {
    id: 'brute', name: '陵墓爬兽', texture: 'tiles', hp: 130, speed: 34, damage: 22, xp: 8,
    radius: 13, scale: 3.0, knockbackResist: 0.7
  },
  mimic: {
    id: 'mimic', name: '墓穴宝箱怪', texture: 'tiles', hp: 55, speed: 100, damage: 0, xp: 0,
    radius: 9, scale: 2.4, knockbackResist: 0.4, fleeing: true
  },
  boss_colossus: {
    id: 'boss_colossus', name: '墓穴巨像', texture: 'tiles', hp: 2100, speed: 42, damage: 26,
    xp: 60, radius: 26, scale: 5.2, knockbackResist: 0.95, tint: 0xb8c4cc, boss: true
  },
  boss_witch: {
    id: 'boss_witch', name: '女巫之母', texture: 'tiles', hp: 5200, speed: 50, damage: 24,
    xp: 120, radius: 24, scale: 4.8, knockbackResist: 0.95, boss: true,
    ranged: { intervalMs: 3800, range: 9999, keepDistance: 210, projSpeed: 135, projDamage: 14 }
  },
  boss_reaper: {
    id: 'boss_reaper', name: '试炼守卫', texture: 'tiles', hp: 1500, speed: 54, damage: 18,
    xp: 0, radius: 28, scale: 6.0, knockbackResist: 1, tint: 0x6a5acd, boss: true
  }
};

/** sprite frame per enemy type */
export const ENEMY_FRAME: Record<EnemyTypeId, number> = {
  imp: F.BAT,
  skeleton: F.RAT,
  zombie: F.SLIME,
  spider: F.SPIDER,
  ghost: F.GHOST,
  cultist: F.ACOLYTE,
  brute: F.CRAB,
  mimic: F.MIMIC,
  boss_colossus: F.GOLEM,
  boss_witch: F.WIZARD,
  boss_reaper: F.GHOST
};
