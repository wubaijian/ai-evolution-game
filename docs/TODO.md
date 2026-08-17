# TODO

## Done (2026-06-11 one-shot build)

- [x] Scaffold Vite + TS + Phaser 3.90, repo `mukstoo/fable-bullet-heaven`
- [x] CC0 assets researched, downloaded, licensed (CREDITS.md)
- [x] Core loop: movement, camera, infinite scrolling graveyard, decor recycling
- [x] 6 weapons (5 levels each), 8 passives, 4+4 build limits
- [x] 7 enemy types + elites + 3 bosses with distinct brains
- [x] Wave timeline + scripted events (rings, swarms, elites, bosses)
- [x] XP gems, magnet, level-up 3-card UI (mouse + keyboard)
- [x] Pickups: heal, magnet-vacuum, gold, boss chests
- [x] Juice: damage numbers, particles, knockback, flashes, shake, announcements
- [x] Audio: 25 SFX + 2 music tracks, mute persistence
- [x] Scenes: Boot/Title/Game/Hud/LevelUp/Pause/GameOver(+victory)
- [x] localStorage save (best time/kills/wins/runs, mute)
- [x] Browser-verified end-to-end via Playwright (incl. full-curve bot run)
- [x] GH Pages deploy workflow + live URL
- [x] Pause-key fix (event-driven one-shot inputs)

## Done (2026-06-11 evening session)

- [x] Meta progression: Crypt Shop — gold banks to the save, 8 permanent upgrades
      (`src/data/meta.ts`), once-per-run Gravewalker revive, Title/GameOver entries
- [x] Weapon evolutions: maxed weapon + matching passive + boss chest → level-6 evolved
      form (all 6 weapons), eligibility hint, HUD `E` marker, evolved visuals
- [x] Treasure goblin: Tomb Mimic at 2:30 / 7:00 / 9:30 — flees with panicky wobble,
      harmless, bursts into 12–18 coins if caught, escapes after 10s (or past the leash)
- [x] Master volume control: persisted 0–100% in 10% steps — pause menu row
      ([<]/[>] clickable + arrow keys) and title screen ([,]/[.] or arrows)
- [x] Pause build list shows evolved weapon names ("Soulfire Barrage (EVOLVED)")

## Next session candidates

- [ ] 2nd/3rd playable character (different starting weapon + stat spread)
- [ ] Touch controls (virtual joystick) for mobile
- [ ] Damage-type variety: DoT/burn, slow, crits
- [ ] Shop balance pass once a human has played a few runs (cost curve is a guess:
      ~1550 gold total, earn rate ~50–120/run)
- [ ] itch.io publishing alongside Pages
