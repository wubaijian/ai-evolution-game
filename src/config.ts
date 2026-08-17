/** Central balance + tuning knobs for GRAVEHORDE. All gameplay constants live here. */

export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

/** Short gray-box encounter used to compare the three evolution routes. */
export const RUN = {
  WAVE_DURATION_SEC: 25,
  WAVE_COUNT: 3,
  BOSS_AT: 75,
  BOSS_PHASE_TWO_HP_RATIO: 0.5,
  REAPER_ENRAGE_AFTER: 70 // safety valve if the validation boss drags on
};

export const PLAYER = {
  BASE_HP: 100,
  BASE_SPEED: 150,
  BASE_MAGNET: 60,
  RADIUS: 11,
  /** ms of invulnerability after taking a hit */
  IFRAMES_MS: 350,
  /** how often one enemy in contact can hurt you (ms) */
  CONTACT_TICK_MS: 550,
  SCALE: 2.4
};

/** Baseline actions for the manual-combat prototype. */
export const MANUAL_COMBAT = {
  CORE_COOLDOWN_MS: 5000,
  CORE_DAMAGE: 36,
  CORE_RADIUS: 155,
  CORE_KNOCKBACK: 260,
  DODGE_COOLDOWN_MS: 1300,
  DODGE_DURATION_MS: 180,
  DODGE_SPEED: 520,
  DODGE_IFRAMES_MS: 260
};

/** Route-specific gray-box mechanics. These are deterministic gameplay values. */
export const EVOLUTION_COMBAT = {
  STORMWING: {
    CHAIN_RANGE: 520,
    CHAIN_TARGETS: 5,
    AIR_DASH_DURATION_MS: 250,
    AIR_DASH_SPEED: 690,
    AIR_DASH_IFRAMES_MS: 330
  },
  BURROW: {
    CLAW_RANGE: 92,
    CLAW_HALF_ANGLE: 0.85,
    BURROW_DURATION_MS: 950,
    BURROW_SPEED_MULT: 1.45,
    EMERGENCE_RADIUS: 125,
    AMBUSH_WINDOW_MS: 1300,
    AMBUSH_DAMAGE_MULT: 1.55
  },
  TIDAL: {
    SPLASH_RADIUS: 62,
    SPLASH_DAMAGE_MULT: 0.55,
    VORTEX_RADIUS: 190,
    VORTEX_DURATION_MS: 2100,
    VORTEX_TICK_MS: 350,
    VORTEX_SLOW_MULT: 0.55,
    WATER_MOVE_MULT: 1.28,
    DRY_MOVE_MULT: 0.9,
    WATER_CORE_MULT: 0.75,
    WATER_AREA_MULT: 1.25,
    WATER_SLIDE_DURATION_MS: 300,
    WATER_SLIDE_SPEED: 650
  },
  WATER: {
    GROUND_SLOW_MULT: 0.72
  }
};

/** Enemy global scaling over run time */
export const DIFFICULTY = {
  /** +35% enemy HP per minute */
  HP_GROWTH_PER_MIN: 0.35,
  /** +8% enemy damage per minute */
  DMG_GROWTH_PER_MIN: 0.08,
  /** enemies farther than this from the player are recycled to the spawn ring */
  LEASH_RADIUS: 1100,
  /** spawn ring distance from player (just off-screen) */
  SPAWN_RADIUS_MIN: 580,
  SPAWN_RADIUS_MAX: 680
};

export const POOL_SIZES = {
  ENEMIES: 400,
  PLAYER_PROJECTILES: 250,
  ENEMY_PROJECTILES: 120,
  GEMS: 320,
  PICKUPS: 40,
  DAMAGE_TEXTS: 48
};

export const XP = {
  /** xp needed to go from `level` to `level+1` */
  needed(level: number): number {
    return Math.round(5 + (level - 1) * 5 + Math.pow(level - 1, 1.45));
  },
  GEM_SMALL: 1,
  GEM_MED: 5,
  GEM_BIG: 20,
  /** gems fly to the player at this speed once magnetised */
  GEM_FLY_SPEED: 480
};

export const DROPS = {
  HEAL_CHANCE: 0.012,
  MAGNET_CHANCE: 0.004,
  GOLD_CHANCE: 0.035,
  HEAL_AMOUNT: 30,
  GOLD_VALUE: 1,
  CHEST_GOLD: 25,
  CHEST_HEAL: 20
};

/** Tomb Mimic treasure event: kill it before it escapes for a gold shower */
export const MIMIC = {
  /** ms before it slips away */
  LIFETIME_MS: 10000,
  /** spawns this far from the player (screen edge — it must be SEEN fleeing) */
  SPAWN_DIST: 400,
  GOLD_COINS_MIN: 12,
  GOLD_COINS_MAX: 18
};

/** Max simultaneously-held weapons / passives */
export const BUILD_LIMITS = {
  WEAPONS: 4,
  PASSIVES: 4
};

export const COLORS = {
  BG: 0x0a0a12,
  HP_BAR: 0xd83a3a,
  HP_BAR_BG: 0x3a0f12,
  XP_BAR: 0x35c2f0,
  XP_BAR_BG: 0x0e2433,
  GOLD: 0xffd34e,
  TEXT: '#e8e3d0',
  TEXT_DIM: '#9a937c',
  ACCENT: '#8c46d8',
  DANGER: '#ff5050',
  HEAL: '#5dde6a'
};

/** Pixel font for Latin glyphs, with system CJK fallbacks for Chinese UI text. */
export const FONT = 'PressStart2P, "PingFang SC", "Microsoft YaHei", sans-serif';

/** depth layers */
export const DEPTH = {
  GROUND: 0,
  DECOR: 1,
  GEMS: 2,
  PICKUPS: 3,
  SHADOW: 4,
  ENEMY: 5,
  PLAYER: 6,
  PROJECTILE: 7,
  FX: 8,
  OVERLAY: 20
};
