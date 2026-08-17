import Phaser from 'phaser';
import { FONT, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { Sfx } from '../systems/audio';
import type { UpgradeChoice } from '../types';

interface LevelUpData {
  choices: UpgradeChoice[];
  pick: (c: UpgradeChoice) => void;
}

const CARD_W = 240;
const CARD_H = 250;

/** Modal upgrade picker — Game scene is paused underneath. */
export class LevelUpScene extends Phaser.Scene {
  private data2!: LevelUpData;
  private cards: Phaser.GameObjects.Container[] = [];
  private selected = -1;
  private locked = false;

  constructor() {
    super('LevelUp');
  }

  init(data: LevelUpData) {
    this.data2 = data;
    this.cards = [];
    this.selected = -1;
    this.locked = false;
  }

  create() {
    this.ensureCardTextures();
    this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x06060e, 0.72)
      .setOrigin(0)
      .setInteractive(); // swallow clicks under the cards

    this.add
      .text(GAME_WIDTH / 2, 74, '选择一项强化', {
        fontFamily: FONT,
        fontSize: '22px',
        color: '#e8e3d0',
        stroke: '#8c46d8',
        strokeThickness: 5
      })
      .setOrigin(0.5);

    const xs = [GAME_WIDTH / 2 - 270, GAME_WIDTH / 2, GAME_WIDTH / 2 + 270];
    this.data2.choices.forEach((choice, i) => {
      const card = this.buildCard(choice, xs[i], GAME_HEIGHT / 2 + 30);
      this.cards.push(card);
      card.setScale(0.7).setAlpha(0);
      this.tweens.add({
        targets: card,
        scale: 1,
        alpha: 1,
        duration: 180,
        delay: 80 * i,
        ease: 'Back.Out'
      });
    });

    const kb = this.input.keyboard!;
    kb.on('keydown-ONE', () => this.choose(0));
    kb.on('keydown-TWO', () => this.choose(1));
    kb.on('keydown-THREE', () => this.choose(2));
    kb.on('keydown-LEFT', () => this.moveSel(-1));
    kb.on('keydown-RIGHT', () => this.moveSel(1));
    kb.on('keydown-ENTER', () => this.choose(this.selected === -1 ? 1 : this.selected));
    kb.on('keydown-SPACE', () => this.choose(this.selected === -1 ? 1 : this.selected));

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 40, '[1-3] 或点击选择  ·  方向键 + ENTER 确认', {
        fontFamily: FONT,
        fontSize: '9px',
        color: '#9a937c'
      })
      .setOrigin(0.5);
  }

  private moveSel(dir: number) {
    const n = this.data2.choices.length;
    this.selected = this.selected === -1 ? (dir > 0 ? 0 : n - 1) : Phaser.Math.Wrap(this.selected + dir, 0, n);
    this.cards.forEach((c, i) => this.highlight(c, i === this.selected));
    Sfx.play('uiclick', 0.25);
  }

  private highlight(card: Phaser.GameObjects.Container, on: boolean) {
    const bg = card.getAt(0) as Phaser.GameObjects.Image;
    bg.setTexture(on ? 'card_hover' : 'card');
    card.setScale(on ? 1.05 : 1);
  }

  private choose(i: number) {
    if (this.locked || i < 0 || i >= this.data2.choices.length) return;
    this.locked = true;
    Sfx.play('choose', 0.6);
    const card = this.cards[i];
    this.tweens.add({
      targets: card,
      scale: 1.15,
      alpha: 0,
      duration: 140,
      onComplete: () => this.data2.pick(this.data2.choices[i])
    });
  }

  private buildCard(choice: UpgradeChoice, x: number, y: number): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    const bg = this.add.image(0, 0, 'card');
    c.add(bg);

    // icon plaque
    c.add(this.add.rectangle(0, -72, 56, 56, 0x101022).setStrokeStyle(2, 0x55558a));
    const icon = choice.icon;
    if (icon.startsWith('tile:')) {
      c.add(this.add.image(0, -72, 'tiles', Number(icon.slice(5))).setScale(3));
    } else if (icon.startsWith('gen:')) {
      const key = icon.slice(4);
      c.add(this.add.image(0, -72, this.textures.exists(key) ? key : 'coin').setScale(2.2));
    } else {
      c.add(this.add.image(0, -72, 'coin').setScale(2.2));
    }

    const isNew = (choice.level ?? 1) === 1 && (choice.kind === 'weapon' || choice.kind === 'passive');
    const tagStr = choice.kind === 'heal' || choice.kind === 'gold' ? '' : isNew ? '新获得！' : `等级 ${choice.level}`;
    if (tagStr) {
      c.add(
        this.add
          .text(0, -32, tagStr, {
            fontFamily: FONT,
            fontSize: '9px',
            color: isNew ? '#6ee86e' : '#ffd34e'
          })
          .setOrigin(0.5)
      );
    }

    c.add(
      this.add
        .text(0, -8, choice.name.toUpperCase(), {
          fontFamily: FONT,
          fontSize: '11px',
          color: '#ffffff',
          align: 'center',
          wordWrap: { width: CARD_W - 30 }
        })
        .setOrigin(0.5, 0)
    );
    c.add(
      this.add
        .text(0, 42, choice.desc, {
          fontFamily: FONT,
          fontSize: '8px',
          color: '#b8b09a',
          align: 'center',
          lineSpacing: 5,
          wordWrap: { width: CARD_W - 34 }
        })
        .setOrigin(0.5, 0)
    );

    bg.setInteractive({ useHandCursor: true });
    const idx = this.cards.length;
    bg.on('pointerover', () => {
      this.selected = idx;
      this.cards.forEach((cc, i) => this.highlight(cc, i === idx));
      Sfx.play('uiclick', 0.15);
    });
    bg.on('pointerout', () => this.highlight(c, false));
    bg.on('pointerdown', () => this.choose(idx));
    return c;
  }

  /** card backgrounds generated once (rounded rect + border) */
  private ensureCardTextures() {
    if (this.textures.exists('card')) return;
    const draw = (key: string, border: number, fill: number) => {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(fill, 0.97).fillRoundedRect(0, 0, CARD_W, CARD_H, 12);
      g.lineStyle(3, border, 1).strokeRoundedRect(1, 1, CARD_W - 2, CARD_H - 2, 12);
      g.generateTexture(key, CARD_W, CARD_H);
      g.destroy();
    };
    draw('card', 0x55558a, 0x16162e);
    draw('card_hover', 0xffd34e, 0x1e1e40);
  }
}
