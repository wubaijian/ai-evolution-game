import Phaser from 'phaser';
import { DEPTH, EVOLUTION_COMBAT, MANUAL_COMBAT } from '../config';
import { F } from '../data/frames';
import { EVOLVED_LEVEL, weaponLevelFor } from '../data/weapons';
import { Sfx } from './audio';
import type { Enemy } from '../entities/Enemy';
import type { Projectile } from '../entities/Projectile';
import type { GameScene } from '../scenes/GameScene';

/** per-enemy re-hit gate map carried by each orbital blade */
interface OrbitalBlade extends Phaser.Physics.Arcade.Sprite {
  hitGates: Map<object, number>;
}

/**
 * Creates player attacks and maintains continuous weapon visuals. Cooldowns and
 * input live in GameScene so attacks only happen after an explicit player action.
 */
export class Arsenal {
  private gs: GameScene;
  private blades: OrbitalBlade[] = [];
  private bladeKey = '';
  private orbitalAngle = 0;
  private auraGlow?: Phaser.GameObjects.Image;

  constructor(gs: GameScene) {
    this.gs = gs;
  }

  update(runTime: number, delta: number) {
    this.updateOrbitals(runTime, delta);
    this.updateAura();
  }

  primaryCooldownMs(): number {
    const lvl = this.gs.run.weapons.get('spark') ?? 1;
    return weaponLevelFor('spark', lvl).cooldownMs *
      this.gs.run.stats.cooldownMult *
      this.gs.run.evolution.modifiers.primaryCooldownMult;
  }

  /** Manual basic attack: fire the starter bolt toward the player's aim. */
  firePrimary(angle: number, runTime: number): boolean {
    const lvl = this.gs.run.weapons.get('spark') ?? 1;
    const L = weaponLevelFor('spark', lvl);
    if (this.gs.run.evolution.id === 'burrow_hunter') return this.fireBurrowClaw(angle, L.damage, L.knockback);

    const { player, run } = this.gs;
    const amount = L.amount + run.stats.amountBonus;
    const speed = L.speed * run.stats.projSpeedMult * run.evolution.modifiers.projectileSpeedMult;
    const evolved = (run.weapons.get('spark') ?? 0) >= EVOLVED_LEVEL;
    const tidal = run.evolution.id === 'tidal_shaman';
    for (let i = 0; i < amount; i++) {
      const spread = amount === 1 ? 0 : (i - (amount - 1) / 2) * 0.11;
      const a = angle + spread;
      const p = this.gs.projectiles.get() as Projectile | null;
      if (!p) break;
      p.fire({
        kind: tidal ? 'tidal' : 'bolt',
        x: player.x, y: player.y - 6,
        vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
        damage: L.damage * run.stats.damageMult * run.evolution.modifiers.primaryDamageMult,
        knockback: L.knockback,
        pierce: L.pierce,
        runTime,
        texture: tidal ? 'glow_orb' : 'bolt',
        tint: tidal ? 0x63e6c4 : (evolved ? 0xffa050 : 0x7fd4ff),
        scale: tidal ? 0.62 : (evolved ? 2.1 : 1.7),
        lifespanMs: 1900,
        bodyRadius: tidal ? 8 : 5,
        splashRadius: tidal
          ? EVOLUTION_COMBAT.TIDAL.SPLASH_RADIUS * (this.gs.isInWater() ? 1.25 : 1)
          : 0,
        splashDamageMult: tidal ? EVOLUTION_COMBAT.TIDAL.SPLASH_DAMAGE_MULT : 0
      });
    }
    return true;
  }

  private fireBurrowClaw(angle: number, baseDamage: number, knockback: number): boolean {
    const { player, run, juice } = this.gs;
    const range = EVOLUTION_COMBAT.BURROW.CLAW_RANGE * run.stats.areaMult;
    const ambush = this.gs.consumeAmbush();
    const damageMult = ambush ? EVOLUTION_COMBAT.BURROW.AMBUSH_DAMAGE_MULT : 1;
    juice.slashFlash(player.x, player.y, angle, range, ambush ? 0xffd34e : 0xff9a58);
    Sfx.play('swing', 0.52, ambush ? -180 : -60);
    for (const enemy of this.gs.activeEnemies) {
      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      const distance = Math.hypot(dx, dy);
      if (distance > range + enemy.def.radius) continue;
      const difference = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(dy, dx) - angle));
      if (difference > EVOLUTION_COMBAT.BURROW.CLAW_HALF_ANGLE) continue;
      this.gs.damageEnemy(
        enemy,
        baseDamage * run.stats.damageMult * run.evolution.modifiers.primaryDamageMult * damageMult,
        dx,
        dy,
        knockback * 2
      );
    }
    return true;
  }

  /** Manual core skill: route-specific high-value action. */
  fireCore(runTime: number): boolean {
    switch (this.gs.run.evolution.id) {
      case 'stormwing_archer': return this.fireStormwingCore();
      case 'burrow_hunter': return this.fireBurrowCore();
      case 'tidal_shaman': return this.fireTidalCore(runTime);
      case 'base_creature': return false;
    }
  }

  private fireStormwingCore(): boolean {
    const { player, run, juice } = this.gs;
    const targets = this.gs.activeEnemies
      .filter(enemy => enemy.active && Phaser.Math.Distance.Between(player.x, player.y, enemy.x, enemy.y) <= EVOLUTION_COMBAT.STORMWING.CHAIN_RANGE)
      .sort((a, b) =>
        Phaser.Math.Distance.Squared(player.x, player.y, a.x, a.y) -
        Phaser.Math.Distance.Squared(player.x, player.y, b.x, b.y)
      )
      .slice(0, EVOLUTION_COMBAT.STORMWING.CHAIN_TARGETS);
    if (targets.length === 0) return false;
    let fromX = player.x;
    let fromY = player.y;
    for (const enemy of targets) {
      juice.lightningLink(fromX, fromY, enemy.x, enemy.y);
      juice.lightningStrike(enemy.x, enemy.y, 34);
      this.gs.damageEnemy(
        enemy,
        MANUAL_COMBAT.CORE_DAMAGE * run.stats.damageMult * run.evolution.modifiers.coreDamageMult,
        enemy.x - fromX,
        enemy.y - fromY,
        75
      );
      fromX = enemy.x;
      fromY = enemy.y;
    }
    juice.shake(0.004, 140);
    Sfx.play('zap', 0.6, -80);
    return true;
  }

  private fireBurrowCore(): boolean {
    const { player, run, juice } = this.gs;
    const emergedFromBurrow = this.gs.isBurrowing();
    if (emergedFromBurrow) this.gs.endBurrow(true);
    const radius = EVOLUTION_COMBAT.BURROW.EMERGENCE_RADIUS * run.stats.areaMult;
    const multiplier = emergedFromBurrow ? EVOLUTION_COMBAT.BURROW.AMBUSH_DAMAGE_MULT : 1;
    juice.ringPulse(player.x, player.y, radius, 0xff9a58, 420);
    juice.shake(0.009, 260);
    Sfx.play('nova', 0.62, -240);
    for (const enemy of this.gs.activeEnemies) {
      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      if (dx * dx + dy * dy > (radius + enemy.def.radius) ** 2) continue;
      this.gs.damageEnemy(
        enemy,
        MANUAL_COMBAT.CORE_DAMAGE * run.stats.damageMult * run.evolution.modifiers.coreDamageMult * multiplier,
        dx,
        dy,
        MANUAL_COMBAT.CORE_KNOCKBACK * 1.4
      );
    }
    return true;
  }

  private fireTidalCore(runTime: number): boolean {
    const { player, run, juice } = this.gs;
    const waterBoost = this.gs.isInWater() ? EVOLUTION_COMBAT.TIDAL.WATER_AREA_MULT : 1;
    const radius = EVOLUTION_COMBAT.TIDAL.VORTEX_RADIUS * run.stats.areaMult * waterBoost;
    const x = player.x;
    const y = player.y;
    const duration = EVOLUTION_COMBAT.TIDAL.VORTEX_DURATION_MS;
    const tickMs = EVOLUTION_COMBAT.TIDAL.VORTEX_TICK_MS;
    const ticks = Math.floor(duration / tickMs);
    const tickDamage = MANUAL_COMBAT.CORE_DAMAGE * run.stats.damageMult *
      run.evolution.modifiers.coreDamageMult * 1.5 / ticks;
    const vortex = this.gs.add.image(x, y, 'soft_circle')
      .setDepth(DEPTH.FX - 1)
      .setTint(0x45d9c0)
      .setAlpha(0.28)
      .setScale((radius * 2) / 96);
    this.gs.tweens.add({
      targets: vortex,
      angle: 220,
      alpha: { from: 0.34, to: 0.12 },
      duration,
      onComplete: () => vortex.destroy()
    });
    juice.ringPulse(x, y, radius, 0x63e6c4, 520);
    Sfx.play('nova', 0.5, 80);
    let tick = 0;
    this.gs.time.addEvent({
      delay: tickMs,
      repeat: ticks - 1,
      callback: () => {
        if (this.gs.runEnded || tick++ >= ticks) return;
        for (const enemy of this.gs.activeEnemies) {
          const dx = enemy.x - x;
          const dy = enemy.y - y;
          if (dx * dx + dy * dy > (radius + enemy.def.radius) ** 2) continue;
          enemy.applySlow(EVOLUTION_COMBAT.TIDAL.VORTEX_SLOW_MULT, runTime + (tick + 2) * tickMs);
          this.gs.damageEnemy(enemy, tickDamage, -dx, -dy, 24);
        }
      }
    });
    return true;
  }

  // ---- orbitals: continuous spinning blades ----
  private updateOrbitals(_runTime: number, delta: number) {
    const { run, player } = this.gs;
    const lvl = run.weapons.get('orbitals');
    if (!lvl) return;
    const L = weaponLevelFor('orbitals', lvl);
    const count = L.amount + run.stats.amountBonus;
    const key = `${lvl}:${count}`;
    if (key !== this.bladeKey) this.rebuildBlades(count);

    this.orbitalAngle += Phaser.Math.DegToRad(L.speed) * (delta / 1000);
    const radius = L.area * run.stats.areaMult;
    for (let i = 0; i < this.blades.length; i++) {
      const a = this.orbitalAngle + (i / this.blades.length) * Math.PI * 2;
      const b = this.blades[i];
      b.setPosition(player.x + Math.cos(a) * radius, player.y + Math.sin(a) * radius);
      b.setRotation(a + Math.PI / 2);
    }
  }

  private rebuildBlades(count: number) {
    for (const b of this.blades) b.destroy();
    this.blades = [];
    const evolved = (this.gs.run.weapons.get('orbitals') ?? 0) >= EVOLVED_LEVEL;
    for (let i = 0; i < count; i++) {
      const b = this.gs.orbitalGroup.create(this.gs.player.x, this.gs.player.y, 'tiles', F.DAGGER) as OrbitalBlade;
      b.setScale(evolved ? 2.5 : 2.1).setDepth(DEPTH.PROJECTILE).setTint(evolved ? 0xffd34e : 0xb0e8ff);
      const body = b.body as Phaser.Physics.Arcade.Body;
      body.setCircle(5, 3, 3);
      body.moves = false;
      b.hitGates = new Map();
      this.blades.push(b);
    }
    const lvl = this.gs.run.weapons.get('orbitals') ?? 1;
    this.bladeKey = `${lvl}:${count}`;
  }

  /** overlap callback from GameScene: blade × enemy with per-enemy re-hit gate */
  orbitalHit(bladeObj: Phaser.GameObjects.GameObject, enemy: Enemy, runTime: number) {
    const blade = bladeObj as OrbitalBlade;
    const lvl = this.gs.run.weapons.get('orbitals');
    if (!lvl || !blade.hitGates) return;
    const gate = blade.hitGates.get(enemy) ?? 0;
    if (runTime < gate) return;
    const L = weaponLevelFor('orbitals', lvl);
    blade.hitGates.set(enemy, runTime + L.cooldownMs * this.gs.run.stats.cooldownMult);
    if (blade.hitGates.size > 300) blade.hitGates.clear();
    this.gs.damageEnemy(
      enemy,
      L.damage * this.gs.run.stats.damageMult,
      enemy.x - this.gs.player.x,
      enemy.y - this.gs.player.y,
      L.knockback
    );
  }

  /** soft persistent glow while nova is owned */
  private updateAura() {
    const lvl = this.gs.run.weapons.get('nova');
    if (!lvl) {
      this.auraGlow?.setVisible(false);
      return;
    }
    const L = weaponLevelFor('nova', lvl);
    const radius = L.area * this.gs.run.stats.areaMult;
    if (!this.auraGlow) {
      this.auraGlow = this.gs.add.image(0, 0, 'soft_circle').setDepth(DEPTH.SHADOW).setAlpha(0.1).setTint(0xff7a3c);
    }
    this.auraGlow.setTint(lvl >= EVOLVED_LEVEL ? 0x8cde5a : 0xff7a3c);
    this.auraGlow.setVisible(true).setPosition(this.gs.player.x, this.gs.player.y);
    this.auraGlow.setScale((radius * 2) / 96);
  }

  /** wipe transient visuals on run end */
  destroyVisuals() {
    for (const b of this.blades) b.destroy();
    this.blades = [];
    this.auraGlow?.destroy();
    this.auraGlow = undefined;
  }
}
