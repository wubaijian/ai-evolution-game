import Phaser from 'phaser';
import { COLORS, FONT, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { META_ORDER, META_UPGRADES, metaNextCost } from '../data/meta';
import { Sfx } from '../systems/audio';
import { loadSave, storeSave } from '../systems/save';
import type { MetaUpgradeDef, SaveData } from '../types';

const CARD_W = 200;
const CARD_H = 160;
const COLS = 4;

interface ShopCard {
  def: MetaUpgradeDef;
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Image;
  pips: Phaser.GameObjects.Rectangle[];
  costText: Phaser.GameObjects.Text;
}

/** Between-runs shop: spend banked gold on permanent upgrades (saved immediately). */
export class ShopScene extends Phaser.Scene {
  private save!: SaveData;
  private cards: ShopCard[] = [];
  private goldText!: Phaser.GameObjects.Text;
  private selected = 0;
  private leaving = false;

  constructor() {
    super('Shop');
  }

  create() {
    this.cards = [];
    this.selected = 0;
    this.leaving = false;
    this.save = loadSave();
    this.ensureCardTextures();

    const ground = this.add
      .tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, 'ground')
      .setOrigin(0)
      .setTileScale(2)
      .setAlpha(0.3);
    this.tweens.add({ targets: ground, tilePositionX: 300, duration: 60000, repeat: -1 });
    this.add.image(0, 0, 'vignette').setOrigin(0);

    this.add
      .text(GAME_WIDTH / 2, 36, '墓穴商店', {
        fontFamily: FONT,
        fontSize: '24px',
        color: COLORS.TEXT,
        stroke: COLORS.ACCENT,
        strokeThickness: 6
      })
      .setOrigin(0.5)
      .setShadow(0, 4, '#000000', 0, true, true);
    this.add
      .text(GAME_WIDTH / 2, 64, '用战利品购买能够保留到下一局的力量', {
        fontFamily: FONT,
        fontSize: '9px',
        color: COLORS.TEXT_DIM
      })
      .setOrigin(0.5);

    // gold balance
    this.add.image(GAME_WIDTH / 2 - 52, 92, 'coin').setScale(1.6);
    this.goldText = this.add
      .text(GAME_WIDTH / 2 - 38, 92, '', {
        fontFamily: FONT,
        fontSize: '14px',
        color: '#ffd34e',
        stroke: '#000000',
        strokeThickness: 3
      })
      .setOrigin(0, 0.5);

    // 4×2 card grid
    const gridW = COLS * CARD_W + (COLS - 1) * 16;
    const x0 = (GAME_WIDTH - gridW) / 2 + CARD_W / 2;
    META_ORDER.forEach((id, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      this.buildCard(META_UPGRADES[id], x0 + col * (CARD_W + 16), 196 + row * (CARD_H + 16), i);
    });

    // footer actions
    this.footerButton(GAME_WIDTH / 2 - 130, GAME_HEIGHT - 28, '[T] 返回标题', () => this.exit('Title'));
    this.footerButton(GAME_WIDTH / 2 + 130, GAME_HEIGHT - 28, '[F] 开始战斗', () => this.exit('Game'));
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 52, '方向键 + ENTER 购买  ·  也可以点击选择', {
        fontFamily: FONT,
        fontSize: '8px',
        color: COLORS.TEXT_DIM
      })
      .setOrigin(0.5);

    const kb = this.input.keyboard!;
    kb.on('keydown-LEFT', () => this.moveSel(-1));
    kb.on('keydown-RIGHT', () => this.moveSel(1));
    kb.on('keydown-UP', () => this.moveSel(-COLS));
    kb.on('keydown-DOWN', () => this.moveSel(COLS));
    kb.on('keydown-ENTER', () => this.buy(this.selected));
    kb.on('keydown-SPACE', () => this.buy(this.selected));
    kb.on('keydown-T', () => this.exit('Title'));
    kb.on('keydown-ESC', () => this.exit('Title'));
    kb.on('keydown-F', () => this.exit('Game'));
    kb.on('keydown-M', () => Sfx.toggleMute());

    this.refreshAll();
    this.highlight();
    Sfx.playMusic('music_title', 0.35);
  }

  // ------------------------------------------------------------------- cards

  private buildCard(def: MetaUpgradeDef, x: number, y: number, idx: number) {
    const c = this.add.container(x, y);
    const bg = this.add.image(0, 0, 'shop_card');
    c.add(bg);

    c.add(this.add.rectangle(0, -50, 40, 40, 0x101022).setStrokeStyle(2, 0x55558a));
    if (def.icon.startsWith('tile:')) {
      c.add(this.add.image(0, -50, 'tiles', Number(def.icon.slice(5))).setScale(2.1));
    } else if (def.icon.startsWith('gen:')) {
      const key = def.icon.slice(4);
      c.add(this.add.image(0, -50, this.textures.exists(key) ? key : 'coin').setScale(1.7));
    }

    c.add(
      this.add
        .text(0, -22, def.name.toUpperCase(), {
          fontFamily: FONT,
          fontSize: '8px',
          color: '#ffffff',
          align: 'center',
          wordWrap: { width: CARD_W - 24 }
        })
        .setOrigin(0.5, 0)
    );

    // level pips (filled = owned)
    const pips: Phaser.GameObjects.Rectangle[] = [];
    const pipW = 12;
    const totalW = def.maxLevel * pipW + (def.maxLevel - 1) * 6;
    for (let i = 0; i < def.maxLevel; i++) {
      const p = this.add
        .rectangle(-totalW / 2 + pipW / 2 + i * (pipW + 6), 6, pipW, 8, 0x2a2a44)
        .setStrokeStyle(1, 0x55558a);
      pips.push(p);
      c.add(p);
    }

    c.add(
      this.add
        .text(0, 22, def.desc, {
          fontFamily: FONT,
          fontSize: '7px',
          color: '#b8b09a',
          align: 'center',
          lineSpacing: 4,
          wordWrap: { width: CARD_W - 24 }
        })
        .setOrigin(0.5, 0)
    );

    const costText = this.add
      .text(0, 56, '', { fontFamily: FONT, fontSize: '10px', color: '#ffd34e' })
      .setOrigin(0.5);
    c.add(costText);

    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => {
      this.selected = idx;
      this.highlight();
      Sfx.play('uiclick', 0.15);
    });
    bg.on('pointerdown', () => {
      this.selected = idx;
      this.highlight();
      this.buy(idx);
    });

    this.cards.push({ def, container: c, bg, pips, costText });
  }

  private refreshAll() {
    this.goldText.setText(String(this.save.gold));
    for (const card of this.cards) {
      const owned = this.save.meta[card.def.id] ?? 0;
      card.pips.forEach((p, i) => p.setFillStyle(i < owned ? 0xffd34e : 0x2a2a44));
      const cost = metaNextCost(card.def.id, owned);
      if (cost === null) {
        card.costText.setText('已满级').setColor('#6ee86e');
      } else {
        card.costText.setText(`${cost} 金币`).setColor(this.save.gold >= cost ? '#ffd34e' : '#8a5050');
      }
    }
  }

  private highlight() {
    this.cards.forEach((card, i) => {
      card.bg.setTexture(i === this.selected ? 'shop_card_hover' : 'shop_card');
      card.container.setScale(i === this.selected ? 1.04 : 1);
    });
  }

  private moveSel(delta: number) {
    this.selected = Phaser.Math.Wrap(this.selected + delta, 0, this.cards.length);
    this.highlight();
    Sfx.play('uiclick', 0.25);
  }

  // -------------------------------------------------------------------- buy

  private buy(idx: number) {
    const card = this.cards[idx];
    if (!card || this.leaving) return;
    const owned = this.save.meta[card.def.id] ?? 0;
    const cost = metaNextCost(card.def.id, owned);
    if (cost === null || this.save.gold < cost) {
      Sfx.play('uiclick', 0.4, -400);
      this.tweens.add({
        targets: card.container,
        x: { from: card.container.x - 5, to: card.container.x },
        duration: 60,
        repeat: 2,
        yoyo: true
      });
      return;
    }
    this.save.gold -= cost;
    this.save.meta[card.def.id] = owned + 1;
    storeSave(this.save);
    Sfx.play('coin', 0.6);
    Sfx.play('levelup', 0.25, 300);
    this.refreshAll();
    this.tweens.add({
      targets: card.container,
      scale: { from: 1.14, to: 1.04 },
      duration: 160,
      ease: 'Back.Out'
    });
  }

  // ------------------------------------------------------------------- misc

  private footerButton(x: number, y: number, label: string, onClick: () => void) {
    const t = this.add
      .text(x, y, label, { fontFamily: FONT, fontSize: '11px', color: '#9be8ff' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    t.on('pointerover', () => t.setColor('#ffffff'));
    t.on('pointerout', () => t.setColor('#9be8ff'));
    t.on('pointerdown', onClick);
  }

  private exit(target: 'Title' | 'Game') {
    if (this.leaving) return;
    this.leaving = true;
    Sfx.play('choose', 0.5);
    this.cameras.main.fadeOut(250, 6, 6, 14);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(target);
    });
  }

  private ensureCardTextures() {
    if (this.textures.exists('shop_card')) return;
    const draw = (key: string, border: number, fill: number) => {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(fill, 0.97).fillRoundedRect(0, 0, CARD_W, CARD_H, 10);
      g.lineStyle(3, border, 1).strokeRoundedRect(1, 1, CARD_W - 2, CARD_H - 2, 10);
      g.generateTexture(key, CARD_W, CARD_H);
      g.destroy();
    };
    draw('shop_card', 0x55558a, 0x16162e);
    draw('shop_card_hover', 0xffd34e, 0x1e1e40);
  }
}
