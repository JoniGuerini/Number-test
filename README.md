# Number Test

An idle-game mechanics laboratory dressed as a medieval kingdom: giant-number
formatting with [break_eternity.js](https://github.com/Patashu/break_eternity.js),
a chained batch-production economy, data-driven balancing and deterministic
simulation so that scores are reproducible bit-for-bit across devices — the
foundation for a fair, backend-less ranking.

English is the project's canonical language (docs, code, commit messages).
The UI ships in English, Brazilian Portuguese and Spanish — see
**Internationalization** below.

## The tabs

- **Kingdom** (`Reino`) — the game itself: a data-driven production chain.
  Generator N produces the generator below it; generator 1 produces the base
  resource (the chain's currency), which in turn buys more generators. On first
  visit you pick a **game mode** — *Manual* (you make every purchase) or
  *Automatic* (the game buys the highest-tier generator it can afford, either
  unlocking the next one or stacking the highest you own — handy for balance
  testing). Five lines are planned; only **Food** (Wheat → Peasant, Mill,
  Granary … Empire, Dynasty; 20 generators) is enabled today — Mining,
  Exploration, Military and Medicine are "coming soon" placeholders.
- **Activity** — the unlock log for the current save: a summary header (total
  unlocks, play time, average interval) and every generator's timing, with pace
  color-coded against the previous unlock (slower in red, faster in green).
- **Social** (`Chat`) — a mock chat previewing the ranked multiplayer to come:
  Global / Ranked / Clan channels, direct messages, a friends list and player
  profiles. Fully mock — nothing talks to a network.
- **Leaderboard** — a mock prosperity ranking: Global / Friends / Clan tabs,
  seasons, tiered badges (Bronze → Master) and your own row pinned when you fall
  outside the visible window. Also mock.
- **Patch notes** — the project's version history.
- **Settings** — a modal (not a page) with tabbed configuration: save slots
  (create / load / rename / delete, plus per-mode resets), color themes,
  button-click volume (Web Audio synthesized press/release pair), video/telemetry
  toggles and UI language.

## The economy

Production is **cyclic (batch)** rather than continuous. Each generator runs a
timer and, when its cycle completes, delivers its whole batch to the level below
at once. Cycle length grows geometrically (`2s × 3^(N-1)` → 2s, 6s, 18s, 54s…)
while per-cycle delivery grows only arithmetically (`0.3 + 0.1·N`). Because the
cycle triples but the payout only adds a little, the effective rate per second
falls sharply for deeper generators — a deliberately slow, studied progression.

Generator costs follow `10^(1.36·i + 0.04·i²)` (so the first generator always
costs 1 and the game can start), with a per-purchase markup of `(10 + 2·i)%` on
top, so stacking the same generator gradually gets more expensive. See
`src/components/Reino/engine.ts` for the authoritative implementation.

## Simulation architecture

- **Deterministic fixed timestep**: the game advances in 0.25s steps anchored to
  the save's start timestamp. State is a pure function of the step count — two
  machines with saves started together stay bit-for-bit identical, whether the
  tab is open, hidden or closed. This is what makes a fair, server-less ranking
  possible.
- **Wall-clock catch-up**: closing/reloading loses no time; the game simulates
  the pending steps on return (offline progress included).
- **Visual extrapolation**: the logic runs at 4 steps/s, but the display moves
  every frame by interpolating with current production.
- **List virtualization**: cards outside the scroll window (and on hidden tabs)
  become same-height ghosts — lists with hundreds of generators keep the frame
  rate at the monitor's cap.

## Save slots

Classic game-style save management: each slot holds the full game state, stored
under its own `localStorage` keys. Creating, renaming, loading and deleting slots
never touches the simulation engine — slots only decide **which** keys are
read/written, so deterministic sync stays intact.

## Internationalization

A lightweight typed i18n module (`src/lib/locale/`): per-locale dictionaries with
compile-time-checked keys, a `useSyncExternalStore`-based hook so the whole app
re-renders instantly on language change, and locale-aware dates and numbers.
Available languages: English, Português (Brasil) and Español — auto-detected from
the OS/browser language on first visit. The choice is persisted per device;
patch notes stay in the language they were written in.

## Telemetry and utilities

- Pills for FPS, frame time (avg/max), environment (localhost/production),
  battery (when present), memory, DOM nodes and app version, with a **new version
  pending** notice via a `version.json` published on every build.
- Per-tab CSV export (raw + formatted values) for balance analysis.
- Saves in `localStorage` (origin-isolated), autosaved once per second and on
  page close. Wake lock keeps the screen awake during play.

## Running

```bash
npm install
npm run dev
```

Balance study script (Node): `node scripts/simulate-reino.mjs` mirrors the Food
line's engine exactly to tune its cost and cycle curves.

## Stack

- Vite 5 + React 18 + TypeScript
- break_eternity.js for the numbers
- CSS Modules + global tokens (`src/styles/`)
- No backend: fully static

## Deploy (Vercel)

Vercel auto-detects the project as Vite (build `npm run build`, output `dist`).
Every push to `main` deploys — the build timestamp injected via `define` feeds
the version pill and the pending-update detection.
