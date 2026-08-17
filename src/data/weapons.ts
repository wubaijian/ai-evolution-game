import type { WeaponDef, WeaponId, WeaponLevel } from '../types';

/**
 * The six auto-firing weapons. Levels are index 0 = level 1, max level 5.
 * `area`/`speed`/`pierce` are interpreted per-weapon by the weapon system.
 * Each weapon has an `evolution`: maxed weapon + matching passive, then open a
 * boss chest → the weapon becomes its level-6 evolved form.
 */
export const WEAPONS: Record<WeaponId, WeaponDef> = {
  spark: {
    id: 'spark',
    name: '墓穴灵火',
    desc: '向最近的敌人发射奥术弹。',
    icon: 'tile:107',
    levels: [
      { damage: 12, cooldownMs: 550, amount: 1, area: 0, speed: 400, pierce: 0, knockback: 60 },
      { damage: 16, cooldownMs: 520, amount: 1, area: 0, speed: 420, pierce: 0, knockback: 60 },
      { damage: 16, cooldownMs: 470, amount: 2, area: 0, speed: 440, pierce: 0, knockback: 70 },
      { damage: 24, cooldownMs: 440, amount: 2, area: 0, speed: 470, pierce: 1, knockback: 80 },
      { damage: 32, cooldownMs: 400, amount: 3, area: 0, speed: 500, pierce: 1, knockback: 90 }
    ],
    evolution: {
      name: '灵魂火齐射',
      desc: '灵火化作能够穿透敌人的暴雨。',
      requires: 'power',
      level: { damage: 44, cooldownMs: 300, amount: 5, area: 0, speed: 560, pierce: 3, knockback: 110 }
    }
  },
  arc: {
    id: 'arc',
    name: '死神弧刃',
    desc: '向最近的敌人扫出一道刀光。',
    icon: 'tile:104',
    levels: [
      { damage: 22, cooldownMs: 1150, amount: 1, area: 95, speed: 0, pierce: 99, knockback: 150 },
      { damage: 30, cooldownMs: 1100, amount: 1, area: 105, speed: 0, pierce: 99, knockback: 158 },
      { damage: 30, cooldownMs: 1050, amount: 2, area: 115, speed: 0, pierce: 99, knockback: 166 },
      { damage: 42, cooldownMs: 950, amount: 2, area: 130, speed: 0, pierce: 99, knockback: 180 },
      { damage: 58, cooldownMs: 850, amount: 2, area: 150, speed: 0, pierce: 99, knockback: 200 }
    ],
    evolution: {
      name: '死神之镰',
      desc: '宽广的收割让近身敌人无处可逃。',
      requires: 'haste',
      level: { damage: 90, cooldownMs: 650, amount: 2, area: 195, speed: 0, pierce: 99, knockback: 240 }
    }
  },
  axes: {
    id: 'axes',
    name: '白骨飞斧',
    desc: '投掷沉重且能够穿透敌人的弧线飞斧。',
    icon: 'tile:118',
    levels: [
      { damage: 20, cooldownMs: 1350, amount: 1, area: 0, speed: 330, pierce: 3, knockback: 120 },
      { damage: 20, cooldownMs: 1300, amount: 2, area: 0, speed: 340, pierce: 3, knockback: 120 },
      { damage: 28, cooldownMs: 1250, amount: 2, area: 0, speed: 350, pierce: 4, knockback: 130 },
      { damage: 28, cooldownMs: 1100, amount: 3, area: 0, speed: 360, pierce: 4, knockback: 140 },
      { damage: 38, cooldownMs: 1000, amount: 4, area: 0, speed: 380, pierce: 5, knockback: 150 }
    ],
    evolution: {
      name: '掘墓人之怒',
      desc: '重铁如雨落下，埋葬沿途的一切。',
      requires: 'vitality',
      level: { damage: 56, cooldownMs: 800, amount: 6, area: 0, speed: 400, pierce: 8, knockback: 170 }
    }
  },
  orbitals: {
    id: 'orbitals',
    name: '幽灵飞刃',
    desc: '幽灵刀刃环绕身边，撕裂触碰到的敌人。',
    icon: 'tile:105',
    levels: [
      { damage: 10, cooldownMs: 450, amount: 1, area: 74, speed: 170, pierce: 99, knockback: 55 },
      { damage: 14, cooldownMs: 450, amount: 2, area: 80, speed: 180, pierce: 99, knockback: 60 },
      { damage: 14, cooldownMs: 420, amount: 3, area: 86, speed: 195, pierce: 99, knockback: 65 },
      { damage: 20, cooldownMs: 400, amount: 3, area: 94, speed: 210, pierce: 99, knockback: 70 },
      { damage: 26, cooldownMs: 380, amount: 5, area: 104, speed: 230, pierce: 99, knockback: 78 }
    ],
    evolution: {
      name: '哀嚎王庭',
      desc: '金色灵魂组成王庭，永远守护着你。',
      requires: 'swiftness',
      level: { damage: 38, cooldownMs: 330, amount: 7, area: 128, speed: 290, pierce: 99, knockback: 90 }
    }
  },
  nova: {
    id: 'nova',
    name: '亵渎新星',
    desc: '墓火脉冲灼烧周围所有敌人。',
    icon: 'gen:icon_nova',
    levels: [
      { damage: 9, cooldownMs: 950, amount: 1, area: 85, speed: 0, pierce: 99, knockback: 28 },
      { damage: 12, cooldownMs: 900, amount: 1, area: 100, speed: 0, pierce: 99, knockback: 32 },
      { damage: 15, cooldownMs: 820, amount: 1, area: 112, speed: 0, pierce: 99, knockback: 36 },
      { damage: 19, cooldownMs: 740, amount: 1, area: 126, speed: 0, pierce: 99, knockback: 40 },
      { damage: 25, cooldownMs: 650, amount: 1, area: 145, speed: 0, pierce: 99, knockback: 46 }
    ],
    evolution: {
      name: '瘟火光环',
      desc: '近乎永不熄灭的腐朽墓火之环。',
      requires: 'shield',
      level: { damage: 34, cooldownMs: 480, amount: 1, area: 185, speed: 0, pierce: 99, knockback: 54 }
    }
  },
  storm: {
    id: 'storm',
    name: '风暴召唤',
    desc: '闪电从天而降，随机打击敌人。',
    icon: 'gen:icon_storm',
    levels: [
      { damage: 34, cooldownMs: 2100, amount: 2, area: 46, speed: 0, pierce: 99, knockback: 50 },
      { damage: 42, cooldownMs: 2000, amount: 3, area: 50, speed: 0, pierce: 99, knockback: 55 },
      { damage: 50, cooldownMs: 1900, amount: 4, area: 54, speed: 0, pierce: 99, knockback: 60 },
      { damage: 62, cooldownMs: 1750, amount: 5, area: 60, speed: 0, pierce: 99, knockback: 65 },
      { damage: 80, cooldownMs: 1600, amount: 7, area: 68, speed: 0, pierce: 99, knockback: 70 }
    ],
    evolution: {
      name: '苍穹审判',
      desc: '天空亲自向成群敌人降下判决。',
      requires: 'echo',
      level: { damage: 115, cooldownMs: 1350, amount: 10, area: 85, speed: 0, pierce: 99, knockback: 80 }
    }
  }
};

export const WEAPON_MAX_LEVEL = 5;
/** weapon level value that marks the evolved form */
export const EVOLVED_LEVEL = 6;

/** per-level tunables, transparently resolving the evolved form */
export function weaponLevelFor(id: WeaponId, lvl: number): WeaponLevel {
  const w = WEAPONS[id];
  return lvl >= EVOLVED_LEVEL && w.evolution ? w.evolution.level : w.levels[Math.min(lvl, WEAPON_MAX_LEVEL) - 1];
}

/** Per-level human-readable upgrade blurbs for the cards */
export function weaponUpgradeBlurb(id: WeaponId, toLevel: number): string {
  const w = WEAPONS[id];
  if (toLevel <= 1) return w.desc;
  const prev = w.levels[toLevel - 2];
  const next = w.levels[toLevel - 1];
  const bits: string[] = [];
  if (next.damage !== prev.damage) bits.push(`伤害 ${prev.damage}→${next.damage}`);
  if (next.amount !== prev.amount) bits.push(`+${next.amount - prev.amount} ${amountNoun(id)}`);
  if (next.cooldownMs !== prev.cooldownMs) bits.push('攻击更快');
  if (next.area !== prev.area) bits.push('范围更大');
  if (next.pierce !== prev.pierce) bits.push('穿透更多');
  return bits.join('，') || '能力提升';
}

function amountNoun(id: WeaponId): string {
  switch (id) {
    case 'spark': return '发弹数';
    case 'arc': return '挥砍';
    case 'axes': return '飞斧';
    case 'orbitals': return '刀刃';
    case 'storm': return '雷击';
    default: return '攻击次数';
  }
}
