# Setup review — how Rodrigo's CC environment shaped the GRAVEHORDE one-shot

_Written by Claude (Fable 5) after the 2026-06-11 build, at Rodrigo's request. Each
proposal follows the self-improvement rule: suggested here, implemented only on consent._

## Verdict in one paragraph

The setup was a clear net positive, but not where you might expect. The model does the
heavy lifting either way — a fresh default install would also have shipped a working game.
What the setup actually bought: **zero deliberation on stack** (rules+skills made Phaser 3
+ TS + Vite overdetermined), **conservative version choices that de-risked the one-shot**
(Phaser 3.90/Vite 7/TS 5.9 instead of the tempting 4.1/8/6), **an autonomy posture that
eliminated ~6–8 would-be confirmation stops** (FABLE.md + your pre-authorization), and
**continuity artifacts** (docs gates + memory) that a default install simply wouldn't have
produced. Estimated savings: ~20–30 min of wall clock and several risk points.

## What pulled real weight (keep as-is)

| Piece | Effect during this build |
| --- | --- |
| `ccf` + `FABLE.md` autonomy posture | "Gates hard, ritual as guidance" is exactly right for one-shots; the explicit "ask once at start, never mid-run" framing shaped the whole session. |
| `~/.claude/rules/phaser.md` + `phaser-game` skill | Scaffold pattern (Boot→Title→Game, pooling, config module, browser verify) adopted wholesale. Stack decision took ~0 tokens of deliberation. |
| Docs gates (TODO/decisions/HANDOFF/NEEDS-YOU) | The project is resumable by any future session. A default install leaves a repo with no narrative. |
| "Subagents on cheaper models" (FABLE.md) | The Sonnet asset-research agent ran in parallel with scaffolding — found+verified all CC0 URLs for 24k tokens while the main loop kept building. |
| Memory directory | The Phaser `JustDown` engine gotcha is now permanent knowledge; it cost 25 min once and never again. |
| Version-conservatism rules | "Current stable, verify installed versions" steered away from Phaser 4.1 / Vite 8 / TS 6 — any of which could have burned an hour on a one-shot. |

## Friction found (worth fixing)

### 1. PowerShell deny rule vs. environment header — 🔴 the only real trap
The session environment declares "Shell: PowerShell (use PowerShell syntax)" but a User
Deny Rule blocks PowerShell commands. My first two commands burned on permission denials
before I switched to POSIX. It's in my memory now, but memory is per-project-directory —
**a global line fixes it everywhere**. Proposal, add to `~/.claude/CLAUDE.md` (How you work):

> - Shell commands: always POSIX/bash syntax in the Bash tool (Git Bash). PowerShell is
>   deny-listed on this machine despite what the environment header says.

### 2. STEP 0 "WAIT" vs. fully pre-authorized prompts
`startup-web-dev.md` mandates showing a confirmation line and **waiting**. Your prompt
explicitly pre-authorized everything, so I overrode the wait (correctly, but it required
judgment that a stricter model-day might not exercise). Proposal, amend STEP 0:

> …and **WAIT for my go or correction** — *unless the prompt itself explicitly
> pre-authorizes one-shot/autonomous execution, in which case show the line and proceed.*

### 3. `bootstrap`-first vs. specialist skills on greenfield
The protocol says "no AI scaffolding yet → run `bootstrap` first". For a brand-new game,
`phaser-game` + manually created docs was strictly better (bootstrap would have produced
generic web-project scaffolding). Proposal, amend that line:

> If the project has no AI scaffolding yet, use `bootstrap` — or, when a specialist skill
> (phaser-game, unity-game, wordpress-task) covers the project type, let it drive and
> create the standard docs set directly.

### 4. `context7` wasn't the right tool for the engine bug — codify the alternative
The pause-key bug was solved by **reading the installed package source**
(`node_modules/phaser/src/...Key.js`), which beats doc lookup for behavior questions
(docs describe intent; source shows what actually happens). Proposal, add to
`~/.claude/rules/phaser.md` (or the global toolkit section):

> - Debugging engine behavior (not API shape): grep the installed source in
>   `node_modules/` before reaching for context7/web — the installed version is ground truth.

## Additions worth making (new capability, not fixes)

### 5. Playtest-bot pattern → `phaser-game` skill
The highest-leverage technique invented this session: expose `window.__game` + a movement
override hook, then drive an autonomous threat-avoidance bot via Playwright `evaluate` to
play the real difficulty curve while logging hp/level/fps. It turned balance from vibes
into data (the knockback-donut and i-frame findings came from it). Proposal: add a bullet
to `phaser-game`'s Verify step:

> For balance/difficulty verification, install test hooks (game handle + input override on
> `window`), then drive an autonomous bot via Playwright evaluate: threat-repulsion +
> pickup-attraction steering, auto-accept UI modals, sample stats every few seconds.
> Pattern reference: fable-bullet-heaven `docs/decisions.md`.

### 6. CC0 asset sourcing + licensing record → `phaser-game` skill
I improvised the Kenney/OpenGameArt/Google-Fonts pipeline and the CREDITS.md convention.
Worth one bullet so every game project does the same:

> Assets: prefer CC0 (kenney.nl, opengameart.org) + OFL fonts (google/fonts repo, raw
> URLs are curl-able). Record every asset in CREDITS.md (source, author, license) as you
> add it; verify download URLs with a cheap subagent before scripting them.

### 7. GH Pages deploy recipe → `phaser-game` skill (optional)
The `vite base:'./'` + actions workflow + `gh api .../pages -f build_type=workflow` combo
is reusable boilerplate. Low value (I can rewrite it from memory), but it'd save ~5 min
per project. Could live as a snippet in the skill folder.

## What I'd NOT change

- Don't add more prescriptive step-by-step to the skills — FABLE.md's own warning
  ("skills developed for prior models are often too prescriptive") proved out; the loose
  checklists were the right altitude.
- The git policy (branch + commit green + ask-before-push) needed zero modification —
  your prompt's explicit push grant slotted into it cleanly, which is how an override
  should work.
- Plan Mode being skippable for well-specified work (FABLE.md) was correct here; a plan
  round-trip would have added nothing the todo list didn't.

## Counterfactual: fresh default install

Same game, probably — but: Phaser 4.1/Vite 8 risk (newest-by-default instinct), several
permission stops on `gh repo create`/push/install, no docs/memory continuity, balance
verified only by stress tests rather than a bot playing the real curve (the bot idea
came from "verify with real checks" culture + the `__ghMove` hook being natural under
your verify-in-browser rule), and likely an ask-back or two mid-run. Net: the setup
didn't change *what* got built; it changed *how reliably* and *how continuable*.
