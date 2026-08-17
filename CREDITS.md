# Credits & asset licensing

All third-party assets in this project are CC0 (public domain) or OFL-licensed.
Nothing here requires attribution by license — credits are given anyway, gladly.

| Asset | Source | Author | License |
| --- | --- | --- | --- |
| `public/assets/sprites/tilemap_packed.png` (Tiny Dungeon) | [kenney.nl/assets/tiny-dungeon](https://kenney.nl/assets/tiny-dungeon) | Kenney | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `public/assets/audio/sfx/*` (selected from Impact Sounds, Interface Sounds, Digital Audio) | [kenney.nl/assets](https://kenney.nl/assets) | Kenney | CC0 |
| `public/assets/audio/music_battle.mp3` ("Battle Theme A") | [opengameart.org/content/battle-theme-a](https://opengameart.org/content/battle-theme-a) | cynicmusic — [cynicmusic.com](https://cynicmusic.com) / [pixelsphere.org](https://pixelsphere.org) | CC0 |
| `public/assets/audio/music_title.mp3` ("Town Theme RPG") | [opengameart.org/content/town-theme-rpg](https://opengameart.org/content/town-theme-rpg) | cynicmusic — cynicmusic.com / pixelsphere.org | CC0 |
| `public/assets/fonts/PressStart2P-Regular.ttf` | [fonts.google.com/specimen/Press+Start+2P](https://fonts.google.com/specimen/Press+Start+2P) | CodeMan38 (Cody Boisclair) | [SIL OFL 1.1](https://openfontlicense.org/) |
| Everything else (code, generated glow/FX textures, ground composite, icons) | this repo | built one-shot by Claude (Fable 5) | MIT |

## Notes

- The SFX files in `public/assets/audio/sfx/` were renamed from the original
  Kenney pack filenames to semantic names (`hit_0.ogg`, `levelup.ogg`, …).
  Original packs: Impact Sounds, Interface Sounds, Digital Audio.
- The OFL font is embedded as a file and loaded via `@font-face`/FontFace API,
  which the OFL explicitly permits. The font itself remains under OFL.
- CC0 assets require no attribution; cynicmusic kindly asks for a link, which
  the title screen and this file provide.
