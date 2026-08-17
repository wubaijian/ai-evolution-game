import Phaser from 'phaser';
import { DEPTH, PLAYER } from '../config';
import { F } from '../data/frames';
import type { PlayerStats } from '../types';
import { Sfx } from '../systems/audio';

export class Player extends Phaser.Physics.Arcade.Sprite {
  hp: number;
  stats!: PlayerStats; // assigned by GameScene right after construction
  /** runTime ms until which the player ignores damage */
  iframesUntil = 0;
  private shadow: Phaser.GameObjects.Image;
  private bobT = 0;
  private evolutionTint = 0xffffff;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'tiles', F.PLAYER);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setScale(PLAYER.SCALE).setDepth(DEPTH.PLAYER);
    const r = PLAYER.RADIUS / PLAYER.SCALE;
    (this.body as Phaser.Physics.Arcade.Body).setCircle(r, 8 - r, 8 - r + 1.5);
    this.hp = PLAYER.BASE_HP;
    this.shadow = scene.add
      .image(x, y + 16, 'shadow')
      .setDepth(DEPTH.SHADOW)
      .setScale(0.8, 0.4)
      .setAlpha(0.8);
  }

  setEvolutionTint(tint: number) {
    this.evolutionTint = tint;
    this.setTint(tint);
  }

  /** dir is raw input (-1..1 per axis); applies speed + walk bob */
  move(dirX: number, dirY: number, delta: number, speed = this.stats.moveSpeed) {
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (dirX !== 0 || dirY !== 0) {
      const v = new Phaser.Math.Vector2(dirX, dirY).normalize().scale(speed);
      body.velocity.set(v.x, v.y);
      if (dirX !== 0) this.setFlipX(dirX < 0);
      this.bobT += delta;
      this.setScale(PLAYER.SCALE, PLAYER.SCALE * (1 + Math.sin(this.bobT * 0.018) * 0.045));
      this.setRotation(Math.sin(this.bobT * 0.018) * 0.05);
    } else {
      body.velocity.set(0, 0);
      this.setScale(PLAYER.SCALE, PLAYER.SCALE);
      this.setRotation(0);
    }
    this.shadow.setPosition(this.x, this.y + 16);
  }

  /** returns actual damage dealt (0 when i-framed). Armor already applied by caller. */
  hurt(amount: number, runTime: number): number {
    if (runTime < this.iframesUntil || this.hp <= 0) return 0;
    this.iframesUntil = runTime + PLAYER.IFRAMES_MS;
    this.hp = Math.max(0, this.hp - amount);
    Sfx.play('hurt', 0.65);
    this.scene.tweens.killTweensOf(this);
    this.setTintFill(0xff4444);
    this.scene.tweens.add({
      targets: this,
      alpha: { from: 0.35, to: 1 },
      duration: 110,
      repeat: 3,
      onComplete: () => {
        this.setTint(this.evolutionTint);
        this.setAlpha(1);
      }
    });
    return amount;
  }

  heal(amount: number) {
    this.hp = Math.min(this.stats.maxHp, this.hp + amount);
  }

  destroyWithShadow() {
    this.shadow.destroy();
    this.destroy();
  }
}
