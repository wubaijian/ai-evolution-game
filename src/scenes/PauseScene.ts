import Phaser from 'phaser';
import { FONT, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { EVOLVED_LEVEL, WEAPONS } from '../data/weapons';
import { PASSIVES } from '../data/passives';
import { Sfx } from '../systems/audio';
import type { GameScene } from './GameScene';

export class PauseScene extends Phaser.Scene {
  private volumeText!: Phaser.GameObjects.Text;

  constructor() {
    super('Pause');
  }

  create() {
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x06060e, 0.75).setOrigin(0).setInteractive();

    this.add
      .text(GAME_WIDTH / 2, 110, '游戏暂停', {
        fontFamily: FONT,
        fontSize: '30px',
        color: '#e8e3d0',
        stroke: '#8c46d8',
        strokeThickness: 6
      })
      .setOrigin(0.5);

    // current build summary
    const gs = this.scene.get('Game') as GameScene;
    const lines: string[] = ['— 当前构筑 —', '', gs.run.evolution.name, ''];
    for (const [id, lvl] of gs.run.weapons) {
      const evo = WEAPONS[id].evolution;
      lines.push(lvl >= EVOLVED_LEVEL && evo ? `${evo.name}（已进化）` : `${WEAPONS[id].name}  等级 ${lvl}`);
    }
    if (gs.run.passives.size > 0) lines.push('');
    for (const [id, lvl] of gs.run.passives) lines.push(`${PASSIVES[id].name}  等级 ${lvl}`);
    this.add
      .text(GAME_WIDTH / 2, 175, lines.join('\n'), {
        fontFamily: FONT,
        fontSize: '10px',
        color: '#b8b09a',
        align: 'center',
        lineSpacing: 7
      })
      .setOrigin(0.5, 0);

    // volume row: [<] VOLUME 100% [>]
    this.volumeText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 120, '', {
        fontFamily: FONT,
        fontSize: '10px',
        color: '#9be8ff'
      })
      .setOrigin(0.5);
    this.refreshVolume();
    this.volumeArrow(GAME_WIDTH / 2 - 110, -1);
    this.volumeArrow(GAME_WIDTH / 2 + 110, 1);

    this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT - 92,
        '[P/ESC] 继续   [R] 重新开始   [Q] 返回标题   [M] 静音   [</>] 音量',
        {
          fontFamily: FONT,
          fontSize: '10px',
          color: '#9a937c'
        }
      )
      .setOrigin(0.5);

    const kb = this.input.keyboard!;
    kb.on('keydown-P', () => this.resumeGame());
    kb.on('keydown-ESC', () => this.resumeGame());
    kb.on('keydown-R', () => this.restart());
    kb.on('keydown-Q', () => this.quitToTitle());
    kb.on('keydown-M', () => Sfx.toggleMute());
    kb.on('keydown-LEFT', () => this.bumpVolume(-1));
    kb.on('keydown-RIGHT', () => this.bumpVolume(1));
    kb.on('keydown-COMMA', () => this.bumpVolume(-1));
    kb.on('keydown-PERIOD', () => this.bumpVolume(1));
    this.input.on('pointerdown', () => this.resumeGame());
  }

  private bumpVolume(dir: number) {
    Sfx.adjustVolume(dir);
    this.refreshVolume();
    Sfx.play('uiclick', 0.5);
  }

  private refreshVolume() {
    this.volumeText.setText(`音量 ${Math.round(Sfx.volume * 100)}%`);
  }

  private volumeArrow(x: number, dir: number) {
    const t = this.add
      .text(x, GAME_HEIGHT - 120, dir < 0 ? '[<]' : '[>]', {
        fontFamily: FONT,
        fontSize: '11px',
        color: '#9be8ff'
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    t.on('pointerover', () => t.setColor('#ffffff'));
    t.on('pointerout', () => t.setColor('#9be8ff'));
    t.on(
      'pointerdown',
      (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation(); // the backdrop click would resume the game
        this.bumpVolume(dir);
      }
    );
  }

  private resumeGame() {
    Sfx.play('uiclick', 0.3);
    this.scene.resume('Game');
    this.scene.stop();
  }

  private restart() {
    Sfx.play('choose', 0.4);
    const game = this.scene.get('Game') as GameScene;
    this.scene.stop();
    game.scene.restart();
  }

  private quitToTitle() {
    Sfx.play('uiclick', 0.3);
    Sfx.stopMusic();
    this.scene.stop('Game');
    this.scene.start('Title');
  }
}
