import Phaser from 'phaser';
import { DEPTH, DROPS, MIMIC, POOL_SIZES, XP } from '../config';
import { F } from '../data/frames';
import { Sfx } from './audio';
import type { Enemy } from '../entities/Enemy';
import type { GameScene } from '../scenes/GameScene';

type PickupKind = 'heal' | 'magnet' | 'coin' | 'chest';

interface Gem extends Phaser.GameObjects.Image {
  value: number;
  magnetised: boolean;
  speed: number;
}

interface Pickup extends Phaser.GameObjects.Image {
  kind: PickupKind;
  bobSeed: number;
  baseY: number;
}

/** XP gems and floor pickups: pooled plain images, distance-checked (no physics). */
export class Loot {
  private gs: GameScene;
  private gems: Gem[] = [];
  private pickups: Pickup[] = [];

  constructor(gs: GameScene) {
    this.gs = gs;
    for (let i = 0; i < POOL_SIZES.GEMS; i++) {
      const g = gs.add.image(0, 0, 'gem') as Gem;
      g.setDepth(DEPTH.GEMS).setActive(false).setVisible(false);
      g.value = 1;
      g.magnetised = false;
      g.speed = 0;
      this.gems.push(g);
    }
    for (let i = 0; i < POOL_SIZES.PICKUPS; i++) {
      const p = gs.add.image(0, 0, 'tiles', F.POTION_RED) as Pickup;
      p.setDepth(DEPTH.PICKUPS).setActive(false).setVisible(false);
      p.kind = 'heal';
      p.bobSeed = Math.random() * 1000;
      p.baseY = 0;
      this.pickups.push(p);
    }
  }

  /** drop the gem (and maybe a bonus pickup) for a killed enemy */
  dropFor(enemy: Enemy) {
    if (enemy.def.fleeing) {
      // mimic: no xp — it bursts into a shower of coins
      const n = Phaser.Math.Between(MIMIC.GOLD_COINS_MIN, MIMIC.GOLD_COINS_MAX);
      for (let i = 0; i < n; i++) {
        this.spawnPickup(enemy.x + Phaser.Math.Between(-44, 44), enemy.y + Phaser.Math.Between(-44, 44), 'coin');
      }
      return;
    }
    this.spawnGem(enemy.x, enemy.y, enemy.xpValue);
    if (enemy.isElite) {
      this.spawnPickup(enemy.x + 20, enemy.y, Math.random() < 0.5 ? 'heal' : 'magnet');
      return;
    }
    const r = Math.random();
    if (r < DROPS.HEAL_CHANCE) this.spawnPickup(enemy.x, enemy.y + 14, 'heal');
    else if (r < DROPS.HEAL_CHANCE + DROPS.MAGNET_CHANCE) this.spawnPickup(enemy.x, enemy.y + 14, 'magnet');
    else if (r < DROPS.HEAL_CHANCE + DROPS.MAGNET_CHANCE + DROPS.GOLD_CHANCE) this.spawnPickup(enemy.x, enemy.y + 14, 'coin');
  }

  spawnGem(x: number, y: number, value: number) {
    let gem = this.gems.find(g => !g.active);
    if (!gem) {
      // pool exhausted — fold the value into the nearest active gem instead
      let nearest: Gem | null = null;
      let bd = Infinity;
      for (const g of this.gems) {
        const dx = g.x - x;
        const dy = g.y - y;
        const d = dx * dx + dy * dy;
        if (d < bd) {
          bd = d;
          nearest = g;
        }
      }
      if (nearest) {
        nearest.value += value;
        this.styleGem(nearest);
      }
      return;
    }
    gem.setActive(true).setVisible(true);
    gem.setPosition(x + Phaser.Math.Between(-10, 10), y + Phaser.Math.Between(-10, 10));
    gem.value = value;
    gem.magnetised = false;
    gem.speed = 0;
    this.styleGem(gem);
  }

  private styleGem(gem: Gem) {
    if (gem.value >= XP.GEM_BIG) gem.setTint(0xff5a78).setScale(1.5);
    else if (gem.value >= XP.GEM_MED) gem.setTint(0x6ee86e).setScale(1.25);
    else gem.setTint(0x6ec8ff).setScale(1);
  }

  spawnPickup(x: number, y: number, kind: PickupKind) {
    const p = this.pickups.find(p => !p.active);
    if (!p) return;
    p.kind = kind;
    p.setActive(true).setVisible(true).setPosition(x, y);
    p.baseY = y;
    p.setScale(kind === 'chest' ? 2.6 : 2);
    p.clearTint();
    switch (kind) {
      case 'heal': p.setTexture('tiles', F.POTION_RED); break;
      case 'magnet': p.setTexture('tiles', F.RING).setTint(0x7fd4ff); break;
      case 'coin': p.setTexture('coin').setScale(1.6); break;
      case 'chest': p.setTexture('tiles', F.CHEST); break;
    }
  }

  /** magnet sweep + collection — one pass over active gems/pickups */
  update(runTime: number, delta: number) {
    const { player, run } = this.gs;
    const magnetSq = run.stats.magnetRadius * run.stats.magnetRadius;
    const dt = delta / 1000;

    for (const gem of this.gems) {
      if (!gem.active) continue;
      const dx = player.x - gem.x;
      const dy = player.y - gem.y;
      const dSq = dx * dx + dy * dy;
      if (!gem.magnetised && dSq < magnetSq) gem.magnetised = true;
      if (gem.magnetised) {
        gem.speed = Math.min(XP.GEM_FLY_SPEED, gem.speed + 1400 * dt);
        const d = Math.sqrt(dSq) || 1;
        gem.x += (dx / d) * gem.speed * dt;
        gem.y += (dy / d) * gem.speed * dt;
        if (d < 20) {
          gem.setActive(false).setVisible(false);
          this.gs.juice.sparkle(player.x, player.y - 8);
          Sfx.play('gem', 0.3, Phaser.Math.Between(-50, 150));
          this.gs.onXp(gem.value);
        }
      }
    }

    for (const p of this.pickups) {
      if (!p.active) continue;
      p.y = p.baseY + Math.sin((runTime + p.bobSeed) * 0.004) * 4;
      const dx = player.x - p.x;
      const dy = player.y - p.y;
      if (dx * dx + dy * dy < 28 * 28) {
        p.setActive(false).setVisible(false);
        this.collect(p.kind);
      }
    }
  }

  private collect(kind: PickupKind) {
    const { player, juice, run } = this.gs;
    switch (kind) {
      case 'heal':
        player.heal(DROPS.HEAL_AMOUNT);
        juice.floatText(player.x, player.y - 24, `+${DROPS.HEAL_AMOUNT}`, '#5dde6a');
        Sfx.play('heal', 0.5);
        break;
      case 'magnet':
        this.vacuumAll();
        juice.ringPulse(player.x, player.y, 220, 0x7fd4ff, 450);
        Sfx.play('magnet', 0.55);
        break;
      case 'coin':
        run.addGold(DROPS.GOLD_VALUE);
        juice.floatText(player.x, player.y - 24, `+${DROPS.GOLD_VALUE} 金币`, '#ffd34e');
        Sfx.play('coin', 0.45);
        break;
      case 'chest':
        this.gs.openChest();
        break;
    }
  }

  vacuumAll() {
    for (const gem of this.gems) {
      if (gem.active) gem.magnetised = true;
    }
  }

  activeGemCount(): number {
    let n = 0;
    for (const g of this.gems) if (g.active) n++;
    return n;
  }
}
