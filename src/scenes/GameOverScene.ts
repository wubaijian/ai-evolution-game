import Phaser from 'phaser';
import { FONT, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { Sfx } from '../systems/audio';
import { loadSave } from '../systems/save';
import { evolutionFor } from '../data/evolutions';
import type { RunResult } from '../types';

export class GameOverScene extends Phaser.Scene {
  private result!: RunResult;

  constructor() {
    super('GameOver');
  }

  init(data: RunResult) {
    this.result = data;
  }

  create() {
    const r = this.result;
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x06060e, 1).setOrigin(0);

    const title = r.victory ? '试炼完成' : '你倒下了';
    const color = r.victory ? '#ffd34e' : '#ff5050';
    const t = this.add
      .text(GAME_WIDTH / 2, 120, title, {
        fontFamily: FONT,
        fontSize: '34px',
        color,
        stroke: r.victory ? '#7a5a10' : '#3a0f12',
        strokeThickness: 7
      })
      .setOrigin(0.5)
      .setScale(0.6)
      .setAlpha(0);
    this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 420, ease: 'Back.Out' });

    if (r.victory) {
      this.add
        .text(GAME_WIDTH / 2, 168, r.storyHook ?? '你闯过三波敌人，并击败了首领的两个阶段。', {
          fontFamily: FONT,
          fontSize: '10px',
          color: '#9a937c',
          align: 'center',
          wordWrap: { width: 760 }
        })
        .setOrigin(0.5);
    }

    const mm = String(Math.floor(r.timeSurvivedSec / 60)).padStart(2, '0');
    const ss = String(r.timeSurvivedSec % 60).padStart(2, '0');
    const save = loadSave();
    const bmm = String(Math.floor(save.bestTimeSec / 60)).padStart(2, '0');
    const bss = String(save.bestTimeSec % 60).padStart(2, '0');

    const rows: [string, string][] = [
      ['进化形态', r.evolutionName ?? evolutionFor(r.evolutionId).name],
      ['坚持时间', `${mm}:${ss}`],
      ['等级', String(r.level)],
      ['击杀', String(r.kills)],
      ['本局金币', `+${r.gold}`],
      ['', ''],
      ['最佳时间', `${bmm}:${bss}`],
      ['最高击杀', String(save.bestKills)],
      ['胜利次数', String(save.wins)],
      ['金币储备', String(save.gold)]
    ];
    rows.forEach(([k, v], i) => {
      if (!k) return;
      const y = 225 + i * 26;
      this.add.text(GAME_WIDTH / 2 - 30, y, k, {
        fontFamily: FONT, fontSize: '11px', color: '#9a937c'
      }).setOrigin(1, 0.5);
      this.add.text(GAME_WIDTH / 2 + 30, y, v, {
        fontFamily: FONT, fontSize: '11px', color: '#e8e3d0'
      }).setOrigin(0, 0.5);
    });

    const hint = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 60, '[ENTER] 再战    [S] 墓穴商店    [T] 标题界面', {
        fontFamily: FONT,
        fontSize: '11px',
        color: '#9be8ff'
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: hint, alpha: 0.4, duration: 600, yoyo: true, repeat: -1 });

    const kb = this.input.keyboard!;
    kb.on('keydown-ENTER', () => this.again());
    kb.on('keydown-SPACE', () => this.again());
    kb.on('keydown-R', () => this.again());
    kb.on('keydown-S', () => this.toShop());
    kb.on('keydown-T', () => this.toTitle());
    kb.on('keydown-ESC', () => this.toTitle());
    this.input.on('pointerdown', () => this.again());
  }

  private again() {
    Sfx.play('choose', 0.5);
    this.scene.start('Game');
  }

  private toTitle() {
    Sfx.play('uiclick', 0.3);
    this.scene.start('Title');
  }

  private toShop() {
    Sfx.play('chest', 0.5);
    this.scene.start('Shop');
  }
}
