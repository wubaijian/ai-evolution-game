import Phaser from 'phaser';
import { loadSave, storeSave } from './save';

/**
 * Thin global audio bus over Phaser's sound manager.
 * - rotates numbered variants (hit_0/hit_1/hit_2) to avoid machine-gun sameness
 * - rate-limits spammy keys
 * - owns the music track + mute state (persisted)
 */
class AudioBus {
  private game?: Phaser.Game;
  private counters: Record<string, number> = {};
  private lastPlayed: Record<string, number> = {};
  private variants: Record<string, number> = {
    hit: 3, die: 2, gem: 3, swing: 2, zap: 2
  };
  /** min ms between plays of the same logical sfx */
  private limits: Record<string, number> = {
    hit: 70, die: 90, gem: 50, swing: 120, zap: 110, coin: 60, nova: 350, axe: 150
  };
  private music?: Phaser.Sound.BaseSound;

  /** cached master volume — the WebAudio gain node applies sets asynchronously,
      so reading game.sound.volume right back returns the OLD value */
  private vol = 1;

  init(game: Phaser.Game) {
    this.game = game;
    const save = loadSave();
    game.sound.mute = save.muted;
    this.vol = save.volume;
    game.sound.volume = this.vol;
  }

  get muted(): boolean {
    return this.game?.sound.mute ?? false;
  }

  /** master volume 0..1 (multiplies every sfx + music volume) */
  get volume(): number {
    return this.vol;
  }

  /** step the master volume in 10% increments and persist it */
  adjustVolume(deltaSteps: number) {
    if (!this.game) return;
    this.vol = Phaser.Math.Clamp(Math.round(this.vol * 10 + deltaSteps) / 10, 0, 1);
    this.game.sound.volume = this.vol;
    const save = loadSave();
    save.volume = this.vol;
    storeSave(save);
  }

  toggleMute(): boolean {
    if (!this.game) return false;
    this.game.sound.mute = !this.game.sound.mute;
    const save = loadSave();
    save.muted = this.game.sound.mute;
    storeSave(save);
    return this.game.sound.mute;
  }

  /** play a logical sfx ('hit' picks hit_0..2). volume 0..1, detuneCents optional */
  play(key: string, volume = 0.5, detuneCents = 0) {
    if (!this.game) return;
    const now = performance.now();
    const limit = this.limits[key] ?? 0;
    if (limit && now - (this.lastPlayed[key] ?? -9999) < limit) return;
    this.lastPlayed[key] = now;

    let assetKey = key;
    const n = this.variants[key];
    if (n) {
      this.counters[key] = ((this.counters[key] ?? 0) + 1) % n;
      assetKey = `${key}_${this.counters[key]}`;
    }
    if (!this.game.cache.audio.exists(assetKey)) return;
    this.game.sound.play(assetKey, { volume, detune: detuneCents });
  }

  /** swap the looping music track (no-op if already playing that key) */
  playMusic(key: string, volume = 0.35) {
    if (!this.game || !this.game.cache.audio.exists(key)) return;
    const start = () => {
      if (!this.game) return;
      if (this.music && this.music.key === key && this.music.isPlaying) return;
      this.music?.stop();
      this.music?.destroy();
      this.music = this.game.sound.add(key, { loop: true, volume });
      this.music.play();
    };
    if (this.game.sound.locked) {
      // browser autoplay policy: wait for the first user gesture
      this.pendingMusic = key;
      this.game.sound.once(Phaser.Sound.Events.UNLOCKED, () => {
        if (this.pendingMusic === key) start();
      });
    } else {
      start();
    }
  }

  private pendingMusic?: string;

  stopMusic() {
    this.music?.stop();
  }
}

export const Sfx = new AudioBus();
