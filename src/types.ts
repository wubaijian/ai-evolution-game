/** Shared type definitions for GRAVEHORDE. Pure types — no Phaser imports. */

export type WeaponId =
  | 'spark'
  | 'arc'
  | 'axes'
  | 'orbitals'
  | 'nova'
  | 'storm';

export type EvolutionId =
  | 'stormwing_archer'
  | 'burrow_hunter'
  | 'tidal_shaman';

export type CreatureFormId = 'base_creature' | EvolutionId;

export type EvolutionAbilityId =
  | 'flight'
  | 'burrow'
  | 'aquatic'
  | 'ranged_attack'
  | 'chain_lightning'
  | 'air_dash'
  | 'eruption_burst'
  | 'ambush'
  | 'area_vortex'
  | 'slow'
  | 'single_target_burst'
  | 'high_speed_dash'
  | 'shield'
  | 'stable_block';

export interface EvolutionModifiers {
  maxHpMult: number;
  moveSpeedMult: number;
  primaryDamageMult: number;
  primaryCooldownMult: number;
  projectileSpeedMult: number;
  coreDamageMult: number;
  coreRadiusMult: number;
  coreCooldownMult: number;
  dodgeCooldownMult: number;
  dodgeSpeedMult: number;
}

export interface EvolutionDef {
  id: CreatureFormId;
  name: string;
  nameZh: string;
  tagline: string;
  color: string;
  tint: number;
  movementForm: 'flight' | 'burrow' | 'aquatic';
  attackForm: 'ranged' | 'melee' | 'splash';
  stats: {
    attack: number;
    speed: number;
    defense: number;
    energy: number;
  };
  abilities: EvolutionAbilityId[];
  strengths: string[];
  tradeoffs: string[];
  modifiers: EvolutionModifiers;
}

/** AI-authored flavor attached to one fixed, rule-checked mechanical route. */
export interface EvolutionFlavor {
  routeId: EvolutionId;
  name: string;
  tagline: string;
  storyHook: string;
  visualDescription: string;
}

export interface EvolutionGeneration {
  source: 'openai' | 'fallback';
  variants: EvolutionFlavor[];
  note?: string;
}

export interface EvolutionRulesConfig {
  statBudget: number;
  statMax: number;
  statStrengthMin: number;
  statWeaknessMax: number;
  abilityBudget: number;
  requireFullAbilityBudget: boolean;
  abilityCosts: Record<EvolutionAbilityId, number>;
  specialMovementAbilities: EvolutionAbilityId[];
  highValueCoreAbilities: EvolutionAbilityId[];
  movementAbilityByForm: Record<EvolutionDef['movementForm'], EvolutionAbilityId>;
  incompatibleAbilities: {
    abilities: EvolutionAbilityId[];
    reason: string;
  }[];
}

export interface EvolutionValidation {
  legal: boolean;
  statTotal: number;
  statBudget: number;
  abilityTotal: number;
  abilityBudget: number;
  errors: string[];
}

export type PassiveId =
  | 'power'
  | 'haste'
  | 'vitality'
  | 'swiftness'
  | 'lantern'
  | 'shield'
  | 'bloodpact'
  | 'echo';

export type MetaUpgradeId =
  | 'might'
  | 'vigor'
  | 'alacrity'
  | 'fleet'
  | 'reach'
  | 'greed'
  | 'stoneskin'
  | 'gravewalker';

export type EnemyTypeId =
  | 'imp'
  | 'skeleton'
  | 'zombie'
  | 'spider'
  | 'ghost'
  | 'cultist'
  | 'brute'
  | 'mimic'
  | 'boss_colossus'
  | 'boss_witch'
  | 'boss_reaper';

/** Per-level tunables of one weapon. Index 0 = level 1. */
export interface WeaponLevel {
  damage: number;
  cooldownMs: number;
  /** projectiles per volley / blades / strikes / swings */
  amount: number;
  /** radius or arc size where it applies */
  area: number;
  /** projectile flight speed where it applies */
  speed: number;
  /** enemies a projectile can pass through (where it applies) */
  pierce: number;
  /** knockback impulse applied to enemies hit */
  knockback: number;
}

export interface WeaponDef {
  id: WeaponId;
  name: string;
  desc: string;
  /** texture key for the upgrade-card / HUD icon */
  icon: string;
  levels: WeaponLevel[]; // length = max level
  evolution?: WeaponEvolution;
}

/** Boss-chest evolution: requires the weapon maxed + the matching passive owned. */
export interface WeaponEvolution {
  name: string;
  desc: string;
  requires: PassiveId;
  /** stats of the evolved form (weapon level 6) */
  level: WeaponLevel;
}

export interface PassiveDef {
  id: PassiveId;
  name: string;
  desc: string;
  icon: string;
  maxLevel: number;
  /** applies one level of this passive onto mutable stats */
  apply: (stats: PlayerStats) => void;
}

/** Permanent upgrade bought with banked gold in the Crypt Shop. */
export interface MetaUpgradeDef {
  id: MetaUpgradeId;
  name: string;
  /** per-level effect, e.g. "+4% damage" */
  desc: string;
  icon: string;
  maxLevel: number;
  /** gold cost to buy each level; length = maxLevel */
  costs: number[];
  /** applies one owned level onto run stats (same contract as passives) */
  apply: (stats: PlayerStats) => void;
}

/** Owned meta upgrade levels, persisted in the save. */
export type MetaLevels = Partial<Record<MetaUpgradeId, number>>;

export interface EnemyDef {
  id: EnemyTypeId;
  name: string;
  texture: string;
  hp: number;
  speed: number;
  /** contact damage per hit */
  damage: number;
  xp: number;
  /** collision/body radius in px (world scale) */
  radius: number;
  /** display scale multiplier over base sprite size */
  scale: number;
  /** 0..1 resistance to knockback (1 = immune) */
  knockbackResist: number;
  tint?: number;
  /** ranged attacker config */
  ranged?: { intervalMs: number; range: number; keepDistance: number; projSpeed: number; projDamage: number };
  /** ghosts drift through in straight lines and fade */
  drifter?: boolean;
  /** runs away from the player, deals no contact damage, escapes if not killed */
  fleeing?: boolean;
  boss?: boolean;
}

export interface PlayerStats {
  maxHp: number;
  regenPerSec: number;
  moveSpeed: number;
  magnetRadius: number;
  armor: number;
  damageMult: number;
  cooldownMult: number; // multiplier on cooldowns (lower = faster)
  areaMult: number;
  projSpeedMult: number;
  amountBonus: number; // flat extra projectiles
  goldMult: number;
  /** revives granted at run start (Gravewalker's Pact) */
  revives: number;
}

/** One entry of the spawn timeline. Active from tStart (inclusive) until the next entry. */
export interface WavePhase {
  /** seconds into the run */
  tStart: number;
  spawnIntervalMs: number;
  maxAlive: number;
  /** weighted enemy pool */
  pool: { type: EnemyTypeId; weight: number }[];
}

export type TimedEventKind = 'ring' | 'elite' | 'boss' | 'swarm' | 'mimic';

export interface TimedEvent {
  /** seconds into the run */
  t: number;
  kind: TimedEventKind;
  type?: EnemyTypeId;
  count?: number;
  fired?: boolean; // runtime flag
}

export interface UpgradeChoice {
  kind: 'weapon' | 'passive' | 'heal' | 'gold';
  id?: WeaponId | PassiveId;
  name: string;
  desc: string;
  icon: string;
  /** resulting level if taken (1 = new) */
  level?: number;
}

export interface RunResult {
  victory: boolean;
  timeSurvivedSec: number;
  level: number;
  kills: number;
  gold: number;
  evolutionId: CreatureFormId;
  evolutionName?: string;
  storyHook?: string;
}

export interface SaveData {
  bestTimeSec: number;
  bestKills: number;
  wins: number;
  runs: number;
  muted: boolean;
  /** master volume 0..1 */
  volume: number;
  /** banked gold, spendable in the Crypt Shop */
  gold: number;
  meta: MetaLevels;
}
