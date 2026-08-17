import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './config';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { GameScene } from './scenes/GameScene';
import { HudScene } from './scenes/HudScene';
import { LevelUpScene } from './scenes/LevelUpScene';
import { PauseScene } from './scenes/PauseScene';
import { GameOverScene } from './scenes/GameOverScene';
import { ShopScene } from './scenes/ShopScene';
import { EvolutionScene } from './scenes/EvolutionScene';

/** load the pixel font before boot so text renders correctly from frame one */
async function loadFont() {
  try {
    const font = new FontFace('PressStart2P', "url('assets/fonts/PressStart2P-Regular.ttf')");
    await font.load();
    document.fonts.add(font);
  } catch {
    console.warn('[gravehorde] pixel font failed to load — falling back to monospace');
  }
}

async function start() {
  await loadFont();
  document.querySelector('.boot-msg')?.remove();

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#0a0a12',
    pixelArt: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    dom: {
      createContainer: true
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false
      }
    },
    scene: [
      BootScene,
      TitleScene,
      EvolutionScene,
      GameScene,
      HudScene,
      LevelUpScene,
      PauseScene,
      GameOverScene,
      ShopScene
    ]
  });

  // debug/testing handle (used by automated playtests; harmless in production)
  (window as unknown as Record<string, unknown>).__gravehorde = game;
}

void start();
