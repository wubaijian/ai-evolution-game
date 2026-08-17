import Phaser from 'phaser';
import { FONT, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { EVOLUTIONS, evolutionValidationFor } from '../data/evolutions';
import { F } from '../data/frames';
import { Sfx } from '../systems/audio';
import { abilityCost } from '../systems/EvolutionRules';
import { generateEvolutionIdeas } from '../services/EvolutionGeneration';
import type { EvolutionAbilityId, EvolutionFlavor, EvolutionId } from '../types';

const ABILITY_NAMES: Record<EvolutionAbilityId, string> = {
  flight: '飞行',
  burrow: '遁地',
  aquatic: '水下行动',
  ranged_attack: '远程攻击',
  chain_lightning: '连锁闪电',
  air_dash: '空中冲刺',
  eruption_burst: '破土爆发',
  ambush: '伏击',
  area_vortex: '范围漩涡',
  slow: '减速',
  single_target_burst: '单体爆发',
  high_speed_dash: '高速冲刺',
  shield: '护盾',
  stable_block: '稳定格挡'
};

interface EvolutionSceneData {
  firstEvolution?: boolean;
  onChoose?: (evolutionId: EvolutionId, flavor?: EvolutionFlavor) => void;
}

export class EvolutionScene extends Phaser.Scene {
  private selectedIndex = 0;
  private choosing = false;
  private cards: Phaser.GameObjects.Rectangle[] = [];
  private numberLabels: Phaser.GameObjects.Text[] = [];
  private nameLabels: Phaser.GameObjects.Text[] = [];
  private taglineLabels: Phaser.GameObjects.Text[] = [];
  private generatedFlavors = new Map<EvolutionId, EvolutionFlavor>();
  private feedback!: Phaser.GameObjects.Text;
  private generating = false;
  private promptInteracting = false;
  private firstEvolution = false;
  private onChoose?: EvolutionSceneData['onChoose'];

  constructor() {
    super('Evolution');
  }

  init(data: EvolutionSceneData) {
    this.firstEvolution = data?.firstEvolution === true;
    this.onChoose = typeof data?.onChoose === 'function' ? data.onChoose : undefined;
  }

  create() {
    // This scene can be launched over a paused run; keep its canvas and DOM UI above Game/Hud.
    this.scene.bringToTop();
    this.selectedIndex = 0;
    this.choosing = false;
    this.cards = [];
    this.numberLabels = [];
    this.nameLabels = [];
    this.taglineLabels = [];
    this.generatedFlavors.clear();
    this.generating = false;
    this.promptInteracting = false;

    this.cameras.main.setBackgroundColor(0x090912);
    this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, 'ground')
      .setOrigin(0)
      .setTileScale(2)
      .setAlpha(0.3);
    this.add.image(0, 0, 'vignette').setOrigin(0).setAlpha(1);

    this.add.text(GAME_WIDTH / 2, 24, this.firstEvolution ? '第一次进化' : '选择你的进化方向', {
      fontFamily: FONT,
      fontSize: '25px',
      color: '#e8e3d0',
      stroke: '#4b287a',
      strokeThickness: 6
    }).setOrigin(0.5);
    this.add.text(
      GAME_WIDTH / 2,
      52,
      this.firstEvolution
        ? '第一波完成 · 选择形态后继续战斗'
        : 'AI 负责创意表达 · 固定规则确保每条路线都公平可用',
      {
      fontFamily: FONT,
      fontSize: '8px',
      color: '#9a937c'
      }
    ).setOrigin(0.5);

    this.feedback = this.add.text(GAME_WIDTH / 2, 505, '', {
      fontFamily: FONT,
      fontSize: '7px',
      color: '#a8a2b8',
      align: 'center',
      wordWrap: { width: 900 }
    }).setOrigin(0.5);

    this.createPromptBar();
    const centers = [170, 480, 790];
    EVOLUTIONS.forEach((_evolution, index) => this.createCard(centers[index], index));
    this.refreshSelection();

    const footer = this.firstEvolution
      ? '[1/2/3] 选择   [←/→] 查看   [ENTER] 确认'
      : '[1/2/3] 选择   [←/→] 查看   [ENTER] 确认   [ESC] 返回';
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 22, footer, {
      fontFamily: FONT,
      fontSize: '9px',
      color: '#9be8ff'
    }).setOrigin(0.5);

    const kb = this.input.keyboard!;
    kb.on('keydown-ONE', () => this.choose(0));
    kb.on('keydown-TWO', () => this.choose(1));
    kb.on('keydown-THREE', () => this.choose(2));
    kb.on('keydown-LEFT', () => this.moveSelection(-1));
    kb.on('keydown-A', () => this.moveSelection(-1));
    kb.on('keydown-RIGHT', () => this.moveSelection(1));
    kb.on('keydown-D', () => this.moveSelection(1));
    kb.on('keydown-ENTER', () => this.choose(this.selectedIndex));
    kb.on('keydown-SPACE', () => this.choose(this.selectedIndex));
    if (!this.firstEvolution) kb.on('keydown-ESC', () => this.scene.start('Title'));
  }

  private createCard(x: number, index: number) {
    const evolution = EVOLUTIONS[index];
    const validation = evolutionValidationFor(evolution.id);
    const color = Phaser.Display.Color.HexStringToColor(evolution.color).color;
    const card = this.add.rectangle(x, 318, 278, 370, 0x10101d, 0.96)
      .setStrokeStyle(2, 0x3b3850)
      .setInteractive({ useHandCursor: true });
    this.cards.push(card);
    card.on('pointerover', () => {
      this.selectedIndex = index;
      this.refreshSelection();
    });
    card.on('pointerdown', () => this.choose(index));

    const number = this.add.text(x - 121, 142, `[${index + 1}]`, {
      fontFamily: FONT,
      fontSize: '10px',
      color: '#77728a'
    }).setOrigin(0);
    this.numberLabels.push(number);

    this.add.image(x, 170, 'tiles', F.PLAYER).setScale(3.1).setTint(evolution.tint);
    const nameLabel = this.add.text(x, 210, evolution.name, {
      fontFamily: FONT,
      fontSize: '12px',
      color: evolution.color,
      align: 'center',
      wordWrap: { width: 245 }
    }).setOrigin(0.5);
    this.nameLabels.push(nameLabel);
    const taglineLabel = this.add.text(x, 235, evolution.tagline, {
      fontFamily: FONT,
      fontSize: '7px',
      color: '#a8a2b8'
    }).setOrigin(0.5);
    this.taglineLabels.push(taglineLabel);

    const stats = evolution.stats;
    this.add.text(x, 265,
      `攻击 ${stats.attack}   速度 ${stats.speed}\n防御 ${stats.defense}   能量 ${stats.energy}`,
      {
        fontFamily: FONT,
        fontSize: '9px',
        color: '#e8e3d0',
        align: 'center',
        lineSpacing: 8
      }
    ).setOrigin(0.5, 0);

    this.add.text(
      x,
      310,
      validation.legal
        ? `合法  ·  属性 ${validation.statTotal}/${validation.statBudget}  ·  能力 ${validation.abilityTotal}/${validation.abilityBudget}`
        : `不合法  ·  ${validation.errors[0] ?? '规则错误'}`,
      {
        fontFamily: FONT,
        fontSize: '6px',
        color: validation.legal ? '#72e39a' : '#ff7070',
        align: 'center',
        wordWrap: { width: 244 }
      }
    ).setOrigin(0.5);

    this.add.text(x - 116, 330, '能力', {
      fontFamily: FONT,
      fontSize: '8px',
      color: evolution.color
    }).setOrigin(0);
    this.add.text(
      x - 116,
      349,
      evolution.abilities.map(ability =>
        `• ${ABILITY_NAMES[ability]} [${abilityCost(ability) ?? '?'}]`
      ).join('\n'),
      {
      fontFamily: FONT,
      fontSize: '7px',
      color: '#c8c2d0',
      lineSpacing: 6,
      wordWrap: { width: 235 }
      }
    ).setOrigin(0);

    this.add.text(x - 116, 410, `+ ${evolution.strengths.join('\n+ ')}`, {
      fontFamily: FONT,
      fontSize: '7px',
      color: '#72e39a',
      lineSpacing: 5,
      wordWrap: { width: 235 }
    }).setOrigin(0);
    this.add.text(x - 116, 454, `− ${evolution.tradeoffs.join('\n− ')}`, {
      fontFamily: FONT,
      fontSize: '7px',
      color: '#ff8b8b',
      lineSpacing: 5,
      wordWrap: { width: 235 }
    }).setOrigin(0);

    this.add.rectangle(x, 493, 238, 2, color, 0.7);
  }

  private createPromptBar() {
    const root = document.createElement('div');
    root.style.cssText = 'width:760px;height:34px;pointer-events:auto';
    const wrapper = document.createElement('div');
    wrapper.style.cssText = [
      'display:flex', 'gap:8px', 'width:760px', 'height:34px',
      'font-family:"PingFang SC","Microsoft YaHei",sans-serif', 'pointer-events:auto'
    ].join(';');
    wrapper.addEventListener('pointerdown', event => {
      this.promptInteracting = true;
      event.stopPropagation();
    });
    wrapper.addEventListener('pointerup', event => {
      event.stopPropagation();
      window.setTimeout(() => { this.promptInteracting = false; }, 120);
    });
    wrapper.addEventListener('click', event => event.stopPropagation());
    const input = document.createElement('input');
    input.maxLength = 400;
    input.placeholder = '描述你想要的精灵，例如：披着水晶铠甲的勇敢月狼';
    input.setAttribute('aria-label', '精灵进化创意');
    input.style.cssText = [
      'flex:1', 'min-width:0', 'background:#10101d', 'color:#e8e3d0',
      'border:2px solid #4b4670', 'border-radius:3px', 'padding:0 10px',
      'font:12px "PingFang SC","Microsoft YaHei",sans-serif', 'outline:none'
    ].join(';');
    input.addEventListener('focus', () => {
      if (this.input.keyboard) this.input.keyboard.enabled = false;
    });
    input.addEventListener('blur', () => {
      if (this.input.keyboard) this.input.keyboard.enabled = true;
    });
    const generate = document.createElement('button');
    generate.textContent = 'AI 生成';
    generate.style.cssText = this.promptButtonStyle('#603aa0');
    const surprise = document.createElement('button');
    surprise.textContent = '随机灵感';
    surprise.style.cssText = this.promptButtonStyle('#246b78');
    for (const element of [input, generate, surprise]) {
      element.addEventListener('keydown', event => event.stopPropagation());
      wrapper.appendChild(element);
    }
    generate.addEventListener('click', () => void this.generateFlavors(input.value, generate, surprise));
    surprise.addEventListener('click', () => {
      const seeds = [
        '被流星祝福的勇敢精灵',
        '穿着水晶铠甲的调皮森林守卫',
        '守护失落王国的神秘月兽',
        '由古老符文驱动、小巧却无畏的怪兽'
      ];
      input.value = Phaser.Utils.Array.GetRandom(seeds);
      void this.generateFlavors(input.value, generate, surprise);
    });
    root.appendChild(wrapper);
    // Phaser's DOM overlay is offset inside the FIT-scaled canvas; this centers the row visually.
    this.add.dom(GAME_WIDTH / 2 - 120, 45, root).setOrigin(0.5);
  }

  private promptButtonStyle(color: string) {
    return [
      `background:${color}`, 'color:#ffffff', 'border:2px solid #9b8bc7',
      'border-radius:3px', 'padding:0 10px', 'font:bold 11px "PingFang SC","Microsoft YaHei",sans-serif',
      'cursor:pointer', 'white-space:nowrap'
    ].join(';');
  }

  private async generateFlavors(
    prompt: string,
    generateButton: HTMLButtonElement,
    surpriseButton: HTMLButtonElement
  ) {
    if (this.generating) return;
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt) {
      this.feedback.setColor('#ff7070').setText('请先描述一个精灵，或点击“随机灵感”。');
      return;
    }
    this.generating = true;
    generateButton.disabled = true;
    surpriseButton.disabled = true;
    generateButton.textContent = '生成中……';
    this.feedback.setColor('#9be8ff').setText('正在生成三种符合规则的进化创意……');
    const generation = await generateEvolutionIdeas(cleanPrompt);
    if (!this.scene.isActive()) return;
    this.generatedFlavors.clear();
    for (const flavor of generation.variants) this.generatedFlavors.set(flavor.routeId, flavor);
    EVOLUTIONS.forEach((evolution, index) => {
      const flavor = this.generatedFlavors.get(evolution.id);
      this.nameLabels[index].setText(flavor?.name ?? evolution.name);
      this.taglineLabels[index].setText(flavor?.tagline ?? evolution.tagline);
    });
    this.generating = false;
    generateButton.disabled = false;
    surpriseButton.disabled = false;
    generateButton.textContent = 'AI 生成';
    this.feedback.setColor(generation.source === 'openai' ? '#72e39a' : '#ffd34e');
    this.refreshSelection(generation.source === 'openai' ? 'AI 创意已生成' : '已使用本地创意');
  }

  private moveSelection(delta: number) {
    this.selectedIndex = Phaser.Math.Wrap(this.selectedIndex + delta, 0, EVOLUTIONS.length);
    this.refreshSelection();
    Sfx.play('uiclick', 0.35);
  }

  private refreshSelection(prefix?: string) {
    this.cards.forEach((card, index) => {
      const selected = index === this.selectedIndex;
      const color = Phaser.Display.Color.HexStringToColor(EVOLUTIONS[index].color).color;
      card.setStrokeStyle(selected ? 4 : 2, selected ? color : 0x3b3850);
      card.setFillStyle(selected ? 0x19172a : 0x10101d, selected ? 1 : 0.96);
      this.numberLabels[index].setColor(selected ? EVOLUTIONS[index].color : '#77728a');
    });
    const selected = EVOLUTIONS[this.selectedIndex];
    const flavor = this.generatedFlavors.get(selected.id);
    if (flavor) {
      this.feedback.setText(`${prefix ? `${prefix} · ` : ''}${flavor.storyHook}`);
    } else if (!this.generating) {
      this.feedback.setColor('#a8a2b8').setText('你可以先描述创意，也可以直接选择一条固定且合法的基础路线。');
    }
  }

  private choose(index: number) {
    if (this.choosing || this.generating || this.promptInteracting) return;
    this.selectedIndex = index;
    this.refreshSelection();
    const evolution = EVOLUTIONS[index];
    const flavor = this.generatedFlavors.get(evolution.id);
    const validation = evolutionValidationFor(evolution.id);
    if (!validation.legal) {
      this.feedback.setText(validation.errors[0] ?? '进化方案未通过固定规则校验。');
      this.cameras.main.shake(180, 0.006);
      Sfx.play('uiclick', 0.35, -300);
      return;
    }
    this.choosing = true;
    this.feedback.setText('');
    Sfx.play('choose', 0.65);
    this.cameras.main.flash(220, 110, 75, 180);
    this.time.delayedCall(260, () => {
      if (this.onChoose) {
        const onChoose = this.onChoose;
        this.scene.stop();
        onChoose(evolution.id as EvolutionId, flavor);
      } else {
        this.scene.start('Game', { evolutionId: evolution.id, evolutionFlavor: flavor });
      }
    });
  }
}
