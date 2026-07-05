# Supabase integration plan

Status: **planned, not yet implemented.** Auth and saves are currently 100%
mock (`src/lib/auth.ts` persists to `localStorage`). This document is the agreed
design to revisit when the Supabase phase starts. Nothing here should touch the
deterministic engine (`src/components/Reino/engine.ts`).

## Auth

- **Accounts are mandatory to play — there is no guest mode.** (`AuthProvider` is
  `'email' | 'google' | 'apple'`.)
- Backend/auth is **Supabase** (GoTrue). It natively supports the three planned
  flows: email/password (`signUp` / `signInWithPassword`), Google and Apple
  (`signInWithOAuth({ provider })`).
- **Apple caveat:** requires a paid Apple Developer account (~US$99/yr) plus the
  "Sign in with Apple" setup (Service ID, key). Google is free via the Google
  Cloud Console. Flag this before committing to the Apple button.
- **Migration path:** the current mock (`src/lib/auth.ts` + `Login`) already
  exposes a store shaped like real auth (`useAuth` / `signIn` / `signOut`).
  Replace `signIn`/`signOut` with `supabase.auth.*` and swap the `localStorage`
  read for `supabase.auth.onAuthStateChange(...)`. It maps 1:1.
- Purpose: bind saves to a user account (see below).

## Save sync

The goal: keep the Supabase save current **without hammering the backend**.

### Principle — local-first

`localStorage` stays the real-time source of truth during play (keep the current
~1/s local autosave). Supabase is the durable sync layer, written infrequently
and at key moments — **never per game tick**.

### Why this is cheap — determinism

Game state is a pure function of `startedAt` + `steps` + player decisions, and
the engine already does wall-clock catch-up on return. So idle progress (the
number going up) is **reconstructable from the timestamp** and never needs to be
synced. Only persist:

- the **anchor** (`startedAt`), and
- the **irreversible player decisions** (generator purchases, mode changes,
  future prestige).

The sync trigger becomes *"did the player make a non-recomputable decision?"*,
not *"how often do I push the number?"*.

### Write cadence to Supabase

Dirty-flag + throttle + flush on events:

1. Mark **dirty** on any player decision.
2. **Throttle**: one `upsert` every ~30–60s, and only if dirty.
3. **Debounce bursts**: buying 20 generators in 5s = one `upsert`, not 20.
4. **Flush** on `visibilitychange` (hidden), `beforeunload`, logout, and slot
   switch. Use `fetch(..., { keepalive: true })` for the final flush, but do not
   depend on it.

Result: a few writes per minute while active, zero while idle — trivial load,
fine on the free tier.

### localStorage as an outbox (robustness)

Treat `localStorage` as the outbox. A background loop pushes localStorage →
Supabase on the cadence above. If an unload write fails (network drop, killed
`beforeunload`), the next session compares local vs server and pushes if local is
ahead — nothing is lost.

### Conflict / multi-device

- One row per `(user_id, slot_id)`, with **RLS** so each user only reads/writes
  their own rows.
- Store a monotonic counter (total `steps` or a `version` / `updated_at`).
- On load, keep the more-advanced state (guarded last-write-wins). The server is
  authoritative for fair ranking anyway.

### Realtime (optional)

Supabase Realtime (row subscription) only if live cross-device sync is wanted —
it reflects changes, it is not needed for durability. The cadence above covers
the single-session case.

### Implementation shape

Encapsulate all of this in a new `src/lib/sync.ts` layer sitting between the
current `storage.ts` and Supabase. **Do not touch the deterministic engine.**
