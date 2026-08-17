import type { PassiveDef, PassiveId } from '../types';

/**
 * Passive items. `apply` is called once per level owned when (re)computing stats
 * from base values, so effects stack per level.
 */
export const PASSIVES: Record<PassiveId, PassiveDef> = {
  power: {
    id: 'power', name: '力量魔典', desc: '+12% 伤害', icon: 'tile:117', maxLevel: 5,
    apply: s => { s.damageMult += 0.12; }
  },
  haste: {
    id: 'haste', name: '诅咒沙漏', desc: '-8% 武器冷却', icon: 'tile:116', maxLevel: 5,
    apply: s => { s.cooldownMult *= 0.92; }
  },
  vitality: {
    id: 'vitality', name: '钢铁之心', desc: '+25 生命上限', icon: 'gen:icon_heart', maxLevel: 5,
    apply: s => { s.maxHp += 25; }
  },
  swiftness: {
    id: 'swiftness', name: '怨灵之靴', desc: '+8% 移动速度', icon: 'gen:icon_swift', maxLevel: 5,
    apply: s => { s.moveSpeed *= 1.08; }
  },
  lantern: {
    id: 'lantern', name: '灵魂提灯', desc: '+30% 拾取范围', icon: 'tile:125', maxLevel: 5,
    apply: s => { s.magnetRadius *= 1.3; }
  },
  shield: {
    id: 'shield', name: '墓墙盾', desc: '+1 护甲（固定减伤）', icon: 'tile:102', maxLevel: 5,
    apply: s => { s.armor += 1; }
  },
  bloodpact: {
    id: 'bloodpact', name: '鲜血契约', desc: '每秒 +0.5 生命恢复', icon: 'gen:icon_blood', maxLevel: 5,
    apply: s => { s.regenPerSec += 0.5; }
  },
  echo: {
    id: 'echo', name: '回响水晶', desc: '齐射武器 +1 投射物', icon: 'gen:icon_echo', maxLevel: 2,
    apply: s => { s.amountBonus += 1; }
  }
};
