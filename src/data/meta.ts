import type { MetaLevels, MetaUpgradeDef, MetaUpgradeId, PlayerStats } from '../types';

/**
 * Crypt Shop permanent upgrades, bought with banked gold between runs.
 * `apply` is called once per owned level when a run's stats are computed,
 * before passives — same stacking contract as passives.
 * Full shop costs ~1550 gold (≈ a dozen decent runs).
 */
export const META_UPGRADES: Record<MetaUpgradeId, MetaUpgradeDef> = {
  might: {
    id: 'might', name: '诅咒之力', desc: '+4% 伤害', icon: 'tile:104', maxLevel: 5,
    costs: [10, 20, 35, 55, 80],
    apply: s => { s.damageMult += 0.04; }
  },
  vigor: {
    id: 'vigor', name: '不朽之心', desc: '+10 生命上限', icon: 'gen:icon_heart', maxLevel: 5,
    costs: [10, 20, 35, 55, 80],
    apply: s => { s.maxHp += 10; }
  },
  alacrity: {
    id: 'alacrity', name: '躁动之骨', desc: '-3% 武器冷却', icon: 'tile:116', maxLevel: 5,
    costs: [15, 30, 50, 75, 105],
    apply: s => { s.cooldownMult *= 0.97; }
  },
  fleet: {
    id: 'fleet', name: '墓地之风', desc: '+4% 移动速度', icon: 'gen:icon_swift', maxLevel: 3,
    costs: [15, 35, 60],
    apply: s => { s.moveSpeed *= 1.04; }
  },
  reach: {
    id: 'reach', name: '招魂之手', desc: '+15% 拾取范围', icon: 'tile:101', maxLevel: 3,
    costs: [10, 25, 45],
    apply: s => { s.magnetRadius *= 1.15; }
  },
  greed: {
    id: 'greed', name: '守财奴诅咒', desc: '+15% 金币获取', icon: 'gen:coin', maxLevel: 5,
    costs: [12, 25, 45, 70, 100],
    apply: s => { s.goldMult += 0.15; }
  },
  stoneskin: {
    id: 'stoneskin', name: '花岗岩皮肤', desc: '+1 护甲', icon: 'tile:102', maxLevel: 2,
    costs: [60, 120],
    apply: s => { s.armor += 1; }
  },
  gravewalker: {
    id: 'gravewalker', name: '墓行者契约', desc: '每局可半血复活一次', icon: 'tile:121', maxLevel: 1,
    costs: [250],
    apply: s => { s.revives += 1; }
  }
};

/** display order in the shop grid */
export const META_ORDER: MetaUpgradeId[] = [
  'might', 'vigor', 'alacrity', 'fleet', 'reach', 'greed', 'stoneskin', 'gravewalker'
];

/** gold cost of the next level, or null when maxed */
export function metaNextCost(id: MetaUpgradeId, ownedLevel: number): number | null {
  const def = META_UPGRADES[id];
  return ownedLevel >= def.maxLevel ? null : def.costs[ownedLevel];
}

/** stack every owned meta level onto freshly-reset run stats */
export function applyMetaToStats(stats: PlayerStats, meta: MetaLevels): void {
  for (const id of META_ORDER) {
    const lvl = meta[id] ?? 0;
    for (let i = 0; i < lvl; i++) META_UPGRADES[id].apply(stats);
  }
}
