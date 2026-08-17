# GRAVEHORDE — project instructions

A complete, playable bullet-heaven (survivors-like) built with **Phaser 3.90 + TypeScript (strict) + Vite 7**.
Deployed to GitHub Pages from `main` via Actions. Repo: `mukstoo/fable-bullet-heaven`.

## Commands

- `npm run dev` — dev server (auto-picks a port if 5173 busy)
- `npm run build` — `tsc --noEmit` + `vite build` (both must stay green)
- `npm run typecheck` — types only

## Hard rules

- **All balance lives in `src/config.ts` and `src/data/*`** — never scatter magic numbers
  into scenes/systems. New weapons/enemies/passives = new data entries + a behavior switch.
- **Pool everything that spawns repeatedly.** Enemies/projectiles/gems/damage-texts come
  from pools; use `enableBody/disableBody`, never create/destroy per spawn.
- **Use `GameScene.runTime` for ALL gameplay timing** (cooldowns, lifespans, gates).
  Never `time`/`performance.now()` for gameplay — they keep running while paused.
- **One-shot keys must be event-driven** (`keyboard.on('keydown-X')`), not
  `JustDown` polling: Phaser wipes the JustDown latch when keydown+keyup land in the
  same input flush (fast taps), so polling drops inputs.
- Asset additions must be CC0/OFL and recorded in `CREDITS.md` with source + author.
- `window.__gravehorde` (game handle) and `window.__ghMove` (movement override) are
  intentional test hooks used by automated Playwright playtests — keep them.

## Sprite map

Character/tile sprites come from one spritesheet (`tiles` key, 16×16, 12 cols).
Frame indices are centralized in `src/data/frames.ts` — never hardcode frame numbers.

## Verifying changes

Playwright against the dev server; expose state via `window.__gravehorde`.
There's an autonomous playtest bot pattern in `docs/decisions.md` (threat-avoidance +
gem-seeking via `__ghMove`) — use it to test balance changes across the full 12-minute curve.
