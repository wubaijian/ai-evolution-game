import Phaser from 'phaser';
import { DEPTH } from '../config';
import { ENEMY_FRAME } from '../data/enemies';
import type { EnemyDef } from '../types';

export interface EnemyContext {
  /** cultists/bosses fire orbs through this */
  fireEnemyOrb(from: Enemy, dirX: number, dirY: number, speed: number, damage: number): void;
}

const KNOCK_DECAY = 0.86;
const ELITE_TINT = 0xffd34e;

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  def!: EnemyDef;
  hp = 1;
  maxHp = 1;
  contactDamage = 1;
  xpValue = 1;
  isElite = false;
  /** runTime until white hit-flash ends */
  flashUntil = 0;
  /** runTime when this enemy may deal contact damage again */
  nextContactAt = 0;
  private baseTint = 0xffffff;
  private hasTint = false;
  private knockVel = new Phaser.Math.Vector2();
  private bobSeed = Math.random() * 1000;
  private nextRangedAt = 0;
  private driftDir = new Phaser.Math.Vector2();
  private nextDriftAt = 0;
  private slowedUntil = 0;
  private slowMultiplier = 1;
  // boss-specific timers
  private nextSpecialAt = 0;
  private chargeUntil = 0;
  private telegraphUntil = 0;
  private phaseTransitionUntil = 0;
  bossPhase: 1 | 2 = 1;
  spawnedAt = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'tiles', 0);
  }

  spawn(def: EnemyDef, x: number, y: number, runTime: number, hpMult: number, dmgMult: number, elite = false) {
    this.def = def;
    this.isElite = elite;
    const eliteHp = elite ? 9 : 1;
    const eliteDmg = elite ? 1.4 : 1;
    this.maxHp = Math.round(def.hp * hpMult * eliteHp);
    this.hp = this.maxHp;
    this.contactDamage = Math.round(def.damage * dmgMult * eliteDmg);
    this.xpValue = def.xp * (elite ? 10 : 1);
    this.spawnedAt = runTime;
    this.flashUntil = 0;
    this.nextContactAt = 0;
    this.nextRangedAt = runTime + (def.ranged ? def.ranged.intervalMs * 0.5 : 0);
    this.nextSpecialAt = runTime + 3000;
    this.chargeUntil = 0;
    this.telegraphUntil = 0;
    this.phaseTransitionUntil = 0;
    this.bossPhase = 1;
    this.specialFlip = false;
    this.nextDriftAt = 0;
    this.slowedUntil = 0;
    this.slowMultiplier = 1;
    this.knockVel.set(0, 0);

    this.setFrame(ENEMY_FRAME[def.id]);
    const scale = def.scale * (elite ? 1.35 : 1);
    this.setScale(scale);
    this.setDepth(def.boss ? DEPTH.ENEMY + 1 : DEPTH.ENEMY);
    this.setAlpha(def.drifter ? 0.82 : 1);
    this.baseTint = elite ? ELITE_TINT : (def.tint ?? 0xffffff);
    this.hasTint = elite || def.tint !== undefined;
    if (this.hasTint) this.setTint(this.baseTint); else this.clearTint();

    this.enableBody(true, x, y, true, true);
    const body = this.body as Phaser.Physics.Arcade.Body;
    const r = def.radius / scale;
    body.setCircle(r, 8 - r, 8 - r);
    body.pushable = !def.boss;
  }

  takeHit(damage: number, runTime: number, knockX: number, knockY: number, knockForce: number): boolean {
    this.hp -= damage;
    this.flashUntil = runTime + 80;
    const resist = 1 - this.def.knockbackResist;
    if (resist > 0 && knockForce > 0) {
      const len = Math.hypot(knockX, knockY) || 1;
      this.knockVel.x += (knockX / len) * knockForce * resist;
      this.knockVel.y += (knockY / len) * knockForce * resist;
      const max = 420;
      if (this.knockVel.lengthSq() > max * max) this.knockVel.setLength(max);
    }
    return this.hp <= 0;
  }

  applySlow(multiplier: number, until: number) {
    this.slowMultiplier = Math.min(this.slowMultiplier, Phaser.Math.Clamp(multiplier, 0.2, 1));
    this.slowedUntil = Math.max(this.slowedUntil, until);
  }

  enterBossPhaseTwo(runTime: number) {
    if (!this.def.boss || this.bossPhase === 2) return false;
    this.bossPhase = 2;
    this.phaseTransitionUntil = runTime + 850;
    this.nextSpecialAt = runTime + 1100;
    this.contactDamage = Math.round(this.contactDamage * 1.25);
    this.slowedUntil = 0;
    this.slowMultiplier = 1;
    this.knockVel.set(0, 0);
    this.baseTint = 0xb04cff;
    this.hasTint = true;
    this.setTintFill(0xffffff);
    return true;
  }

  /** main brain — called from GameScene's tight loop while active */
  updateEnemy(runTime: number, _delta: number, player: Phaser.GameObjects.Sprite, ctx: EnemyContext) {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist;
    const ny = dy / dist;
    let vx = 0;
    let vy = 0;
    const d = this.def;

    if (d.boss) {
      ({ vx, vy } = this.bossBrain(runTime, dist, nx, ny, ctx));
    } else if (d.fleeing) {
      // mimic: bolt away from the player with panicky course changes
      if (runTime >= this.nextDriftAt) {
        const away = Math.atan2(-ny, -nx) + Phaser.Math.FloatBetween(-0.7, 0.7);
        this.driftDir.set(Math.cos(away), Math.sin(away));
        this.nextDriftAt = runTime + Phaser.Math.Between(500, 1000);
      }
      vx = this.driftDir.x * d.speed;
      vy = this.driftDir.y * d.speed;
    } else if (d.drifter) {
      // wraiths glide in straight lines re-aimed at the player every few seconds
      if (runTime >= this.nextDriftAt) {
        const wobble = Phaser.Math.FloatBetween(-0.6, 0.6);
        this.driftDir.set(
          nx * Math.cos(wobble) - ny * Math.sin(wobble),
          nx * Math.sin(wobble) + ny * Math.cos(wobble)
        );
        this.nextDriftAt = runTime + Phaser.Math.Between(1400, 2600);
      }
      vx = this.driftDir.x * d.speed;
      vy = this.driftDir.y * d.speed;
    } else if (d.ranged) {
      // acolytes close to firing range, then strafe and cast
      if (dist > d.ranged.keepDistance + 40) {
        vx = nx * d.speed;
        vy = ny * d.speed;
      } else if (dist < d.ranged.keepDistance - 40) {
        vx = -nx * d.speed * 0.8;
        vy = -ny * d.speed * 0.8;
      } else {
        vx = -ny * d.speed * 0.5;
        vy = nx * d.speed * 0.5;
      }
      if (dist <= d.ranged.range && runTime >= this.nextRangedAt) {
        this.nextRangedAt = runTime + d.ranged.intervalMs;
        ctx.fireEnemyOrb(this, nx, ny, d.ranged.projSpeed, d.ranged.projDamage);
      }
    } else {
      vx = nx * d.speed;
      vy = ny * d.speed;
    }

    const slow = runTime < this.slowedUntil ? this.slowMultiplier : 1;
    if (slow === 1) this.slowMultiplier = 1;
    body.velocity.set(vx * slow + this.knockVel.x, vy * slow + this.knockVel.y);
    this.knockVel.scale(KNOCK_DECAY);

    if (vx !== 0) this.setFlipX(vx < 0);
    // hit flash / tint upkeep
    if (runTime < this.flashUntil) {
      this.setTintFill(0xffffff);
    } else if (this.hasTint) {
      this.setTint(this.baseTint);
    } else {
      this.clearTint();
    }
    // cheap walk wobble
    const s = this.scaleX;
    this.scaleY = s * (1 + Math.sin((runTime + this.bobSeed) * 0.012) * 0.05);
  }

  private bossBrain(runTime: number, dist: number, nx: number, ny: number, ctx: EnemyContext): { vx: number; vy: number } {
    const d = this.def;
    let speed = d.speed;
    let vx = nx * speed;
    let vy = ny * speed;

    if (d.id === 'boss_colossus') {
      // telegraphed charge every ~6s
      if (runTime >= this.nextSpecialAt) {
        this.telegraphUntil = runTime + 450;
        this.chargeUntil = runTime + 450 + 1100;
        this.nextSpecialAt = runTime + 6200;
      }
      if (runTime < this.telegraphUntil) {
        this.setTint(0xff6060);
        return { vx: 0, vy: 0 };
      }
      if (runTime < this.chargeUntil) {
        this.setTint(0xff9090);
        return { vx: nx * speed * 3.4, vy: ny * speed * 3.4 };
      }
      this.baseTint = this.isElite ? ELITE_TINT : (d.tint ?? 0xffffff);
      this.setTint(this.baseTint);
    } else if (d.id === 'boss_witch') {
      // hold distance; radial bullet ring + aimed spread alternating
      if (dist < (d.ranged?.keepDistance ?? 210)) {
        vx = -nx * speed;
        vy = -ny * speed;
      } else if (dist > 320) {
        vx = nx * speed;
        vy = ny * speed;
      } else {
        vx = -ny * speed * 0.7;
        vy = nx * speed * 0.7;
      }
      if (runTime >= this.nextSpecialAt && d.ranged) {
        this.nextSpecialAt = runTime + d.ranged.intervalMs;
        const ring = (this.specialFlip = !this.specialFlip);
        if (ring) {
          const n = 14;
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2;
            ctx.fireEnemyOrb(this, Math.cos(a), Math.sin(a), d.ranged.projSpeed, d.ranged.projDamage);
          }
        } else {
          for (const off of [-0.28, 0, 0.28]) {
            const a = Math.atan2(ny, nx) + off;
            ctx.fireEnemyOrb(this, Math.cos(a), Math.sin(a), d.ranged.projSpeed * 1.35, d.ranged.projDamage);
          }
        }
      }
    } else if (d.id === 'boss_reaper') {
      if (runTime < this.phaseTransitionUntil) return { vx: 0, vy: 0 };
      if (this.bossPhase === 1) {
        // Phase I: a readable chase plus aimed three-shot fans.
        speed = d.speed;
        vx = nx * speed;
        vy = ny * speed;
        if (runTime >= this.nextSpecialAt) {
          this.nextSpecialAt = runTime + 3000;
          for (const off of [-0.2, 0, 0.2]) {
            const a = Math.atan2(ny, nx) + off;
            ctx.fireEnemyOrb(this, Math.cos(a), Math.sin(a), 165, 11);
          }
        }
      } else {
        // Phase II: faster pursuit and a frequent spiral force route-specific survival.
        const aliveSec = (runTime - this.spawnedAt) / 1000;
        speed = Math.min(112, d.speed * 1.42 + aliveSec * 0.22);
        vx = nx * speed;
        vy = ny * speed;
        if (runTime >= this.nextSpecialAt) {
          this.nextSpecialAt = runTime + 3200;
          const base = Math.random() * Math.PI * 2;
          for (let i = 0; i < 12; i++) {
            const a = base + i * 0.52;
            ctx.fireEnemyOrb(this, Math.cos(a), Math.sin(a), 135 + i * 7, 12);
          }
        }
      }
    }
    return { vx, vy };
  }

  private specialFlip = false;
}
