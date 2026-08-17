import Phaser from 'phaser';
import { COLORS, FONT, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { EVOLVED_LEVEL, WEAPONS } from '../data/weapons';
import { PASSIVES } from '../data/passives';
import { Sfx } from '../systems/audio';
import type { GameScene } from './GameScene';

/** Screen-space overlay scene: XP bar, timer, counters, build icons, boss bar. */
export class HudScene extends Phaser.Scene {
  private xpFill!: Phaser.GameObjects.Rectangle;
  private levelText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private stageText!: Phaser.GameObjects.Text;
  private killsText!: Phaser.GameObjects.Text;
  private goldText!: Phaser.GameObjects.Text;
  private muteText!: Phaser.GameObjects.Text;
  private combatText!: Phaser.GameObjects.Text;
  private evolutionText!: Phaser.GameObjects.Text;
  private buildIcons: Phaser.GameObjects.GameObject[] = [];
  private buildSig = '';
  private bossBarBg!: Phaser.GameObjects.Rectangle;
  private bossBarFill!: Phaser.GameObjects.Rectangle;
  private bossName!: Phaser.GameObjects.Text;
  private lowHp!: Phaser.GameObjects.Image;

  constructor() {
    super('Hud');
  }

  create() {
    // XP bar across the top
    this.add.rectangle(0, 0, GAME_WIDTH, 16, COLORS.XP_BAR_BG).setOrigin(0).setAlpha(0.9);
    this.xpFill = this.add.rectangle(2, 2, 10, 12, COLORS.XP_BAR).setOrigin(0);
    this.levelText = this.text(GAME_WIDTH - 8, 24, '10px', '#9be8ff').setOrigin(1, 0);

    this.timerText = this.text(GAME_WIDTH / 2, 26, '20px', COLORS.TEXT).setOrigin(0.5, 0);
    this.stageText = this.text(GAME_WIDTH / 2, 54, '8px', '#d8b34a').setOrigin(0.5, 0);
    this.killsText = this.text(GAME_WIDTH - 8, 44, '10px', '#ff9a9a').setOrigin(1, 0);
    this.goldText = this.text(GAME_WIDTH - 8, 62, '10px', '#ffd34e').setOrigin(1, 0);
    this.muteText = this.text(GAME_WIDTH - 8, GAME_HEIGHT - 18, '8px', COLORS.TEXT_DIM).setOrigin(1, 0);
    this.combatText = this.text(8, GAME_HEIGHT - 18, '8px', '#9be8ff').setOrigin(0, 0);
    this.evolutionText = this.text(8, 20, '8px', '#ffffff').setOrigin(0, 0);

    // boss bar (hidden until a boss is alive)
    this.bossBarBg = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 26, 420, 14, 0x33101a)
      .setVisible(false);
    this.bossBarFill = this.add
      .rectangle(GAME_WIDTH / 2 - 208, GAME_HEIGHT - 26, 416, 10, 0xd83a3a)
      .setOrigin(0, 0.5)
      .setVisible(false);
    this.bossName = this.text(GAME_WIDTH / 2, GAME_HEIGHT - 48, '10px', '#ff7070')
      .setOrigin(0.5)
      .setVisible(false);

    // low-HP warning vignette
    this.lowHp = this.add
      .image(0, 0, 'vignette')
      .setOrigin(0)
      .setTint(0xff2020)
      .setAlpha(0)
      .setDepth(50);
  }

  private text(x: number, y: number, size: string, color: string) {
    return this.add.text(x, y, '', {
      fontFamily: FONT,
      fontSize: size,
      color,
      stroke: '#000000',
      strokeThickness: 3
    });
  }

  update() {
    const gs = this.scene.get('Game') as GameScene;
    if (!gs || !gs.run) return;
    const run = gs.run;
    const combatUi = gs.combatUi();
    this.evolutionText.setText(`${gs.evolutionDisplayName()}  ·  ${combatUi.status}`).setColor(run.evolution.color);

    this.xpFill.width = Math.max(2, (GAME_WIDTH - 4) * Phaser.Math.Clamp(run.xp / run.xpNeeded, 0, 1));
    this.levelText.setText(`等级 ${run.level}`);

    const total = Math.floor(gs.runTime / 1000);
    const mm = String(Math.floor(total / 60)).padStart(2, '0');
    const ss = String(total % 60).padStart(2, '0');
    this.timerText.setText(`${mm}:${ss}`);
    const encounter = gs.encounterUi();
    this.stageText.setText(`${encounter.stage}  ·  ${encounter.objective}`)
      .setColor(encounter.stage.startsWith('首领') ? '#ff7070' : '#d8b34a');

    this.killsText.setText(`击杀 ${run.kills}`);
    this.goldText.setText(`金币 ${Math.floor(run.gold)}`);
    this.muteText.setText(Sfx.muted ? '已静音 [M]' : '[M] 静音  [P] 暂停');
    const cooldowns = gs.combatCooldowns();
    const show = (ms: number) => ms <= 0 ? '就绪' : `${(ms / 1000).toFixed(1)}秒`;
    const coreState = run.evolution.id === 'base_creature' ? '未解锁' : show(cooldowns.coreMs);
    this.combatText.setText(
      `[LMB/J] ${combatUi.primary} ${show(cooldowns.primaryMs)}  ` +
      `[RMB/K] ${combatUi.core} ${coreState}  ` +
      `[SPACE/SHIFT] ${combatUi.survival} ${show(cooldowns.dodgeMs)}`
    );

    this.refreshBuildIcons(gs);

    // boss bar
    const boss = gs.currentBoss;
    const showBoss = !!boss && boss.active;
    this.bossBarBg.setVisible(showBoss);
    this.bossBarFill.setVisible(showBoss);
    this.bossName.setVisible(showBoss);
    if (boss && boss.active) {
      this.bossName.setText(`${boss.def.name} · 阶段 ${boss.bossPhase}/2`);
      this.bossBarFill.setScale(Phaser.Math.Clamp(boss.hp / boss.maxHp, 0, 1), 1);
    }

    // low HP pulse
    const hpRatio = gs.player.hp / run.stats.maxHp;
    this.lowHp.setAlpha(hpRatio < 0.35 ? 0.25 + Math.sin(gs.runTime * 0.008) * 0.15 : 0);
  }

  /** weapon + passive icons under the XP bar; rebuilt only when the build changes */
  private refreshBuildIcons(gs: GameScene) {
    const sig =
      [...gs.run.weapons.entries()].map(([id, l]) => `${id}${l}`).join() +
      '|' +
      [...gs.run.passives.entries()].map(([id, l]) => `${id}${l}`).join();
    if (sig === this.buildSig) return;
    this.buildSig = sig;
    for (const o of this.buildIcons) o.destroy();
    this.buildIcons = [];

    let x = 12;
    for (const [id, lvl] of gs.run.weapons) {
      this.drawIcon(WEAPONS[id].icon, x, 30, lvl);
      x += 34;
    }
    x += 10;
    for (const [id, lvl] of gs.run.passives) {
      this.drawIcon(PASSIVES[id].icon, x, 30, lvl);
      x += 34;
    }
  }

  private drawIcon(icon: string, x: number, y: number, level: number) {
    const evolved = level >= EVOLVED_LEVEL;
    const bg = this.add
      .rectangle(x + 12, y + 12, 28, 28, evolved ? 0x2a2210 : 0x14142a)
      .setStrokeStyle(1, evolved ? 0xffd34e : 0x44446a);
    this.buildIcons.push(bg);
    let img: Phaser.GameObjects.Image;
    if (icon.startsWith('tile:')) {
      img = this.add.image(x + 12, y + 12, 'tiles', Number(icon.slice(5))).setScale(1.4);
    } else if (icon.startsWith('gen:')) {
      img = this.add.image(x + 12, y + 12, icon.slice(4));
    } else {
      img = this.add.image(x + 12, y + 12, icon);
    }
    this.buildIcons.push(img);
    const lvlText = this.add.text(x + 21, y + 16, evolved ? '进' : String(level), {
      fontFamily: FONT,
      fontSize: '7px',
      color: evolved ? '#ff9a3c' : '#ffd34e',
      stroke: '#000000',
      strokeThickness: 2
    });
    this.buildIcons.push(lvlText);
  }
}
