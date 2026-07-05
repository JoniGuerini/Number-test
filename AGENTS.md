# Number Test — agent & contributor guide

Number Test is an idle/incremental game (Vite + React + TypeScript,
break_eternity.js) themed as a medieval kingdom. Fully static, no backend yet;
auth and saves will move to Supabase — see [docs/supabase-integration.md](docs/supabase-integration.md).

This file is the entry point for any AI/coding tool (Claude Code, Cursor, …).
The detailed, always-on rules live in `.cursor/rules/` and apply regardless of
tool — read them:

- **`.cursor/rules/determinismo-do-motor.mdc`** — the engine is a deterministic,
  bit-for-bit simulation (state = pure function of fixed steps anchored to
  `startedAt`). Never break it: no `Date.now()`/`Math.random()`/FPS/locale in
  game logic. This underpins offline catch-up and fair multiplayer ranking.
- **`.cursor/rules/language-convention.mdc`** — English is canonical (code,
  docs, comments, commits, patch notes). UI ships in pt-BR / en / es via
  `src/lib/locale/` (`pt.ts` defines the key set; others are compile-checked).
  Never hardcode user-visible text.
- **`.cursor/rules/versioning.mdc`** — `vMAJOR.MINOR.PATCH`, WoW-style. PATCH =
  fixes / QoL / refinements to existing features; MINOR = genuinely new content
  or mechanic; MAJOR = expansion (1.0 only when the user explicitly says so).
  Keep `package.json` `version` and the top entry of `src/data/changelog.ts` in
  sync on every release.

## Workflow

- **Patch-notes ritual:** when work that ships a *player-facing* change is
  complete, propose the patch note first — version (per `versioning.mdc`) +
  title + one-line summary + `major` / `minor` / `qol` / `fixes` — and only
  commit/push after the user approves. Internal-only changes (docs, tooling,
  refactors with no player-facing effect) do **not** get a patch note. Patch
  notes are English and player-facing.
- **Git:** push directly to `main` (no PRs). The `.claude/` folder is local
  tooling and is gitignored.
- **Conversation** with the user happens in Portuguese; everything committed to
  the repo is in English.

## Where things are

- `src/components/Reino/` — the game itself: `engine.ts` (deterministic engine),
  production lines. `scripts/simulate-reino.mjs` mirrors the engine for balance
  tuning — update it whenever you touch the engine.
- `src/components/{Login,Leaderboard,Chat,Settings,Activity,PatchNotes}/` —
  pages/features. Login, Leaderboard and Social (Chat) are 100% mock previews of
  the future multiplayer; Settings holds the Profile tab and save slots.
- `src/lib/` — `auth.ts` (mock auth store), `storage.ts` (save slots),
  `locale/` (i18n), `prefs.ts` (themes/telemetry), `sound.ts`.
- `src/data/changelog.ts` — the patch notes (version history).
- `src/styles/` — global tokens and shared skeletons.
- `docs/` — design notes (e.g. the Supabase integration plan).
