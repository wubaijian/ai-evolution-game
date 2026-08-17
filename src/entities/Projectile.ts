import Phaser from 'phaser';
import { DEPTH } from '../config';

export type ProjectileKind = 'bolt' | 'tidal' | 'axe' | 'orb';

/**
 * One pooled class for every flying thing: player bolts, lobbed axes,
 * and enemy orbs (which live in their own group).
 */
export class Projectile extends Phaser.Physics.Arcade.Sprite {
  kind: ProjectileKind = 'bolt';
  damage = 0;
  knockback = 0;
  pierceLeft = 0;
  bornAt = 0;
  lifespanMs = 2000;
  spin = 0;
  splashRadius = 0;
  splashDamageMult = 0;
  /** enemies already hit by this projectile (pierce bookkeeping) */
  readonly hits = new Set<object>();

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'glow_orb');
  }

  fire(opts: {
    kind: ProjectileKind;
    x: number;
    y: number;
    vx: number;
    vy: number;
    damage: number;
    knockback: number;
    pierce: number;
    runTime: number;
    texture: string;
    frame?: number;
    tint?: number;
    scale?: number;
    lifespanMs?: number;
    spin?: number;
    gravityY?: number;
    bodyRadius?: number;
    splashRadius?: number;
    splashDamageMult?: number;
  }) {
    this.kind = opts.kind;
    this.damage = opts.damage;
    this.knockback = opts.knockback;
    this.pierceLeft = opts.pierce;
    this.bornAt = opts.runTime;
    this.lifespanMs = opts.lifespanMs ?? 2200;
    this.spin = opts.spin ?? 0;
    this.splashRadius = opts.splashRadius ?? 0;
    this.splashDamageMult = opts.splashDamageMult ?? 0;
    this.hits.clear();

    this.setTexture(opts.texture, opts.frame);
    this.setScale(opts.scale ?? 1);
    this.setDepth(DEPTH.PROJECTILE);
    if (opts.tint !== undefined) this.setTint(opts.tint); else this.clearTint();
    this.setRotation(Math.atan2(opts.vy, opts.vx));

    this.enableBody(true, opts.x, opts.y, true, true);
    const body = this.body as Phaser.Physics.Arcade.Body;
    const frameW = this.frame.width;
    const r = (opts.bodyRadius ?? Math.max(4, frameW * 0.3)) / (opts.scale ?? 1);
    body.setCircle(r, frameW / 2 - r, this.frame.height / 2 - r);
    body.setAllowGravity(opts.gravityY !== undefined);
    if (opts.gravityY !== undefined) body.setGravityY(opts.gravityY);
    body.velocity.set(opts.vx, opts.vy);
  }

  /**
   * Spin/rotation upkeep only — lifespan is checked by GameScene against its
   * pausable run-clock, so pausing never expires projectiles. Group has
   * runChildUpdate enabled.
   */
  preUpdate(time: number, delta: number) {
    super.preUpdate(time, delta);
    if (!this.active) return;
    if (this.spin !== 0) {
      this.rotation += this.spin * (delta / 1000);
    } else if (this.kind === 'bolt') {
      const body = this.body as Phaser.Physics.Arcade.Body;
      this.setRotation(Math.atan2(body.velocity.y, body.velocity.x));
    }
  }

  recycle() {
    this.disableBody(true, true);
  }
}
