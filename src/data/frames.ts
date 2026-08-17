/**
 * Frame indices into Kenney "Tiny Dungeon" tilemap_packed.png (12 cols × 11 rows, 16×16).
 * Loaded as the 'tiles' spritesheet. Mapped by eye from the labeled contact sheet.
 */
export const F = {
  PLAYER: 96, // knight, full helm

  // enemies
  BAT: 120,
  RAT: 123,
  SLIME: 108,
  SPIDER: 122,
  GHOST: 121,
  ACOLYTE: 111, // bearded mage with hat
  CRAB: 110,
  GOLEM: 109,
  WIZARD: 84, // purple wizard (witch boss)

  // items / projectiles
  SWORD: 104,
  DAGGER: 105,
  AXE: 119,
  DOUBLE_AXE: 118,
  HAMMER: 117,
  WAND: 107,
  POTION_RED: 115,
  POTION_BLUE: 116,
  POTION_GREEN: 114,
  RING: 101,
  CHEST: 89,
  MIMIC: 92,

  // decor
  GRAVE_CROSS: 64,
  GRAVESTONE: 65,
  SLAB_A: 54,
  SLAB_B: 55,
  HOLE: 56,
  BONES: 124,
  TORCH: 125,

  // ground tiles (dirt)
  GROUND: [0, 1, 12, 13, 24, 25]
} as const;
