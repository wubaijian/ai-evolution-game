import Phaser from 'phaser';
import { DEPTH, FONT, POOL_SIZES } from '../config';

/**
 * All the feedback: pooled damage numbers, particle bursts, ring pulses,
 * slash flashes, lightning bolts, screen shake and announcements.
 */
export class Juice {
  private scene: Phaser.Scene;
  private texts: Phaser.GameObjects.Text[] = [];
  private poof: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private glitter: Phaser.GameObjects.Particles.ParticleEmitter;
  private announcement?: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    for (let i = 0; i < POOL_SIZES.DAMAGE_TEXTS; i++) {
      const t = scene.add
        .text(0, 0, '', {
          fontFamily: FONT,
          fontSize: '11px',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 3
        })
        .setOrigin(0.5)
        .setDepth(DEPTH.FX)
        .setActive(false)
        .setVisible(false);
      this.texts.push(t);
    }

    this.poof = scene.add.particles(0, 0, 'px', {
      speed: { min: 30, max: 130 },
      scale: { start: 2.2, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: { min: 220, max: 420 },
      emitting: false
    }).setDepth(DEPTH.FX);

    this.sparks = scene.add.particles(0, 0, 'px', {
      speed: { min: 60, max: 220 },
      scale: { start: 1.6, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: { min: 120, max: 260 },
      emitting: false
    }).setDepth(DEPTH.FX);

    this.glitter = scene.add.particles(0, 0, 'px', {
      speed: { min: 20, max: 80 },
      scale: { start: 1.4, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: { min: 180, max: 360 },
      emitting: false
    }).setDepth(DEPTH.FX);
  }

  damageNumber(x: number, y: number, value: number, color = '#ffffff', big = false) {
    const t = this.texts.find(t => !t.active);
    if (!t) return;
    t.setActive(true)
      .setVisible(true)
      .setPosition(x + Phaser.Math.Between(-6, 6), y - 10)
      .setText(String(Math.round(value)))
      .setColor(color)
      .setFontSize(big ? '16px' : '11px')
      .setAlpha(1)
      .setScale(1);
    this.scene.tweens.killTweensOf(t);
    this.scene.tweens.add({
      targets: t,
      y: t.y - (big ? 42 : 30),
      alpha: 0,
      scale: big ? 1.25 : 1,
      duration: big ? 700 : 520,
      ease: 'Cubic.Out',
      onComplete: () => t.setActive(false).setVisible(false)
    });
  }

  floatText(x: number, y: number, str: string, color: string) {
    const t = this.texts.find(t => !t.active);
    if (!t) return;
    t.setActive(true).setVisible(true).setPosition(x, y).setText(str).setColor(color)
      .setFontSize('11px').setAlpha(1).setScale(1);
    this.scene.tweens.killTweensOf(t);
    this.scene.tweens.add({
      targets: t,
      y: y - 36,
      alpha: 0,
      duration: 800,
      ease: 'Cubic.Out',
      onComplete: () => t.setActive(false).setVisible(false)
    });
  }

  deathPoof(x: number, y: number, tint: number) {
    this.poof.setParticleTint(tint);
    this.poof.explode(Phaser.Math.Between(8, 12), x, y);
  }

  impact(x: number, y: number, tint = 0xfff2b0) {
    this.sparks.setParticleTint(tint);
    this.sparks.explode(Phaser.Math.Between(4, 7), x, y);
  }

  sparkle(x: number, y: number, tint = 0x66e0ff) {
    this.glitter.setParticleTint(tint);
    this.glitter.explode(6, x, y);
  }

  /** expanding ring (nova pulse, magnet vacuum, chest open) */
  ringPulse(x: number, y: number, radius: number, tint: number, durationMs = 320) {
    const ring = this.scene.add.image(x, y, 'ring').setDepth(DEPTH.FX).setTint(tint);
    ring.setScale(0.2).setAlpha(0.9);
    this.scene.tweens.add({
      targets: ring,
      scale: (radius * 2) / 66,
      alpha: 0,
      duration: durationMs,
      ease: 'Cubic.Out',
      onComplete: () => ring.destroy()
    });
  }

  /** sword sweep flash; angleRad points along the swing center */
  slashFlash(x: number, y: number, angleRad: number, radius: number, tint = 0xcfe8ff) {
    const img = this.scene.add.image(x, y, 'slash').setDepth(DEPTH.FX);
    img.setOrigin(0.5).setRotation(angleRad).setTint(tint);
    img.setScale(radius / 64).setAlpha(0.85);
    this.scene.tweens.add({
      targets: img,
      alpha: 0,
      scale: (radius / 64) * 1.15,
      duration: 160,
      ease: 'Quad.Out',
      onComplete: () => img.destroy()
    });
  }

  lightningStrike(x: number, y: number, splash: number) {
    const bolt = this.scene.add.image(x, y, 'lightning').setDepth(DEPTH.FX);
    bolt.setOrigin(0.5, 1).setTint(0xfff7c0).setAlpha(1);
    bolt.setScale(Phaser.Math.FloatBetween(0.8, 1.1));
    if (Math.random() < 0.5) bolt.setFlipX(true);
    this.scene.tweens.add({
      targets: bolt,
      alpha: 0,
      duration: 200,
      delay: 60,
      onComplete: () => bolt.destroy()
    });
    const flash = this.scene.add.image(x, y, 'soft_circle').setDepth(DEPTH.FX)
      .setTint(0xfff7c0).setScale((splash * 2) / 96).setAlpha(0.8);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 240,
      onComplete: () => flash.destroy()
    });
    this.impact(x, y, 0xffe14e);
  }

  lightningLink(fromX: number, fromY: number, toX: number, toY: number) {
    const graphics = this.scene.add.graphics().setDepth(DEPTH.FX);
    const points: Phaser.Math.Vector2[] = [new Phaser.Math.Vector2(fromX, fromY)];
    const segments = 6;
    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      points.push(new Phaser.Math.Vector2(
        Phaser.Math.Linear(fromX, toX, t) + Phaser.Math.Between(-8, 8),
        Phaser.Math.Linear(fromY, toY, t) + Phaser.Math.Between(-8, 8)
      ));
    }
    points.push(new Phaser.Math.Vector2(toX, toY));
    graphics.lineStyle(7, 0x5aaaff, 0.22).strokePoints(points);
    graphics.lineStyle(3, 0xdff8ff, 0.95).strokePoints(points);
    this.scene.tweens.add({
      targets: graphics,
      alpha: 0,
      duration: 190,
      onComplete: () => graphics.destroy()
    });
  }

  shake(intensity = 0.004, durationMs = 120) {
    this.scene.cameras.main.shake(durationMs, intensity);
  }

  /** big center-screen announcement (boss names, warnings) */
  announce(str: string, color = '#ff5050') {
    if (this.announcement) {
      this.scene.tweens.killTweensOf(this.announcement);
      this.announcement.destroy();
      this.announcement = undefined;
    }
    const cam = this.scene.cameras.main;
    const t = this.scene.add
      .text(cam.midPoint.x, cam.midPoint.y - 120, str, {
        fontFamily: FONT,
        fontSize: '26px',
        color,
        stroke: '#000000',
        strokeThickness: 6,
        align: 'center'
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.OVERLAY)
      .setScrollFactor(0)
      .setPosition(480, 150)
      .setAlpha(0)
      .setScale(0.7);
    this.announcement = t;
    this.scene.tweens.add({
      targets: t,
      alpha: 1,
      scale: 1,
      duration: 220,
      ease: 'Back.Out',
      yoyo: true,
      hold: 1500,
      onComplete: () => {
        if (this.announcement === t) this.announcement = undefined;
        t.destroy();
      }
    });
  }
}
