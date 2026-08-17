import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { Sfx } from '../systems/audio';

const SFX_KEYS = [
  'hit_0', 'hit_1', 'hit_2', 'die_0', 'die_1', 'hurt', 'boss',
  'gem_0', 'gem_1', 'gem_2', 'coin', 'uiclick', 'choose',
  'swing_0', 'swing_1', 'axe', 'levelup', 'chest', 'heal', 'magnet',
  'zap_0', 'zap_1', 'nova', 'death', 'victory'
];

/** Loads files and generates every procedural texture, then hands off to Title. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const barBg = this.add.rectangle(cx, cy, 320, 14, 0x222233);
    const bar = this.add.rectangle(cx - 158, cy, 2, 10, 0x8c46d8).setOrigin(0, 0.5);
    this.load.on('progress', (p: number) => {
      bar.width = 2 + 314 * p;
    });
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      // missing audio/sprite is non-fatal — the game checks cache before playing
      console.warn('[boot] failed to load', file.key);
    });
    barBg.setDepth(1);
    bar.setDepth(2);

    this.load.spritesheet('tiles', 'assets/sprites/tilemap_packed.png', {
      frameWidth: 16,
      frameHeight: 16
    });
    for (const k of SFX_KEYS) this.load.audio(k, `assets/audio/sfx/${k}.ogg`);
    this.load.audio('music_battle', 'assets/audio/music_battle.mp3');
    this.load.audio('music_title', 'assets/audio/music_title.mp3');
  }

  create() {
    Sfx.init(this.game);
    this.makeSoftTextures();
    this.makeShapeTextures();
    this.makeGroundTexture();
    this.makeIconTextures();
    this.scene.start('Title');
  }

  /** radial-gradient textures need a real canvas ctx */
  private makeSoftTextures() {
    const radial = (key: string, size: number, stops: [number, string][]) => {
      const ct = this.textures.createCanvas(key, size, size);
      if (!ct) return;
      const ctx = ct.getContext();
      const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      for (const [at, color] of stops) g.addColorStop(at, color);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
      ct.refresh();
    };

    // white core orb with feathered edge — tintable projectile/glow base
    radial('glow_orb', 32, [
      [0, 'rgba(255,255,255,1)'],
      [0.45, 'rgba(255,255,255,0.95)'],
      [0.7, 'rgba(255,255,255,0.35)'],
      [1, 'rgba(255,255,255,0)']
    ]);
    // bigger, softer halo
    radial('soft_circle', 96, [
      [0, 'rgba(255,255,255,0.9)'],
      [0.5, 'rgba(255,255,255,0.35)'],
      [1, 'rgba(255,255,255,0)']
    ]);
    // soft black ellipse shadow (squashed at draw time)
    radial('shadow', 48, [
      [0, 'rgba(0,0,0,0.45)'],
      [0.7, 'rgba(0,0,0,0.25)'],
      [1, 'rgba(0,0,0,0)']
    ]);

    // screen-space vignette
    const vt = this.textures.createCanvas('vignette', GAME_WIDTH, GAME_HEIGHT);
    if (vt) {
      const ctx = vt.getContext();
      const g = ctx.createRadialGradient(
        GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_HEIGHT * 0.42,
        GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_HEIGHT * 0.92
      );
      g.addColorStop(0, 'rgba(6,6,14,0)');
      g.addColorStop(1, 'rgba(6,6,14,0.55)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      vt.refresh();
    }
  }

  /** graphics-drawn shapes: pixel, bolt, gem, coin, ring, slash arc, lightning */
  private makeShapeTextures() {
    const g = this.make.graphics({ x: 0, y: 0 }, false);

    // 2x2 particle pixel
    g.fillStyle(0xffffff, 1).fillRect(0, 0, 2, 2);
    g.generateTexture('px', 2, 2);
    g.clear();

    // spark bolt — white capsule, tinted at use
    g.fillStyle(0xffffff, 0.55).fillRoundedRect(0, 0, 16, 7, 3);
    g.fillStyle(0xffffff, 1).fillRoundedRect(2, 1, 12, 5, 2);
    g.generateTexture('bolt', 16, 7);
    g.clear();

    // xp gem — diamond with facet highlight
    g.fillStyle(0xffffff, 1);
    g.fillPoints([
      { x: 6, y: 0 }, { x: 12, y: 6 }, { x: 6, y: 15 }, { x: 0, y: 6 }
    ] as Phaser.Types.Math.Vector2Like[], true);
    g.fillStyle(0xffffff, 0.45);
    g.fillPoints([
      { x: 6, y: 2 }, { x: 9, y: 6 }, { x: 6, y: 9 }, { x: 3, y: 6 }
    ] as Phaser.Types.Math.Vector2Like[], true);
    g.generateTexture('gem', 13, 16);
    g.clear();

    // gold coin
    g.fillStyle(0xa8741a, 1).fillCircle(6, 6, 6);
    g.fillStyle(0xffd34e, 1).fillCircle(6, 6, 5);
    g.fillStyle(0xfff1b0, 1).fillRect(3, 3, 2, 2);
    g.generateTexture('coin', 12, 12);
    g.clear();

    // thin ring outline (nova pulse, magnet flash)
    g.lineStyle(4, 0xffffff, 1).strokeCircle(33, 33, 30);
    g.generateTexture('ring', 66, 66);
    g.clear();

    // slash arc — 100° white sector with soft inner cut, points to +x
    const R = 64;
    g.fillStyle(0xffffff, 0.28);
    g.slice(R, R, R, Phaser.Math.DegToRad(-50), Phaser.Math.DegToRad(50), false);
    g.fillPath();
    g.fillStyle(0xffffff, 0.85);
    g.slice(R, R, R, Phaser.Math.DegToRad(-38), Phaser.Math.DegToRad(38), false);
    g.fillPath();
    g.fillStyle(0xffffff, 0);
    g.generateTexture('slash', R * 2, R * 2);
    g.clear();

    // lightning bolt strip (drawn top→bottom, jagged)
    const seg: [number, number][] = [
      [16, 0], [10, 28], [20, 44], [8, 76], [18, 96], [12, 128]
    ];
    g.lineStyle(7, 0xffffff, 0.35);
    g.beginPath();
    g.moveTo(seg[0][0], seg[0][1]);
    for (const [x, y] of seg) g.lineTo(x, y);
    g.strokePath();
    g.lineStyle(3, 0xffffff, 1);
    g.beginPath();
    g.moveTo(seg[0][0], seg[0][1]);
    for (const [x, y] of seg) g.lineTo(x, y);
    g.strokePath();
    g.generateTexture('lightning', 28, 130);
    g.clear();

    g.destroy();
  }

  /** 8×8 random dirt tiles composited into one repeating 128px ground texture */
  private makeGroundTexture() {
    const ct = this.textures.createCanvas('ground', 128, 128);
    if (!ct) return;
    const ctx = ct.getContext();
    const img = this.textures.get('tiles').getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const rng = new Phaser.Math.RandomDataGenerator(['gravehorde']);
    const plain = [0, 1, 13, 25];
    const pebbly = [12, 24];
    for (let ty = 0; ty < 8; ty++) {
      for (let tx = 0; tx < 8; tx++) {
        // mostly featureless dirt; sparse pebble tiles so the repeat isn't loud
        const frame = rng.frac() < 0.1 ? rng.pick(pebbly) : rng.pick(plain);
        const col = frame % 12;
        const row = Math.floor(frame / 12);
        ctx.drawImage(img, col * 16, row * 16, 16, 16, tx * 16, ty * 16, 16, 16);
      }
    }
    // night mood pass
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = 'rgb(168,158,182)';
    ctx.fillRect(0, 0, 128, 128);
    ctx.globalCompositeOperation = 'source-over';
    ct.refresh();
  }

  /** small drawn icons for upgrades that have no good tile frame */
  private makeIconTextures() {
    const g = this.make.graphics({ x: 0, y: 0 }, false);

    // storm — lightning bolt zigzag
    g.fillStyle(0xffe14e, 1);
    g.fillPoints([
      { x: 13, y: 0 }, { x: 4, y: 12 }, { x: 9, y: 12 }, { x: 6, y: 22 },
      { x: 17, y: 9 }, { x: 11, y: 9 }
    ] as Phaser.Types.Math.Vector2Like[], true);
    g.generateTexture('icon_storm', 21, 22);
    g.clear();

    // nova — flame ring
    g.lineStyle(3, 0xff8c2e, 1).strokeCircle(11, 11, 8);
    g.fillStyle(0xffd34e, 1).fillCircle(11, 11, 4);
    g.generateTexture('icon_nova', 22, 22);
    g.clear();

    // heart (vitality)
    g.fillStyle(0xe04050, 1);
    g.fillCircle(7, 8, 5);
    g.fillCircle(15, 8, 5);
    g.fillPoints([
      { x: 2, y: 10 }, { x: 20, y: 10 }, { x: 11, y: 21 }
    ] as Phaser.Types.Math.Vector2Like[], true);
    g.generateTexture('icon_heart', 22, 22);
    g.clear();

    // swiftness — double chevron
    g.fillStyle(0x5ad8e6, 1);
    g.fillPoints([
      { x: 2, y: 4 }, { x: 9, y: 11 }, { x: 2, y: 18 }, { x: 6, y: 11 }
    ] as Phaser.Types.Math.Vector2Like[], true);
    g.fillPoints([
      { x: 10, y: 4 }, { x: 17, y: 11 }, { x: 10, y: 18 }, { x: 14, y: 11 }
    ] as Phaser.Types.Math.Vector2Like[], true);
    g.generateTexture('icon_swift', 19, 22);
    g.clear();

    // blood drop
    g.fillStyle(0xd83a3a, 1);
    g.fillCircle(9, 14, 7);
    g.fillPoints([
      { x: 9, y: 0 }, { x: 15, y: 12 }, { x: 3, y: 12 }
    ] as Phaser.Types.Math.Vector2Like[], true);
    g.fillStyle(0xff9a9a, 1).fillCircle(6, 13, 2);
    g.generateTexture('icon_blood', 18, 22);
    g.clear();

    // echo — twin diamonds
    g.fillStyle(0xb46ae6, 0.6);
    g.fillPoints([
      { x: 13, y: 2 }, { x: 20, y: 10 }, { x: 13, y: 18 }, { x: 6, y: 10 }
    ] as Phaser.Types.Math.Vector2Like[], true);
    g.fillStyle(0xb46ae6, 1);
    g.fillPoints([
      { x: 9, y: 4 }, { x: 16, y: 12 }, { x: 9, y: 20 }, { x: 2, y: 12 }
    ] as Phaser.Types.Math.Vector2Like[], true);
    g.generateTexture('icon_echo', 22, 22);
    g.clear();

    g.destroy();
  }
}
