import Phaser from 'phaser';
import { COLORS, DEPTH, DROPS, EVOLUTION_COMBAT, FONT, GAME_HEIGHT, GAME_WIDTH, MANUAL_COMBAT, MIMIC, PLAYER, POOL_SIZES, RUN } from '../config';
import { F } from '../data/frames';
import { Enemy } from '../entities/Enemy';
import { Player } from '../entities/Player';
import { Projectile } from '../entities/Projectile';
import { Arsenal } from '../systems/Arsenal';
import { Juice } from '../systems/Juice';
import { Loot } from '../systems/Loot';
import { RunState } from '../systems/RunState';
import { SpawnDirector } from '../systems/SpawnDirector';
import { Sfx } from '../systems/audio';
import { loadSave, storeSave } from '../systems/save';
import { EVOLVED_LEVEL, WEAPONS, WEAPON_MAX_LEVEL } from '../data/weapons';
import { BASE_EVOLUTION_ID, isCreatureFormId } from '../data/evolutions';
import type { EnemyContext } from '../entities/Enemy';
import type { CreatureFormId, EvolutionFlavor, EvolutionId, RunResult, UpgradeChoice, WeaponId } from '../types';

const DECOR_FRAMES = [F.GRAVE_CROSS, F.GRAVESTONE, F.SLAB_A, F.SLAB_B, F.HOLE, F.BONES];
const AIR_THREATS = new Set(['imp', 'ghost', 'cultist', 'boss_witch', 'boss_reaper']);

interface WaterPool {
  x: number;
  y: number;
  radiusX: number;
  radiusY: number;
  shape: Phaser.GameObjects.Ellipse;
}

export class GameScene extends Phaser.Scene implements EnemyContext {
  player!: Player;
  run!: RunState;
  juice!: Juice;
  loot!: Loot;
  arsenal!: Arsenal;
  spawner!: SpawnDirector;
  rng!: Phaser.Math.RandomDataGenerator;

  enemies!: Phaser.Physics.Arcade.Group;
  projectiles!: Phaser.Physics.Arcade.Group;
  enemyProjectiles!: Phaser.Physics.Arcade.Group;
  orbitalGroup!: Phaser.Physics.Arcade.Group;
  activeEnemies: Enemy[] = [];

  /** pausable run clock in ms — all cooldowns/timers compare against this */
  runTime = 0;
  runEnded = false;
  currentBoss: Enemy | null = null;
  reaperSpawned = false;

  private ground!: Phaser.GameObjects.TileSprite;
  private decor: Phaser.GameObjects.Image[] = [];
  private hpBarBg!: Phaser.GameObjects.Rectangle;
  private hpBarFill!: Phaser.GameObjects.Rectangle;
  private keys!: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  /** debounce so pause-on and resume don't fight over the same keystroke */
  private lastPauseToggle = 0;
  private pendingLevelUps = 0;
  private choosingUpgrade = false;
  private regenCarry = 0;
  private aimDirection = new Phaser.Math.Vector2(1, 0);
  private dodgeDirection = new Phaser.Math.Vector2(1, 0);
  private nextPrimaryAt = 0;
  private nextCoreAt = 0;
  private nextDodgeAt = 0;
  private dodgeUntil = 0;
  private dodgeSpeed = MANUAL_COMBAT.DODGE_SPEED;
  private burrowUntil = 0;
  private ambushUntil = 0;
  private playerInWater = false;
  private waterPools: WaterPool[] = [];
  private flightWings: Phaser.GameObjects.Image[] = [];
  private burrowMarker?: Phaser.GameObjects.Image;
  private waterRipple?: Phaser.GameObjects.Image;
  /** weapons already nudged with the "can evolve" hint this run */
  private evoHinted = new Set<WeaponId>();
  private selectedEvolutionId: CreatureFormId = BASE_EVOLUTION_ID;
  private evolutionFlavor?: EvolutionFlavor;
  private evolutionTransitioning = false;
  private justEvolved = false;
  private playtestInvulnerable = false;
  private playtestRate = 1;

  constructor() {
    super('Game');
  }

  init(data: { evolutionId?: unknown; evolutionFlavor?: unknown }) {
    this.selectedEvolutionId = BASE_EVOLUTION_ID;
    this.evolutionFlavor = undefined;
    if (isCreatureFormId(data?.evolutionId)) this.selectedEvolutionId = data.evolutionId;
    const flavor = data?.evolutionFlavor as Partial<EvolutionFlavor> | undefined;
    this.evolutionFlavor = flavor &&
      flavor.routeId === this.selectedEvolutionId &&
      typeof flavor.name === 'string' &&
      typeof flavor.tagline === 'string' &&
      typeof flavor.storyHook === 'string' &&
      typeof flavor.visualDescription === 'string'
      ? flavor as EvolutionFlavor
      : undefined;
  }

  create() {
    const playtestParams = new URLSearchParams(window.location.search);
    this.playtestInvulnerable =
      ['127.0.0.1', 'localhost'].includes(window.location.hostname) &&
      playtestParams.has('playtest');
    this.playtestRate = this.playtestInvulnerable
      ? Phaser.Math.Clamp(Number(playtestParams.get('rate') ?? 1) || 1, 1, 4)
      : 1;
    this.runTime = 0;
    this.runEnded = false;
    this.evolutionTransitioning = false;
    this.justEvolved = false;
    this.pendingLevelUps = 0;
    this.choosingUpgrade = false;
    this.regenCarry = 0;
    this.aimDirection.set(1, 0);
    this.dodgeDirection.set(1, 0);
    this.nextPrimaryAt = 0;
    this.nextCoreAt = 0;
    this.nextDodgeAt = 0;
    this.dodgeUntil = 0;
    this.dodgeSpeed = MANUAL_COMBAT.DODGE_SPEED;
    this.burrowUntil = 0;
    this.ambushUntil = 0;
    this.playerInWater = false;
    this.waterPools = [];
    this.flightWings = [];
    this.burrowMarker = undefined;
    this.waterRipple = undefined;
    this.currentBoss = null;
    this.reaperSpawned = false;
    this.activeEnemies = [];
    this.evoHinted.clear();
    this.rng = new Phaser.Math.RandomDataGenerator([String(Date.now())]);

    // --- world dressing ---
    this.cameras.main.setBackgroundColor(COLORS.BG);
    this.ground = this.add
      .tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, 'ground')
      .setOrigin(0)
      .setScrollFactor(0)
      .setTileScale(2) // ground pixels at the same chunkiness as the 2x sprites
      .setDepth(DEPTH.GROUND);
    this.add
      .image(0, 0, 'vignette')
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(DEPTH.OVERLAY - 1)
      .setAlpha(0.95);

    // --- player + camera ---
    this.player = new Player(this, 0, 0);
    this.run = new RunState('spark', loadSave().meta, this.selectedEvolutionId);
    this.player.stats = this.run.stats;
    this.player.hp = this.run.stats.maxHp;
    this.player.setEvolutionTint(this.run.evolution.tint);
    this.cameras.main.startFollow(this.player, true, 0.15, 0.15);
    this.createWaterPools();
    this.createEvolutionVisuals();

    // gravestone decor scattered around, recycled as the player roams
    this.decor = [];
    for (let i = 0; i < 42; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Phaser.Math.Between(80, 900);
      const img = this.add
        .image(Math.cos(a) * d, Math.sin(a) * d, 'tiles', Phaser.Math.RND.pick(DECOR_FRAMES))
        .setScale(2.2)
        .setDepth(DEPTH.DECOR)
        .setAlpha(0.85)
        .setTint(0x8d89b8);
      this.decor.push(img);
    }

    // --- pooled groups ---
    this.enemies = this.physics.add.group({
      classType: Enemy,
      maxSize: POOL_SIZES.ENEMIES,
      runChildUpdate: false
    });
    this.projectiles = this.physics.add.group({
      classType: Projectile,
      maxSize: POOL_SIZES.PLAYER_PROJECTILES,
      runChildUpdate: true
    });
    this.enemyProjectiles = this.physics.add.group({
      classType: Projectile,
      maxSize: POOL_SIZES.ENEMY_PROJECTILES,
      runChildUpdate: true
    });
    this.orbitalGroup = this.physics.add.group();

    // --- systems ---
    this.juice = new Juice(this);
    this.loot = new Loot(this);
    this.arsenal = new Arsenal(this);
    this.spawner = new SpawnDirector(this);

    // --- physics wiring ---
    this.physics.add.collider(this.enemies, this.enemies);
    this.physics.add.overlap(this.projectiles, this.enemies, (proj, enemy) => {
      this.onProjectileHit(proj as Projectile, enemy as Enemy);
    });
    this.physics.add.overlap(this.player, this.enemies, (_p, enemy) => {
      this.onEnemyContact(enemy as Enemy);
    });
    this.physics.add.overlap(this.player, this.enemyProjectiles, (_p, proj) => {
      this.onEnemyOrbHit(proj as Projectile);
    });
    this.physics.add.overlap(this.orbitalGroup, this.enemies, (blade, enemy) => {
      this.arsenal.orbitalHit(blade as Phaser.GameObjects.GameObject, enemy as Enemy, this.runTime);
    });

    // --- player HP bar (world space, follows player) ---
    this.hpBarBg = this.add.rectangle(0, 0, 36, 5, COLORS.HP_BAR_BG).setDepth(DEPTH.FX).setOrigin(0.5);
    this.hpBarFill = this.add.rectangle(0, 0, 34, 3, COLORS.HP_BAR).setDepth(DEPTH.FX).setOrigin(0, 0.5);

    // --- input ---
    // movement is polled (held keys); one-shot actions are event-driven because
    // a fast tap can deliver keydown+keyup in one input flush, wiping JustDown
    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D') as GameScene['keys'];
    this.cursors = kb.createCursorKeys();
    kb.on('keydown-P', () => this.requestPause());
    kb.on('keydown-ESC', () => this.requestPause());
    kb.on('keydown-M', () => Sfx.toggleMute());
    kb.on('keydown-J', () => this.tryPrimaryAttack());
    kb.on('keydown-K', () => this.tryCoreSkill());
    kb.on('keydown-SPACE', () => this.trySurvivalAction());
    kb.on('keydown-SHIFT', () => this.trySurvivalAction());
    this.input.mouse?.disableContextMenu();
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.updateAimFromPointer(pointer);
      if (pointer.rightButtonDown()) this.tryCoreSkill();
      else if (pointer.leftButtonDown()) this.tryPrimaryAttack();
    });

    // --- UI + music ---
    this.scene.launch('Hud');
    Sfx.playMusic('music_battle', 0.3);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scene.stop('Hud');
      this.scene.stop('LevelUp');
      this.scene.stop('Pause');
      this.scene.stop('Evolution');
    });
  }

  update(_time: number, delta: number) {
    if (this.runEnded) return;
    this.runTime += delta * this.playtestRate;
    const rt = this.runTime;
    if (!this.hasEvolved() && rt >= RUN.WAVE_DURATION_SEC * 1000) {
      this.runTime = RUN.WAVE_DURATION_SEC * 1000;
      this.beginFirstEvolution();
      return;
    }

    // input (— __ghMove is an automated-playtest override)
    const auto = (window as { __ghMove?: { x: number; y: number } }).__ghMove;
    const left = this.cursors.left.isDown || this.keys.A.isDown;
    const right = this.cursors.right.isDown || this.keys.D.isDown;
    const up = this.cursors.up.isDown || this.keys.W.isDown;
    const down = this.cursors.down.isDown || this.keys.S.isDown;
    const dirX = auto ? auto.x : (right ? 1 : 0) - (left ? 1 : 0);
    const dirY = auto ? auto.y : (down ? 1 : 0) - (up ? 1 : 0);
    this.updateTerrainState();
    if (this.burrowUntil > 0 && rt >= this.burrowUntil) this.endBurrow(false);
    this.updateAimFromPointer(this.input.activePointer);
    if (dirX !== 0 || dirY !== 0) this.aimDirection.set(dirX, dirY).normalize();
    if (this.isBurrowing()) {
      this.player.move(
        dirX,
        dirY,
        delta,
        this.run.stats.moveSpeed * EVOLUTION_COMBAT.BURROW.BURROW_SPEED_MULT
      );
    } else if (rt < this.dodgeUntil) {
      this.player.move(
        this.dodgeDirection.x,
        this.dodgeDirection.y,
        delta,
        this.dodgeSpeed
      );
    } else {
      let moveSpeed = this.run.stats.moveSpeed;
      if (this.playerInWater && this.run.evolution.id === 'tidal_shaman') {
        moveSpeed *= EVOLUTION_COMBAT.TIDAL.WATER_MOVE_MULT;
      } else if (this.run.evolution.id === 'tidal_shaman') {
        moveSpeed *= EVOLUTION_COMBAT.TIDAL.DRY_MOVE_MULT;
      } else if (this.playerInWater && this.run.evolution.id !== 'stormwing_archer') {
        moveSpeed *= EVOLUTION_COMBAT.WATER.GROUND_SLOW_MULT;
      }
      this.player.move(dirX, dirY, delta, moveSpeed);
    }
    this.updateEvolutionVisuals();

    // regen
    if (this.run.stats.regenPerSec > 0 && this.player.hp < this.run.stats.maxHp) {
      this.regenCarry += this.run.stats.regenPerSec * (delta / 1000);
      if (this.regenCarry >= 1) {
        const whole = Math.floor(this.regenCarry);
        this.regenCarry -= whole;
        this.player.heal(whole);
      }
    }

    // systems
    this.spawner.update(rt);
    this.spawner.maybeEnrageReaper(rt);
    this.updatePlaytestCombat();
    this.arsenal.update(rt, delta);
    this.loot.update(rt, delta);

    // enemies (swap-pop dead ones out of the hot array)
    const arr = this.activeEnemies;
    for (let i = arr.length - 1; i >= 0; i--) {
      const e = arr[i];
      if (!e.active) {
        arr[i] = arr[arr.length - 1];
        arr.pop();
        continue;
      }
      if (e.def.fleeing && rt - e.spawnedAt > MIMIC.LIFETIME_MS) {
        this.juice.floatText(e.x, e.y - 16, '它逃走了……', COLORS.TEXT_DIM);
        e.disableBody(true, true);
        continue;
      }
      e.updateEnemy(rt, delta, this.player, this);
    }

    // projectile lifespans on the pausable clock + distance cull
    this.cullProjectiles(this.projectiles, rt);
    this.cullProjectiles(this.enemyProjectiles, rt);

    // ground scroll + decor recycling + hp bar follow
    const cam = this.cameras.main;
    this.ground.setTilePosition(cam.scrollX / 2, cam.scrollY / 2); // matches tileScale 2
    this.recycleDecor();
    this.hpBarBg.setPosition(this.player.x, this.player.y - 26).setVisible(!this.isBurrowing());
    const ratio = Phaser.Math.Clamp(this.player.hp / this.run.stats.maxHp, 0, 1);
    this.hpBarFill.setPosition(this.player.x - 17, this.player.y - 26).setScale(ratio, 1).setVisible(!this.isBurrowing());
  }

  private createWaterPools() {
    const definitions = [
      { x: 260, y: 0, radiusX: 165, radiusY: 120 },
      { x: -410, y: 285, radiusX: 220, radiusY: 135 },
      { x: 520, y: -390, radiusX: 190, radiusY: 150 }
    ];
    this.waterPools = definitions.map(definition => {
      const shape = this.add.ellipse(
        definition.x,
        definition.y,
        definition.radiusX * 2,
        definition.radiusY * 2,
        0x145b73,
        0.52
      ).setStrokeStyle(5, 0x45b8cc, 0.42).setDepth(DEPTH.GROUND + 0.5);
      this.add.text(definition.x, definition.y, '潮汐水域', {
        fontFamily: FONT,
        fontSize: '8px',
        color: '#69b9c8',
        stroke: '#082f3a',
        strokeThickness: 3
      }).setOrigin(0.5).setDepth(DEPTH.DECOR).setAlpha(0.72);
      return { ...definition, shape };
    });
  }

  private createEvolutionVisuals() {
    if (this.run.evolution.id === 'stormwing_archer') {
      this.flightWings = [-1, 1].map(side =>
        this.add.image(this.player.x, this.player.y, 'bolt')
          .setDepth(DEPTH.PLAYER - 0.2)
          .setTint(0x8eeaff)
          .setScale(1.45, 0.7)
          .setFlipX(side < 0)
      );
    }
    if (this.run.evolution.id === 'burrow_hunter') {
      this.burrowMarker = this.add.image(this.player.x, this.player.y, 'ring')
        .setDepth(DEPTH.FX)
        .setTint(0xff9a58)
        .setScale(0.8, 0.34)
        .setVisible(false);
    }
    if (this.run.evolution.id === 'tidal_shaman') {
      this.waterRipple = this.add.image(this.player.x, this.player.y, 'ring')
        .setDepth(DEPTH.FX)
        .setTint(0x63e6c4)
        .setScale(0.7, 0.3)
        .setVisible(false);
    }
  }

  private clearEvolutionVisuals() {
    for (const wing of this.flightWings) wing.destroy();
    this.flightWings = [];
    this.burrowMarker?.destroy();
    this.burrowMarker = undefined;
    this.waterRipple?.destroy();
    this.waterRipple = undefined;
    this.player.setAlpha(1);
  }

  private updateTerrainState() {
    this.playerInWater = this.waterPools.some(pool => {
      const dx = (this.player.x - pool.x) / pool.radiusX;
      const dy = (this.player.y - pool.y) / pool.radiusY;
      return dx * dx + dy * dy <= 1;
    });
  }

  private updateEvolutionVisuals() {
    const bob = Math.sin(this.runTime * 0.012);
    if (this.flightWings.length === 2) {
      this.flightWings[0].setPosition(this.player.x - 21, this.player.y - 2 + bob * 4).setRotation(-0.34 - bob * 0.12);
      this.flightWings[1].setPosition(this.player.x + 21, this.player.y - 2 + bob * 4).setRotation(0.34 + bob * 0.12);
    }
    this.burrowMarker?.setVisible(this.isBurrowing())
      .setPosition(this.player.x, this.player.y + 8)
      .setRotation(this.runTime * 0.004);
    this.waterRipple?.setVisible(this.playerInWater)
      .setPosition(this.player.x, this.player.y + 10)
      .setAlpha(0.35 + (bob + 1) * 0.15);

    if (this.isBurrowing()) this.player.setAlpha(0.12);
    else if (this.run.evolution.id === 'tidal_shaman' && this.playerInWater) this.player.setAlpha(0.62);
    else this.player.setAlpha(1);
  }

  private requestPause() {
    if (this.runEnded || this.choosingUpgrade || this.evolutionTransitioning || !this.scene.isActive()) return;
    const now = performance.now();
    if (now - this.lastPauseToggle < 250) return;
    this.lastPauseToggle = now;
    this.scene.launch('Pause');
    this.scene.pause();
  }

  private updateAimFromPointer(pointer: Phaser.Input.Pointer) {
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const dx = world.x - this.player.x;
    const dy = world.y - this.player.y;
    if (dx * dx + dy * dy < 64) return;
    this.aimDirection.set(dx, dy).normalize();
    this.player.setFlipX(this.aimDirection.x < 0);
  }

  private canUseAction() {
    return !this.runEnded && !this.choosingUpgrade && !this.evolutionTransitioning && this.scene.isActive();
  }

  private hasEvolved() {
    return this.run.evolution.id !== BASE_EVOLUTION_ID;
  }

  private beginFirstEvolution() {
    if (this.evolutionTransitioning || this.runEnded) return;
    this.evolutionTransitioning = true;
    for (const enemy of this.activeEnemies) {
      if (enemy.active) enemy.disableBody(true, true);
    }
    this.activeEnemies = [];
    for (const projectile of this.projectiles.getChildren() as Projectile[]) {
      if (projectile.active) projectile.recycle();
    }
    for (const projectile of this.enemyProjectiles.getChildren() as Projectile[]) {
      if (projectile.active) projectile.recycle();
    }
    this.scene.launch('Evolution', {
      firstEvolution: true,
      onChoose: (evolutionId: EvolutionId, flavor?: EvolutionFlavor) => {
        this.applyFirstEvolution(evolutionId, flavor);
      }
    });
    this.scene.pause();
  }

  private applyFirstEvolution(evolutionId: EvolutionId, flavor?: EvolutionFlavor) {
    const hpRatio = Phaser.Math.Clamp(this.player.hp / this.run.stats.maxHp, 0.01, 1);
    this.selectedEvolutionId = evolutionId;
    this.evolutionFlavor = flavor;
    this.run.setEvolution(evolutionId);
    this.player.stats = this.run.stats;
    this.player.hp = Math.max(1, Math.round(this.run.stats.maxHp * hpRatio));
    this.player.setEvolutionTint(this.run.evolution.tint);
    this.clearEvolutionVisuals();
    this.createEvolutionVisuals();
    this.nextCoreAt = this.runTime;
    this.nextDodgeAt = this.runTime;
    this.evolutionTransitioning = false;
    this.justEvolved = true;
    this.scene.resume();
    this.juice.ringPulse(this.player.x, this.player.y, 180, this.run.evolution.tint, 700);
    this.juice.sparkle(this.player.x, this.player.y, this.run.evolution.tint);
    Sfx.play('levelup', 0.8);
  }

  private updatePlaytestCombat() {
    if (!this.playtestInvulnerable) return;
    const target = this.currentBoss?.active
      ? this.currentBoss
      : this.activeEnemies.find(enemy => enemy.active);
    if (!target) return;
    this.aimDirection.set(target.x - this.player.x, target.y - this.player.y).normalize();
    this.tryPrimaryAttack();
    this.tryCoreSkill();
  }

  private tryPrimaryAttack() {
    if (!this.canUseAction() || this.isBurrowing() || this.runTime < this.nextPrimaryAt) return;
    const angle = Math.atan2(this.aimDirection.y, this.aimDirection.x);
    if (!this.arsenal.firePrimary(angle, this.runTime)) return;
    this.nextPrimaryAt = this.runTime + this.arsenal.primaryCooldownMs();
  }

  private tryCoreSkill() {
    if (!this.canUseAction() || this.runTime < this.nextCoreAt) return;
    if (!this.arsenal.fireCore(this.runTime)) return;
    const waterCooldown = this.run.evolution.id === 'tidal_shaman' && this.playerInWater
      ? EVOLUTION_COMBAT.TIDAL.WATER_CORE_MULT
      : 1;
    this.nextCoreAt = this.runTime +
      MANUAL_COMBAT.CORE_COOLDOWN_MS *
      this.run.stats.cooldownMult *
      this.run.evolution.modifiers.coreCooldownMult *
      waterCooldown;
  }

  private trySurvivalAction() {
    if (!this.canUseAction() || this.runTime < this.nextDodgeAt) return;
    const left = this.cursors.left.isDown || this.keys.A.isDown;
    const right = this.cursors.right.isDown || this.keys.D.isDown;
    const up = this.cursors.up.isDown || this.keys.W.isDown;
    const down = this.cursors.down.isDown || this.keys.S.isDown;
    const moveX = (right ? 1 : 0) - (left ? 1 : 0);
    const moveY = (down ? 1 : 0) - (up ? 1 : 0);
    this.dodgeDirection.set(moveX, moveY);
    if (this.dodgeDirection.lengthSq() === 0) this.dodgeDirection.copy(this.aimDirection);
    this.dodgeDirection.normalize();

    if (this.run.evolution.id === 'burrow_hunter') {
      this.burrowUntil = this.runTime + EVOLUTION_COMBAT.BURROW.BURROW_DURATION_MS;
      this.nextDodgeAt = this.runTime +
        MANUAL_COMBAT.DODGE_COOLDOWN_MS * this.run.evolution.modifiers.dodgeCooldownMult;
      this.player.iframesUntil = Math.max(this.player.iframesUntil, this.burrowUntil);
      this.juice.ringPulse(this.player.x, this.player.y, 52, 0xff9a58, 220);
      Sfx.play('magnet', 0.45, -260);
      return;
    }

    const stormwing = this.run.evolution.id === 'stormwing_archer';
    const tidalWater = this.run.evolution.id === 'tidal_shaman' && this.playerInWater;
    const duration = stormwing
      ? EVOLUTION_COMBAT.STORMWING.AIR_DASH_DURATION_MS
      : tidalWater
        ? EVOLUTION_COMBAT.TIDAL.WATER_SLIDE_DURATION_MS
        : MANUAL_COMBAT.DODGE_DURATION_MS;
    this.dodgeSpeed = stormwing
      ? EVOLUTION_COMBAT.STORMWING.AIR_DASH_SPEED
      : tidalWater
        ? EVOLUTION_COMBAT.TIDAL.WATER_SLIDE_SPEED
        : MANUAL_COMBAT.DODGE_SPEED * this.run.evolution.modifiers.dodgeSpeedMult;
    this.dodgeUntil = this.runTime + duration;
    this.nextDodgeAt = this.runTime +
      MANUAL_COMBAT.DODGE_COOLDOWN_MS *
      this.run.evolution.modifiers.dodgeCooldownMult;
    this.player.iframesUntil = Math.max(
      this.player.iframesUntil,
      this.runTime + (stormwing ? EVOLUTION_COMBAT.STORMWING.AIR_DASH_IFRAMES_MS : MANUAL_COMBAT.DODGE_IFRAMES_MS)
    );
    const tint = tidalWater ? 0x63e6c4 : 0x72dcff;
    this.juice.ringPulse(this.player.x, this.player.y, tidalWater ? 58 : 42, tint, 180);
    this.juice.sparkle(this.player.x, this.player.y, tint);
  }

  isBurrowing() {
    return this.run.evolution.id === 'burrow_hunter' && this.runTime < this.burrowUntil;
  }

  endBurrow(consumedByCore: boolean) {
    if (this.burrowUntil <= 0) return;
    this.burrowUntil = 0;
    this.player.setAlpha(1);
    this.ambushUntil = consumedByCore ? 0 : this.runTime + EVOLUTION_COMBAT.BURROW.AMBUSH_WINDOW_MS;
    this.juice.ringPulse(this.player.x, this.player.y, 72, 0xff9a58, 260);
    this.juice.sparkle(this.player.x, this.player.y, 0xff9a58);
  }

  consumeAmbush() {
    const active = this.run.evolution.id === 'burrow_hunter' && this.runTime < this.ambushUntil;
    this.ambushUntil = 0;
    return active;
  }

  isInWater() {
    return this.playerInWater;
  }

  combatUi() {
    switch (this.run.evolution.id) {
      case 'base_creature':
        return { primary: '灵能弹', core: '尚未觉醒', survival: '闪避', status: '基础形态' };
      case 'stormwing_archer':
        return { primary: '雷电箭', core: '连锁闪电', survival: '空中冲刺', status: '飞行中' };
      case 'burrow_hunter':
        return {
          primary: '利爪', core: '破土爆发', survival: '遁地',
          status: this.isBurrowing() ? '地下潜行' : (this.runTime < this.ambushUntil ? '伏击就绪' : '地表')
        };
      case 'tidal_shaman':
        return {
          primary: '潮汐弹', core: '漩涡', survival: '水中滑行',
          status: this.playerInWater ? '潜水中' : '陆地'
        };
    }
  }

  evolutionDisplayName() {
    return this.evolutionFlavor?.name ?? this.run.evolution.name;
  }

  combatCooldowns() {
    return {
      primaryMs: Math.max(0, this.nextPrimaryAt - this.runTime),
      coreMs: Math.max(0, this.nextCoreAt - this.runTime),
      dodgeMs: Math.max(0, this.nextDodgeAt - this.runTime)
    };
  }

  private cullProjectiles(group: Phaser.Physics.Arcade.Group, rt: number) {
    const children = group.getChildren() as Projectile[];
    for (const p of children) {
      if (!p.active) continue;
      if (rt - p.bornAt > p.lifespanMs) {
        p.recycle();
        continue;
      }
      const dx = p.x - this.player.x;
      const dy = p.y - this.player.y;
      if (dx * dx + dy * dy > 1200 * 1200) p.recycle();
    }
  }

  private recycleDecor() {
    for (const d of this.decor) {
      const dx = d.x - this.player.x;
      const dy = d.y - this.player.y;
      if (dx * dx + dy * dy > 1100 * 1100) {
        const a = Math.random() * Math.PI * 2;
        const dist = Phaser.Math.Between(620, 1000);
        d.setPosition(this.player.x + Math.cos(a) * dist, this.player.y + Math.sin(a) * dist);
        d.setFrame(Phaser.Math.RND.pick(DECOR_FRAMES));
      }
    }
  }

  // ------------------------------------------------------------------ combat

  private onProjectileHit(proj: Projectile, enemy: Enemy) {
    if (!proj.active || !enemy.active || proj.hits.has(enemy)) return;
    proj.hits.add(enemy);
    const body = proj.body as Phaser.Physics.Arcade.Body;
    this.juice.impact(proj.x, proj.y);
    this.damageEnemy(enemy, proj.damage, body.velocity.x, body.velocity.y, proj.knockback);
    if (proj.splashRadius > 0) {
      this.juice.ringPulse(proj.x, proj.y, proj.splashRadius, 0x63e6c4, 240);
      for (const nearby of this.activeEnemies) {
        if (nearby === enemy || !nearby.active || proj.hits.has(nearby)) continue;
        const dx = nearby.x - proj.x;
        const dy = nearby.y - proj.y;
        if (dx * dx + dy * dy > (proj.splashRadius + nearby.def.radius) ** 2) continue;
        proj.hits.add(nearby);
        this.damageEnemy(nearby, proj.damage * proj.splashDamageMult, dx, dy, proj.knockback * 0.55);
      }
    }
    proj.pierceLeft -= 1;
    if (proj.pierceLeft < 0) proj.recycle();
  }

  /** central damage sink — variance, numbers, kill credit, drops */
  damageEnemy(enemy: Enemy, rawDamage: number, knockX: number, knockY: number, knockForce: number) {
    if (!enemy.active || this.runEnded) return;
    const dmg = Math.max(1, Math.round(rawDamage * Phaser.Math.FloatBetween(0.92, 1.08)));
    const died = enemy.takeHit(dmg, this.runTime, knockX, knockY, knockForce);
    this.juice.damageNumber(enemy.x, enemy.y - 14, dmg, dmg >= 45 ? '#ffd34e' : '#ffffff', dmg >= 45);
    Sfx.play('hit', 0.25, Phaser.Math.Between(-150, 150));
    if (died) {
      this.killEnemy(enemy);
    } else if (
      enemy.def.id === 'boss_reaper' &&
      enemy.hp <= enemy.maxHp * RUN.BOSS_PHASE_TWO_HP_RATIO &&
      enemy.enterBossPhaseTwo(this.runTime)
    ) {
      this.onBossPhaseTwo(enemy);
    }
  }

  private killEnemy(enemy: Enemy) {
    this.run.kills += 1;
    this.juice.deathPoof(enemy.x, enemy.y, enemy.isElite || enemy.def.fleeing ? 0xffd34e : 0x9a6aff);
    Sfx.play('die', 0.3, Phaser.Math.Between(-100, 200));
    this.loot.dropFor(enemy);
    const wasBoss = enemy.def.boss;
    const wasReaper = enemy.def.id === 'boss_reaper';
    if (wasBoss) {
      this.loot.spawnPickup(enemy.x, enemy.y, 'chest');
      this.juice.shake(0.007, 350);
      if (this.currentBoss === enemy) this.currentBoss = null;
    }
    enemy.disableBody(true, true);
    if (wasReaper) this.endRun(true);
  }

  private onEnemyContact(enemy: Enemy) {
    if (!enemy.active || this.runEnded) return;
    if (enemy.def.fleeing) return; // mimics are harmless — loot, not threat
    if (this.isBurrowing()) return;
    if (this.run.evolution.id === 'stormwing_archer' && !AIR_THREATS.has(enemy.def.id)) return;
    if (this.runTime < enemy.nextContactAt) return;
    enemy.nextContactAt = this.runTime + PLAYER.CONTACT_TICK_MS;
    const waterGuard = this.run.evolution.id === 'tidal_shaman' && this.playerInWater ? 0.72 : 1;
    this.hurtPlayer(enemy.contactDamage * waterGuard);
  }

  private onEnemyOrbHit(proj: Projectile) {
    if (!proj.active || this.runEnded) return;
    if (this.isBurrowing()) return;
    proj.recycle();
    const waterGuard = this.run.evolution.id === 'tidal_shaman' && this.playerInWater ? 0.72 : 1;
    this.hurtPlayer(proj.damage * waterGuard);
  }

  private hurtPlayer(amount: number) {
    if (this.playtestInvulnerable) return;
    const final = Math.max(1, Math.round(amount - this.run.stats.armor));
    const dealt = this.player.hurt(final, this.runTime);
    if (dealt <= 0) return;
    this.juice.shake(0.005, 150);
    if (this.player.hp <= 0) {
      if (this.run.revivesLeft > 0) this.gravewalkerRevive();
      else this.endRun(false);
    }
  }

  /** Gravewalker's Pact: once per run, rise at half HP with a repelling shockwave */
  private gravewalkerRevive() {
    this.run.revivesLeft -= 1;
    this.player.hp = Math.max(1, Math.round(this.run.stats.maxHp * 0.5));
    this.player.iframesUntil = this.runTime + 2000;
    this.juice.announce('墓穴拒绝了你的死亡', '#6ee86e');
    this.juice.ringPulse(this.player.x, this.player.y, 240, 0x6ee86e, 600);
    this.juice.shake(0.008, 400);
    Sfx.play('levelup', 0.7);
    for (const e of this.activeEnemies) {
      const dx = e.x - this.player.x;
      const dy = e.y - this.player.y;
      if (dx * dx + dy * dy > 260 * 260) continue;
      this.damageEnemy(e, 30, dx, dy, 420);
    }
  }

  /** EnemyContext — cultists, witch and reaper shoot through this */
  fireEnemyOrb(from: Enemy, dirX: number, dirY: number, speed: number, damage: number) {
    const p = this.enemyProjectiles.get() as Projectile | null;
    if (!p) return;
    p.fire({
      kind: 'orb',
      x: from.x,
      y: from.y,
      vx: dirX * speed,
      vy: dirY * speed,
      damage: Math.round(damage * this.spawner.dmgMult(this.runTime)),
      knockback: 0,
      pierce: 0,
      runTime: this.runTime,
      texture: 'glow_orb',
      tint: from.def.id === 'boss_reaper' ? 0xb46aff : 0xff5a78,
      scale: 0.85,
      lifespanMs: 5000,
      bodyRadius: 8
    });
  }

  // ------------------------------------------------------------------- loot

  onXp(value: number) {
    if (this.playtestInvulnerable) return;
    const ups = this.run.addXp(value);
    if (ups > 0) {
      this.pendingLevelUps += ups;
      if (!this.choosingUpgrade) this.showLevelUp();
    }
  }

  private showLevelUp() {
    if (this.pendingLevelUps <= 0 || this.runEnded) return;
    this.pendingLevelUps -= 1;
    this.choosingUpgrade = true;
    Sfx.play('levelup', 0.6);
    const choices = this.run.buildChoices(this.rng);
    this.scene.launch('LevelUp', {
      choices,
      pick: (c: UpgradeChoice) => this.applyLevelUpChoice(c)
    });
    this.scene.pause();
  }

  private applyLevelUpChoice(c: UpgradeChoice) {
    this.scene.stop('LevelUp');
    this.scene.resume();
    this.choosingUpgrade = false;
    this.applyUpgrade(c);
    if (this.pendingLevelUps > 0) {
      this.time.delayedCall(150, () => this.showLevelUp());
    }
  }

  private applyUpgrade(c: UpgradeChoice) {
    if (c.kind === 'heal') {
      this.player.heal(40);
      this.juice.floatText(this.player.x, this.player.y - 24, '+40', COLORS.HEAL);
    } else if (c.kind === 'gold') {
      this.run.addGold(30);
      this.juice.floatText(this.player.x, this.player.y - 24, '+30 金币', '#ffd34e');
    } else {
      this.run.applyChoice(c);
      if (c.kind === 'passive' && c.id === 'vitality') this.player.heal(25);
      this.player.hp = Math.min(this.player.hp, this.run.stats.maxHp);
      this.maybeHintEvolution();
    }
  }

  /** one-time nudge when a weapon becomes evolution-eligible */
  private maybeHintEvolution() {
    for (const [id, lvl] of this.run.weapons) {
      if (lvl !== WEAPON_MAX_LEVEL || this.evoHinted.has(id)) continue;
      const evo = WEAPONS[id].evolution;
      if (!evo || !this.run.passives.has(evo.requires)) continue;
      this.evoHinted.add(id);
      this.juice.floatText(
        this.player.x,
        this.player.y - 44,
        `${WEAPONS[id].name}渴望进化——击败首领！`,
        '#ff9a3c'
      );
    }
  }

  /** evolve the first eligible weapon: maxed + matching passive owned */
  private tryEvolveWeapon(): boolean {
    for (const [id, lvl] of this.run.weapons) {
      if (lvl !== WEAPON_MAX_LEVEL) continue;
      const evo = WEAPONS[id].evolution;
      if (!evo || !this.run.passives.has(evo.requires)) continue;
      this.run.weapons.set(id, EVOLVED_LEVEL);
      this.juice.announce(evo.name.toUpperCase(), '#ff9a3c');
      this.juice.ringPulse(this.player.x, this.player.y, 230, 0xff9a3c, 700);
      this.juice.floatText(this.player.x, this.player.y - 40, '武器已进化', '#ff9a3c');
      this.juice.shake(0.006, 350);
      Sfx.play('levelup', 0.8, -200);
      return true;
    }
    return false;
  }

  openChest() {
    Sfx.play('chest', 0.6);
    this.juice.ringPulse(this.player.x, this.player.y, 140, 0xffd34e, 500);
    this.run.addGold(DROPS.CHEST_GOLD);
    this.player.heal(DROPS.CHEST_HEAL);
    if (this.tryEvolveWeapon()) return;
    const up = this.run.randomDirectUpgrade(this.rng);
    if (up) {
      this.applyUpgrade(up);
      this.juice.floatText(
        this.player.x,
        this.player.y - 40,
        `${up.name} Lv${up.level ?? 1}`,
        '#ffd34e'
      );
    } else {
      this.juice.floatText(this.player.x, this.player.y - 40, `+${DROPS.CHEST_GOLD} 金币`, '#ffd34e');
    }
  }

  onBossSpawned(e: Enemy) {
    this.currentBoss = e;
    if (e.def.id === 'boss_reaper') this.reaperSpawned = true;
  }

  onWaveStarted(wave: number) {
    const labels = ['近战压力', '高速威胁', '远程压力'];
    const prefix = wave === 2 && this.justEvolved
      ? `首次进化 · ${this.evolutionDisplayName()}\n`
      : '';
    this.justEvolved = false;
    this.juice.announce(`${prefix}第 ${wave}/${RUN.WAVE_COUNT} 波 · ${labels[wave - 1]}`, '#d8b34a');
  }

  prepareBossArena() {
    for (const enemy of this.activeEnemies) {
      if (enemy.active && !enemy.def.boss) enemy.disableBody(true, true);
    }
    for (const projectile of this.enemyProjectiles.getChildren() as Projectile[]) {
      if (projectile.active) projectile.recycle();
    }
    this.player.heal(25);
    this.player.iframesUntil = Math.max(this.player.iframesUntil, this.runTime + 1200);
    this.juice.floatText(this.player.x, this.player.y - 30, '+25 首领战补给', COLORS.HEAL);
    this.juice.ringPulse(this.player.x, this.player.y, 190, 0xffd34e, 600);
  }

  private onBossPhaseTwo(enemy: Enemy) {
    for (const projectile of this.enemyProjectiles.getChildren() as Projectile[]) {
      if (projectile.active) projectile.recycle();
    }
    this.juice.announce('第二阶段 · 守卫苏醒', '#d85cff');
    this.juice.ringPulse(enemy.x, enemy.y, 260, 0xb04cff, 850);
    this.juice.lightningStrike(enemy.x, enemy.y, 120);
    this.juice.shake(0.012, 650);
    Sfx.play('boss', 0.9, -160);
  }

  encounterUi() {
    const boss = this.currentBoss;
    if (boss?.active) {
      return {
        stage: `首领 · 阶段 ${boss.bossPhase}/2`,
        objective: boss.bossPhase === 1 ? '观察瞄准弹幕' : '躲避螺旋弹幕'
      };
    }
    const seconds = this.runTime / 1000;
    const wave = Math.min(RUN.WAVE_COUNT, Math.floor(seconds / RUN.WAVE_DURATION_SEC) + 1);
    if (!this.hasEvolved()) {
      return {
        stage: '第 1/3 波',
        objective: `首次进化还有 ${Math.max(0, Math.ceil(RUN.WAVE_DURATION_SEC - seconds))} 秒`
      };
    }
    const remaining = Math.max(0, Math.ceil(RUN.BOSS_AT - seconds));
    return {
      stage: `第 ${wave}/${RUN.WAVE_COUNT} 波`,
      objective: `距离首领出现还有 ${remaining} 秒`
    };
  }

  // --------------------------------------------------------------- end / win

  private endRun(victory: boolean) {
    if (this.runEnded) return;
    this.runEnded = true;
    this.physics.pause();
    Sfx.stopMusic();
    Sfx.play(victory ? 'victory' : 'death', 0.7);
    if (victory) {
      this.juice.announce('试炼完成', '#ffd34e');
    } else {
      this.cameras.main.flash(600, 120, 0, 0);
      this.player.setTintFill(0xff2020);
    }
    this.juice.shake(victory ? 0.006 : 0.01, 500);

    const result: RunResult = {
      victory,
      timeSurvivedSec: Math.floor(this.runTime / 1000),
      level: this.run.level,
      kills: this.run.kills,
      gold: Math.floor(this.run.gold),
      evolutionId: this.run.evolution.id,
      evolutionName: this.evolutionDisplayName(),
      storyHook: this.evolutionFlavor?.storyHook
    };
    const save = loadSave();
    save.runs += 1;
    if (victory) save.wins += 1;
    save.bestTimeSec = Math.max(save.bestTimeSec, result.timeSurvivedSec);
    save.bestKills = Math.max(save.bestKills, result.kills);
    save.gold += result.gold; // banked — spend it in the Crypt Shop
    storeSave(save);

    this.time.delayedCall(1400, () => {
      this.scene.stop('Hud');
      this.scene.start('GameOver', result);
    });
  }
}
