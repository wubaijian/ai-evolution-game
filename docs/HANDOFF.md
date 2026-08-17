# HANDOFF — GRAVEHORDE

_Last update: 2026-06-11, end of evening session (Claude Fable 5)_

## Now

Nothing in progress — session closed clean. v2 (Crypt Shop + evolutions + Tomb Mimic) is
**deployed and confirmed live** at https://mukstoo.github.io/fable-bullet-heaven/ (bundle
content-verified via curl). The volume-control commit was pushed right at session end:
**confirm its Pages run went green** (Actions tab — the GitHub API was timing out locally,
so the very last deploy is pushed-but-not-curl-verified).

## Done (this session)

- **Crypt Shop meta-progression** — gold banks to the save on run end; 8 permanent
  upgrades incl. once-per-run Gravewalker revive (half HP + repel shockwave).
  Files: `src/data/meta.ts`, `src/scenes/ShopScene.ts`, `src/systems/save.ts`,
  `src/systems/RunState.ts` (meta stacks before passives in `recompute()`),
  entries in Title `[S]` / GameOver `[S]`.
- **Weapon evolutions** — all 6 weapons: maxed (LV5) + paired passive + boss chest →
  level-6 form via `weaponLevelFor()`; chest evolution outranks the random chest upgrade;
  one-time "thirsts — slay a boss!" hint; HUD gold-border `E`. Files: `src/data/weapons.ts`
  (`evolution` blocks), `src/systems/Arsenal.ts`, `src/scenes/GameScene.ts`.
- **Tomb Mimic treasure event** (t=150/420/570) — `fleeing` flag on EnemyDef: harmless,
  flees with wobble, 12–18 coin shower on kill, escapes after 10s or past the leash.
  Files: `src/data/enemies.ts`, `src/entities/Enemy.ts`, `src/systems/SpawnDirector.ts`,
  `src/systems/Loot.ts`, `config.MIMIC`.
- **Master volume** — persisted 0–100% (10% steps): pause-menu row (clickable `[<]`/`[>]`
  + arrows) and title keys (`,`/`.`/arrows). Files: `src/systems/audio.ts` (cached volume),
  `src/scenes/PauseScene.ts`, `src/scenes/TitleScene.ts`. Pause build list now names
  evolved weapons ("Soulfire Barrage (EVOLVED)").
- All of it Playwright-verified in real Chrome (purchase→persist→stats→revive→bank loop;
  evolve/no-double-evolve; mimic flee/kill/escape; volume sync + persistence).

## Decisions (full log in docs/decisions.md)

- Meta upgrades reuse the passive `apply(stats)` contract; one stat pipeline.
- `run.gold` is fractional internally (Miser's Curse multiplier); floor on display/bank.
- Evolutions are stat/visual upgrades (weapon level 6), not new behaviors — Arsenal untouched.
- AudioBus caches master volume — Phaser's WebAudio gain applies sets async, reading
  `game.sound.volume` back returns the old value.
- Local `vite build` segfaulted 3× (OneDrive + dev-server contention), then passed —
  environmental; stop dev server / `rm -rf dist` / retry; CI is the authoritative gate.

## Checks (state at close)

- `tsc --noEmit` ✅ · `vite build` ✅ (after env retries) · zero console errors in browser runs.
- Working tree clean; `feat/game` = `main` = pushed.

## Next (in order)

1. **Rodrigo's first human playtest** — shop cost curve (~1550 gold total, ~50–120/run)
   and evolved-weapon power are bot-balanced guesses. Knobs: `src/config.ts`, `src/data/*`.
2. **2nd playable character** — sprites already in the tilemap (frames 84–112); needs
   character select on Title + per-character starting weapon/stat spread.
3. Touch controls (virtual joystick) → damage-type variety (DoT/slow/crits) → itch.io.
4. `docs/setup-review.md` tooling proposals — only what Rodrigo approves.

## Gotchas for the next session

- One-shot keys: event-driven `keydown-X`, never `JustDown` polling (CLAUDE.md hard rule).
- All gameplay timing on `GameScene.runTime` — never `time`/`performance.now()`.
- Playwright + pause: level-up modals freeze measurements; set `run.xpNeeded = 1e9` and
  long i-frames before movement assertions.
- Title/Pause global pointerdown vs buttons: object handlers fire first — call
  `event.stopPropagation()` in the button handler.
