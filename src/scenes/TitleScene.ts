import Phaser from 'phaser';
import { FONT, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { F } from '../data/frames';
import { Sfx } from '../systems/audio';
import { loadSave } from '../systems/save';

export class TitleScene extends Phaser.Scene {
  private starting = false;

  constructor() {
    super('Title');
  }

  create() {
    this.starting = false;

    const ground = this.add
      .tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, 'ground')
      .setOrigin(0)
      .setTileScale(2)
      .setAlpha(0.5);
    this.tweens.add({
      targets: ground,
      tilePositionX: 400,
      tilePositionY: 200,
      duration: 60000,
      repeat: -1
    });
    this.add.image(0, 0, 'vignette').setOrigin(0).setAlpha(1);

    // ominous cast
    const knight = this.add.image(GAME_WIDTH / 2, 295, 'tiles', F.PLAYER).setScale(6);
    this.tweens.add({
      targets: knight,
      scaleY: { from: 6, to: 6.25 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut'
    });
    const monsters = [
      { f: F.BAT, x: -170, y: -30 },
      { f: F.GHOST, x: 175, y: -20 },
      { f: F.SPIDER, x: -230, y: 40 },
      { f: F.SLIME, x: 230, y: 50 },
      { f: F.RAT, x: -120, y: 60 },
      { f: F.ACOLYTE, x: 130, y: 65 }
    ];
    monsters.forEach((m, i) => {
      const img = this.add
        .image(GAME_WIDTH / 2 + m.x, 295 + m.y, 'tiles', m.f)
        .setScale(3)
        .setAlpha(0.75)
        .setTint(0xaa90d8);
      this.tweens.add({
        targets: img,
        y: img.y - 8,
        duration: 1100 + i * 130,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut'
      });
    });

    // title
    this.add
      .text(GAME_WIDTH / 2, 110, 'GRAVEHORDE', {
        fontFamily: FONT,
        fontSize: '52px',
        color: '#e8e3d0',
        stroke: '#8c46d8',
        strokeThickness: 10
      })
      .setOrigin(0.5)
      .setShadow(0, 6, '#000000', 0, true, true);
    this.add
      .text(GAME_WIDTH / 2, 158, '精灵进化，由你选择。', {
        fontFamily: FONT,
        fontSize: '12px',
        color: '#9a937c'
      })
      .setOrigin(0.5);

    // start prompt
    const prompt = this.add
      .text(GAME_WIDTH / 2, 408, '点击画面或按 ENTER 开始战斗', {
        fontFamily: FONT,
        fontSize: '14px',
        color: '#9be8ff'
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: prompt, alpha: 0.35, duration: 650, yoyo: true, repeat: -1 });

    this.add
      .text(
        GAME_WIDTH / 2,
        448,
        'WASD 移动 · 鼠标左键/J 普攻 · 鼠标右键/K 核心技能 · 空格/SHIFT 闪避\n先用基础精灵完成第一波并进化，再击败后续敌人与首领',
        {
          fontFamily: FONT,
          fontSize: '9px',
          color: '#9a937c',
          align: 'center',
          lineSpacing: 6
        }
      )
      .setOrigin(0.5);

    const save = loadSave();

    // Crypt Shop entry — top-left, shows the banked gold
    const shopBtn = this.add
      .text(10, 10, `[S] 墓穴商店  ·  ${save.gold} 金币`, {
        fontFamily: FONT,
        fontSize: '10px',
        color: '#ffd34e',
        stroke: '#000000',
        strokeThickness: 3
      })
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    shopBtn.on('pointerover', () => shopBtn.setColor('#ffffff'));
    shopBtn.on('pointerout', () => shopBtn.setColor('#ffd34e'));
    shopBtn.on(
      'pointerdown',
      (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation(); // keep the global "click to fight" handler out of it
        this.openShop();
      }
    );

    const developerBtn = this.add
      .text(GAME_WIDTH - 10, 10, '[D] 开发者后台', {
        fontFamily: FONT,
        fontSize: '9px',
        color: '#b29bff',
        stroke: '#000000',
        strokeThickness: 3
      })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    developerBtn.on('pointerover', () => developerBtn.setColor('#ffffff'));
    developerBtn.on('pointerout', () => developerBtn.setColor('#b29bff'));
    developerBtn.on(
      'pointerdown',
      (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        window.location.href = './developer/';
      }
    );

    if (save.runs > 0) {
      const mm = String(Math.floor(save.bestTimeSec / 60)).padStart(2, '0');
      const ss = String(save.bestTimeSec % 60).padStart(2, '0');
      this.add
        .text(
          GAME_WIDTH / 2,
          492,
          `最佳 ${mm}:${ss}  ·  击杀 ${save.bestKills}  ·  胜利 ${save.wins}  ·  挑战 ${save.runs}`,
          { fontFamily: FONT, fontSize: '8px', color: '#6a6450' }
        )
        .setOrigin(0.5);
    }

    const creditsLine = this.add
      .text(GAME_WIDTH - 6, GAME_HEIGHT - 14, '', {
        fontFamily: FONT,
        fontSize: '7px',
        color: '#55503e'
      })
      .setOrigin(1, 0);
    const refreshCredits = () => {
      creditsLine.setText(
        `美术：kenney.nl · 音乐：cynicmusic · [M] 静音 · [</>] 音量 ${Math.round(Sfx.volume * 100)}%`
      );
    };
    refreshCredits();

    Sfx.playMusic('music_title', 0.35);

    const bumpVolume = (dir: number) => {
      Sfx.adjustVolume(dir);
      refreshCredits();
      Sfx.play('uiclick', 0.5);
    };

    const kb = this.input.keyboard!;
    kb.on('keydown-ENTER', () => this.startGame());
    kb.on('keydown-SPACE', () => this.startGame());
    kb.on('keydown-S', () => this.openShop());
    kb.on('keydown-D', () => { window.location.href = './developer/'; });
    kb.on('keydown-M', () => Sfx.toggleMute());
    kb.on('keydown-COMMA', () => bumpVolume(-1));
    kb.on('keydown-PERIOD', () => bumpVolume(1));
    kb.on('keydown-LEFT', () => bumpVolume(-1));
    kb.on('keydown-RIGHT', () => bumpVolume(1));
    this.input.on('pointerdown', () => this.startGame());
  }

  private startGame() {
    if (this.starting) return;
    this.starting = true;
    Sfx.play('choose', 0.6);
    this.cameras.main.fadeOut(350, 6, 6, 14);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('Game');
    });
  }

  private openShop() {
    if (this.starting) return;
    this.starting = true;
    Sfx.play('chest', 0.5);
    this.cameras.main.fadeOut(250, 6, 6, 14);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('Shop');
    });
  }
}
