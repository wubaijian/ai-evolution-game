import Phaser from 'phaser';
import { DIFFICULTY, MIMIC, RUN } from '../config';
import { ENEMIES } from '../data/enemies';
import { WAVE_PHASES, freshEvents } from '../data/waves';
import { Sfx } from './audio';
import type { Enemy } from '../entities/Enemy';
import type { EnemyTypeId, TimedEvent } from '../types';
import type { GameScene } from '../scenes/GameScene';

/**
 * Drives the pressure curve: timeline phases, scripted events (rings, elites,
 * bosses, swarms), spawn-ring placement and the leash that recycles enemies
 * the player outran.
 */
export class SpawnDirector {
  private gs: GameScene;
  private events: TimedEvent[] = freshEvents();
  private nextSpawnAt = 0;
  private nextLeashCheckAt = 0;
  private announcedWave = 0;

  constructor(gs: GameScene) {
    this.gs = gs;
  }

  private currentPhase(tSec: number) {
    let phase = WAVE_PHASES[0];
    for (const p of WAVE_PHASES) {
      if (tSec >= p.tStart) phase = p;
      else break;
    }
    return phase;
  }

  hpMult(runTime: number): number {
    return 1 + (runTime / 60000) * DIFFICULTY.HP_GROWTH_PER_MIN;
  }

  dmgMult(runTime: number): number {
    return 1 + (runTime / 60000) * DIFFICULTY.DMG_GROWTH_PER_MIN;
  }

  update(runTime: number) {
    const tSec = runTime / 1000;
    const phase = this.currentPhase(tSec);
    const wave = Math.min(RUN.WAVE_COUNT, Math.floor(tSec / RUN.WAVE_DURATION_SEC) + 1);
    if (tSec < RUN.BOSS_AT && wave !== this.announcedWave) {
      this.announcedWave = wave;
      this.gs.onWaveStarted(wave);
    }

    // steady pressure
    if (runTime >= this.nextSpawnAt) {
      this.nextSpawnAt = runTime + phase.spawnIntervalMs;
      const alive = this.gs.activeEnemies.length;
      if (alive < phase.maxAlive) {
        // catch up faster when far below the cap
        const burst = alive < phase.maxAlive - 40 ? 3 : 1;
        for (let i = 0; i < burst; i++) this.spawnFromPool(phase.pool, runTime);
      }
    }

    // scripted events
    for (const ev of this.events) {
      if (ev.fired || tSec < ev.t) continue;
      ev.fired = true;
      this.fireEvent(ev, runTime);
    }

    // leash: recycle stragglers to the ring (cheap, staggered)
    if (runTime >= this.nextLeashCheckAt) {
      this.nextLeashCheckAt = runTime + 800;
      const { player } = this.gs;
      const leashSq = DIFFICULTY.LEASH_RADIUS * DIFFICULTY.LEASH_RADIUS;
      for (const e of this.gs.activeEnemies) {
        if (e.def.boss) continue;
        const dx = e.x - player.x;
        const dy = e.y - player.y;
        if (dx * dx + dy * dy > leashSq) {
          if (e.def.fleeing) {
            e.disableBody(true, true); // the mimic got away
            continue;
          }
          const p = this.ringPosition();
          e.setPosition(p.x, p.y);
        }
      }
    }
  }

  private fireEvent(ev: TimedEvent, runTime: number) {
    switch (ev.kind) {
      case 'ring': {
        const n = ev.count ?? 20;
        const { player, juice } = this.gs;
        juice.announce('敌人正在包围你', '#d8b34a');
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          this.spawn(ev.type ?? 'imp', player.x + Math.cos(a) * 540, player.y + Math.sin(a) * 540, runTime);
        }
        break;
      }
      case 'swarm': {
        const n = ev.count ?? 30;
        const a = Math.random() * Math.PI * 2;
        const { player } = this.gs;
        for (let i = 0; i < n; i++) {
          const jitterA = a + Phaser.Math.FloatBetween(-0.5, 0.5);
          const dist = Phaser.Math.Between(DIFFICULTY.SPAWN_RADIUS_MIN, DIFFICULTY.SPAWN_RADIUS_MAX + 200);
          this.spawn(ev.type ?? 'imp', player.x + Math.cos(jitterA) * dist, player.y + Math.sin(jitterA) * dist, runTime);
        }
        break;
      }
      case 'elite': {
        const p = this.ringPosition();
        const e = this.spawn(ev.type ?? 'zombie', p.x, p.y, runTime, true);
        if (e) this.gs.juice.announce(`精英 · ${e.def.name}`, '#ffd34e');
        break;
      }
      case 'mimic': {
        const { player, juice } = this.gs;
        const a = Math.random() * Math.PI * 2;
        const e = this.spawn('mimic', player.x + Math.cos(a) * MIMIC.SPAWN_DIST, player.y + Math.sin(a) * MIMIC.SPAWN_DIST, runTime);
        if (e) {
          juice.announce('墓穴宝箱怪正在逃跑！', '#ffd34e');
          Sfx.play('coin', 0.7, -200);
        }
        break;
      }
      case 'boss': {
        this.gs.prepareBossArena();
        const p = this.ringPosition();
        const e = this.spawn(ev.type ?? 'boss_colossus', p.x, p.y, runTime);
        if (e) {
          this.gs.juice.announce(e.def.name, '#ff5050');
          this.gs.juice.shake(0.006, 400);
          Sfx.play('boss', 0.8);
          this.gs.onBossSpawned(e);
        }
        break;
      }
    }
  }

  private spawnFromPool(pool: { type: EnemyTypeId; weight: number }[], runTime: number) {
    let total = 0;
    for (const p of pool) total += p.weight;
    let roll = Math.random() * total;
    let type = pool[0].type;
    for (const p of pool) {
      roll -= p.weight;
      if (roll <= 0) {
        type = p.type;
        break;
      }
    }
    const pos = this.ringPosition();
    this.spawn(type, pos.x, pos.y, runTime);
  }

  private ringPosition(): { x: number; y: number } {
    const { player } = this.gs;
    const a = Math.random() * Math.PI * 2;
    const d = Phaser.Math.Between(DIFFICULTY.SPAWN_RADIUS_MIN, DIFFICULTY.SPAWN_RADIUS_MAX);
    return { x: player.x + Math.cos(a) * d, y: player.y + Math.sin(a) * d };
  }

  spawn(type: EnemyTypeId, x: number, y: number, runTime: number, elite = false): Enemy | null {
    const e = this.gs.enemies.get() as Enemy | null;
    if (!e) return null;
    const def = ENEMIES[type];
    // bosses get extra scaling beyond the 12-minute curve if the run drags on
    const hpMult = this.hpMult(runTime);
    const dmgMult = this.dmgMult(runTime);
    e.spawn(def, x, y, runTime, hpMult, dmgMult, elite);
    this.gs.activeEnemies.push(e);
    return e;
  }

  /** Reaper enrage check — called from GameScene update */
  maybeEnrageReaper(runTime: number) {
    const reaper = this.gs.activeEnemies.find(e => e.def.id === 'boss_reaper');
    if (!reaper) return;
    const aliveSec = (runTime - reaper.spawnedAt) / 1000;
    if (aliveSec > RUN.REAPER_ENRAGE_AFTER && !this.reaperEnraged) {
      this.reaperEnraged = true;
      reaper.contactDamage = Math.round(reaper.contactDamage * 2.5);
      reaper.setTint(0xff3030);
      this.gs.juice.announce('死亡已经失去耐心', '#ff3030');
      this.gs.juice.shake(0.008, 500);
      Sfx.play('boss', 0.9);
    }
  }

  private reaperEnraged = false;
}
