# Decisions log

## 2026-06-11 (evening) — meta-progression + evolutions (Claude Fable 5)

- **Crypt Shop = data-driven like passives.** `src/data/meta.ts` mirrors the `PASSIVES`
  contract (`apply(stats)` once per owned level); `RunState.recompute()` stacks meta first,
  then passives, both on top of base — one stat pipeline, no special cases.
- **Gold banks on run end** (win or lose, you keep it — VS convention). `SaveData` gained
  `gold` + `meta`; old saves merge clean via spread-with-defaults (fresh `meta` object each
  load so DEFAULTS is never mutated by reference).
- **Gold is fractional internally** (Miser's Curse multiplier runs through `RunState.addGold`),
  floored at display/bank time. Cheaper than carry-accounting per pickup.
- **Shop cost curve totals ~1550 gold** for everything (a dozen decent runs): per-level cost
  arrays in the defs, no formula — easier to hand-tune single steps later.
- **Gravewalker revive lives in `hurtPlayer`**, not `endRun`: half HP, 2s i-frames, and a
  260px damage+knockback shockwave so you don't instantly re-die inside the swarm that
  killed you. `revivesLeft` is snapshotted at run start (buying mid-run can't grant one).
- **Weapon evolutions = weapon level 6.** Maxed (5) weapon + matching passive owned + open a
  boss chest → evolution replaces the random chest upgrade (priority), announced big.
  `weaponLevelFor(id, lvl)` resolves the level-6 stats transparently, so `Arsenal` needed no
  new behavior code — evolutions are stat/visual upgrades of existing behaviors (per-weapon
  tints/scale mark them; HUD shows a gold-bordered `E` icon). Level-up cards never offer
  level 6 (`buildChoices` caps at `WEAPON_MAX_LEVEL`), so the only path is the chest.
- **Pairings:** spark+power, arc+haste, axes+vitality, orbitals+swiftness, nova+shield,
  storm+echo — every passive powers exactly one evolution, so any 4-weapon build can chase
  at most its own pairs.
- **One-time "X thirsts — slay a boss!" float** when a pair becomes eligible (`evoHinted`
  set, reset per run) — discoverability without a tutorial.
- Shop UI is keyboard-first (grid nav + ENTER) with full mouse support; Title's global
  "click to fight" is kept off the shop button via Phaser's `event.stopPropagation()` in the
  object handler (object handlers fire before the scene-level `POINTER_DOWN`).
- **Tomb Mimic = a `fleeing` flag on EnemyDef**, not a new entity class: flee-with-wobble
  brain branch in `Enemy.updateEnemy`, contact early-return (it deals no damage — `hurtPlayer`
  floors at 1, so skipping beats `damage: 0`), coin-shower instead of gems in `Loot.dropFor`,
  and two escape paths (10s lifetime in the GameScene loop; crossing the 1100px leash
  despawns it instead of recycling). Knobs in `config.MIMIC`; spawns t=150/420/570.
- **Playwright-testing pause-sensitive behavior:** level-up modals pause the Game scene and
  silently freeze any in-flight measurement (`setTimeout` keeps running, runTime doesn't).
  For movement assertions set `run.xpNeeded = 1e9` + long player i-frames first, and sample
  `runTime` inside the evaluate to prove the clock advanced.
- **Master volume = one global knob** (`game.sound.volume`), persisted in the save, stepped
  10% via pause-menu row + title keys. **Gotcha:** Phaser's WebAudio manager applies volume
  through the gain node asynchronously — reading `game.sound.volume` right after setting it
  returns the OLD value (display lagged one step). The AudioBus now caches the volume itself
  and never reads it back from the sound manager.
- **Local `vite build` can segfault on this machine** (node crash mid-transform, observed
  3× in a row then fine) — OneDrive sync + a running dev server contending over the project
  dir is the likely cause. It is environmental, not code: `tsc` stayed green and the same
  build passed minutes later. If it recurs: stop the dev server, `rm -rf dist`, retry; the
  CI build on Ubuntu is the authoritative gate either way.

## 2026-06-11 — initial one-shot build (Claude Fable 5)

- **Stack: Phaser 3.90 + TS strict + Vite 7.** Phaser 4.1 exists but 3.x is the
  battle-tested line the `phaser-game` skill targets; 3.90 is the latest 3.x. Vite 8 was
  freshly released → pinned Vite 7 (stable) to de-risk a one-shot. TS 6 exists → same call, ^5.9.
- **Repo name = folder name (`fable-bullet-heaven`), game has its own title (GRAVEHORDE).**
  Keeps provenance obvious; the game can be renamed without touching the repo.
- **Art: Kenney "Tiny Dungeon" (CC0) + procedural glow.** No skeleton sprite in the pack, so
  the bestiary leans rats/oozes/wraiths instead. Bullets/gems/FX/icons are generated at boot
  (canvas radial gradients + Graphics) — they look better glowing than static pixels, and they
  dodge licensing entirely. Asset URLs researched+verified by a Sonnet subagent (see CREDITS.md).
- **Frame indices mapped by eye** from a labeled contact sheet (PIL upscale, tmp/) and
  centralized in `src/data/frames.ts`.
- **12-minute run** (VS does 30) — right scope for a one-shot demo; bosses at 4/8/12,
  victory = killing the 12:00 Reaper, who enrages 90s after spawning to prevent stalling.
- **One pausable run-clock** (`GameScene.runTime`) for all gameplay timing. Phaser's `time`
  keeps flowing during scene pause; mixing clocks desyncs cooldowns vs. level-up pauses.
- **Pooling everywhere; loot has no physics bodies** — gems/pickups use distance checks in one
  pass (cheaper than 300 arcade bodies and good enough).
- **Enemy separation via a single self-collider** on the enemy group: acceptable at the
  ~240-alive cap (57+ FPS measured with 188 + boss).
- **Event-driven one-shot keys.** Phaser `Key.onUp` clears the `_justDown` latch, so
  keydown+keyup arriving in one input flush (fast taps, automated input) make
  `JustDown()` polling drop the press. Movement stays polled (held keys are fine).
  Found via instrumented Playwright probes against `node_modules/phaser` source.
- **Test hooks**: `window.__gravehorde` (game handle) + `window.__ghMove` (move override).
  Used by the autonomous playtest bot (threat-repulsion + gem-attraction steering installed
  via Playwright `evaluate`, auto-picks upgrade card 0, logs hp/level/kills/fps every 5s).
- **Git: worked on `feat/game`, merged to `main` for Pages deploys.** User pre-authorized
  pushes in the kickoff prompt.

## Known trade-offs (deliberate)

- Single playable character — time-boxed. ~~No meta-progression shop~~ (Crypt Shop shipped
  in the evening session; gold banks + 8 permanent upgrades).
- Evolutions are stat/visual upgrades of existing behaviors, not new mechanics — keeps the
  Arsenal switch untouched; revisit if a evolved form should *feel* mechanically new.
- No mobile/touch controls — desktop keyboard game.
- `LevelUpScene` receives a `pick` callback via scene data — simple, works; an event bus
  would be cleaner if scenes multiply.
