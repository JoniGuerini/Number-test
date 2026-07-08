/** Notas de patch exibidas na aba Notas — a história do laboratório.

    Cada versão é organizada em um resumo (summary) + seções por categoria:
    - major: grandes funcionalidades / mudanças de destaque
    - minor: funcionalidades menores e mudanças notáveis
    - qol:   qualidade de vida e polimento
    - fixes: correções de bugs

    Entradas até a v0.12.0 permanecem em português; a partir da v0.12.1 o
    inglês é a língua canônica do projeto (as notas antigas ficam no idioma
    original, como documentos históricos que são). */

export interface PatchNote {
  version: string;
  date: string;
  /** Hora do patch (HH:MM). Não dá para recuperar retroativamente, então as
      entradas antigas não têm — a UI mostra "—" no lugar. */
  time?: string;
  title: string;
  /** Uma linha que resume o patch. */
  summary: string;
  /** Grandes funcionalidades / mudanças de destaque. */
  major?: string[];
  /** Funcionalidades menores e mudanças notáveis. */
  minor?: string[];
  /** Qualidade de vida e polimento. */
  qol?: string[];
  /** Correções de bugs. */
  fixes?: string[];
}

/** Da mais recente para a mais antiga. */
export const CHANGELOG: PatchNote[] = [
  {
    version: 'v0.25.0',
    date: '07/07/2026',
    time: '23:44',
    title: 'True tempo',
    summary: 'Fast cycles now truly cuts 10% of the current cycle time per level, the kingdom\u2019s state lives in a single store, and the numbers you watch tick at 60fps.',
    major: [
      'Fast cycles reworked: each level now cuts 10% of the CURRENT cycle time (2s \u2192 1.8s \u2192 1.62s\u2026, compounding) instead of adding a flat speed bonus whose marginal gain shrank to almost nothing at high levels. Late levels now match the doubling price \u2014 exponential cost, exponential benefit.',
      'Cycle times have a hard floor of 0.1s. When a generator reaches it, its Fast cycles research locks at max level: the button reads "Max level" and the effect shows "cycle 0.1s (minimum)".',
      'The kingdom\u2019s live state moved into a single game store (Zustand): Production, Research and Activity all read the same in-memory state, and the save file went back to being just persistence. The simulation also runs on its own now \u2014 it keeps advancing no matter which screen is open.',
    ],
    minor: [
      'The base resource counter is now a live odometer: it ticks at 60fps with extra precision (13.145M instead of a frozen 13.1M), replaying the engine\u2019s exact deliveries between simulation steps.',
      'The cycle countdown on generator cards updates at 60fps with two fixed decimals ("0.50s"), truncated like a stopwatch.',
      'Research and Activity now refresh with every simulation step (4\u00d7/s) instead of once per second \u2014 buying research reflects in the kingdom instantly, with no event glue in between.',
    ],
    qol: [
      'Sub-second durations show up to two decimals ("0.53s") wherever cycle times are displayed, so each Fast cycles level visibly moves the number.',
    ],
    fixes: [
      'Cycle bars no longer freeze at 100% waiting for the delivery: the engine now accumulates fractional cycle progress and carries the remainder over, so bars flow continuously and deliveries land exactly when the bar fills.',
      'Button sounds no longer vanish when clicking rapidly: the sound of a successful purchase was being evaluated AFTER React disabled the button it had just bought with (bubble-phase listener), so the click that worked stayed mute. The sound now fires on the capture phase, and multi-touch taps each track their own pointer.',
      'Button sounds also survive audio-context suspensions (tab hidden, output device change): the context is awaited on resume and recreated if it died.',
    ],
  },
  {
    version: 'v0.24.2',
    date: '07/07/2026',
    time: '15:49',
    title: 'Catch-up unstuck',
    summary: 'The offline catch-up loading bar now actually advances — it was rewinding its own progress every frame.',
    fixes: [
      'The catch-up loading screen stalled and never finished (the game only looked right after a page refresh): the simulation progress was kept out of React state during catch-up, but every render overwrites the sim anchor with that state — so each frame rewound the batch it had just processed. State is now applied on every batch; with the loading card replacing the generator list, those renders are cheap.',
    ],
  },
  {
    version: 'v0.24.1',
    date: '07/07/2026',
    time: '15:44',
    title: 'A calmer homecoming',
    summary: 'Coming back after time offline now shows a loading screen while the kingdom catches up.',
    qol: [
      'Returning from a long offline period (roughly 17+ minutes) no longer floods the Production screen with flickering numbers and cascading unlocks: a loading card ("Updating the kingdom") shows the offline time being processed with a progress bar, and the normal screen only appears once everything is settled.',
      'While catching up, the heavy UI stops re-rendering entirely — which also makes the catch-up itself finish faster.',
    ],
  },
  {
    version: 'v0.24.0',
    date: '07/07/2026',
    time: '12:14',
    title: 'The great repricing',
    summary: 'The kingdom\u2019s economy got a full rebalance: generator unlocks are much steeper and research prices were rebuilt from the ground up.',
    major: [
      'Generator unlock costs are far steeper on all five lines. Food now climbs 1 \u2192 40 \u2192 2,000 \u2192 126K \u2192 10M\u2026 (it used to be 1 \u2192 25 \u2192 759 \u2192 27.5K), and the deeper lines (Mining, Exploration, Military, Medicine) keep their relative weight on top of the new curve. Repeat purchases of the same generator stay at a flat +10%.',
      'Research prices were rebuilt: every generator\u2019s five upgrades share a single price ladder tied to the new unlock curve \u2014 200 for the first generator, 8K for the second, 400K, 25M, 2B\u2026 \u2014 identical across all five lines, each paying in its own base resource. Every level bought doubles the price (it was +12%, which made late-game research cost pocket change).',
    ],
    minor: [
      'Global research now starts at 1,000 of EACH base resource and doubles per level, keeping its premium as the upgrade that touches everything.',
    ],
    qol: [
      'Research prices are rounded to two significant digits, so the ladder reads clean in the buttons: 400K instead of 399K, 25M instead of 25.1M.',
    ],
  },
  {
    version: 'v0.23.5',
    date: '06/07/2026',
    time: '22:35',
    title: 'The top row takes over',
    summary: 'Social, Leaderboard and Activity move to the top row — the footer keeps only the gameplay screens.',
    minor: [
      'Social, Leaderboard and Activity are now icon+text buttons in the top-right row, next to fullscreen and the Settings gear. The footer keeps just Production and Upgrades — the gameplay screens.',
      'Closing any top-row menu (including Patch notes) always returns to the last MAIN screen visited (Production/Upgrades), never to another top-row menu.',
      'Language cards now show each locale\u2019s flag as an SVG (emoji flags render differently across operating systems — on Windows they turn into plain letters).',
    ],
    qol: [
      'A thin separator now sits between the telemetry pills and the standard menus in the top row, and only shows when telemetry is visible.',
      'The save\u2019s stat cards in Settings → Saves got a proper layout: name field on top, start/time and per-line production in tidy grids, reset at the bottom.',
    ],
  },
  {
    version: 'v0.23.4',
    date: '06/07/2026',
    time: '21:55',
    title: 'A cleaner chrome',
    summary: 'Icons arrive in the UI chrome, Settings becomes a sidebar panel, and the top corners get a full reorganization.',
    minor: [
      'The interface chrome now uses icons (Lucide): each footer menu has one, Settings tabs got theirs, and the fullscreen toggle joined the same family. Generators and production-line tabs stay text-only by design.',
      'Settings turned into a proper panel: the tabs moved into a left sidebar, and the gear became an icon-only button in the top-right corner — freeing a menu slot in the footer.',
      'Patch notes left the footer: the version card in the top-left corner now opens them. While reading, the same card shows "← Back | version" and returns exactly where you were. When a new deploy is available it still turns into the reload notice.',
      'The save\u2019s vitals (start date, elapsed time and total produced per production line) moved from the production screen into Settings → Saves, shown when you expand a slot.',
    ],
    qol: [
      'Resetting a save is now a two-step flow: the button reads "Reset saved game" and swaps into a Reset/Cancel pair before anything is wiped.',
      'The fullscreen button moved next to the Settings gear in the top-right corner, and the telemetry row shifted to make room.',
      'Page content now aligns with the fixed top cards (frame padding 16px → 12px), gaining a little useful width.',
    ],
  },
  {
    version: 'v0.23.3',
    date: '06/07/2026',
    time: '20:30',
    title: 'Silky cycle bars',
    summary: 'Cycle bars glide without the 4×/s hitch, and the sim loop got a correctness fix.',
    qol: [
      'Build tooling upgraded to Vite 8, clearing the dev-server security advisories flagged by npm audit.',
    ],
    fixes: [
      'Cycle progress bars no longer freeze and jump 4 times per second: the between-steps interpolation was capped at the next unconfirmed sim step, so the bar stalled at each boundary waiting for React to commit. It now runs free on the wall clock and stays continuous when the state lands.',
      'The simulation advance was moved out of the React state updater. Updaters must be pure — in dev, StrictMode invokes them twice and the mandate accounting leaked between invocations, doubling the per-step cost and risking wrong mandate totals.',
    ],
  },
  {
    version: 'v0.23.2',
    date: '06/07/2026',
    time: '19:16',
    title: 'Sub-resources on the map',
    summary: 'Every line now displays its 10 future sub-resources — plus a smoother, lighter production screen.',
    qol: [
      'Each production line now shows a row of 10 sub-resource cards (Mining: Iron, Copper, Tin \u2026 Starstone; Food: Flour, Bread \u2026 Feast; and so on). They all sit at 0 for now — the mechanic that produces them arrives in a future update.',
      'Mining\u2019s base resource is now Coal (it was a generic Ore), making room for the rarer metals among its sub-resources.',
      'The main navigation tab is now called Production — that screen is the kingdom\u2019s production hub.',
      'The line tabs moved above the mandate and resource cards, so the cards always reflect the line you just picked.',
      'Performance pass on the production screen: the interface now only re-renders when the simulation advances (4\u00d7/s) while cycle bars keep animating at full 60fps on the GPU compositor — much lighter on CPU, especially with many generators unlocked.',
    ],
    fixes: [
      'Cycle progress bars no longer stutter on long cycles (most visible in Medicine) and no longer lose their rounded ends or texture at low progress.',
    ],
  },
  {
    version: 'v0.23.1',
    date: '06/07/2026',
    time: '18:10',
    title: 'Quieter telemetry',
    summary: 'The environment badge only shows on local dev builds now.',
    qol: [
      'The telemetry bar no longer displays a PRODUCTION pill on the live site — the environment badge is a dev-only aid and now only appears as "localhost" on local builds.',
    ],
  },
  {
    version: 'v0.23.0',
    date: '06/07/2026',
    time: '18:02',
    title: 'Research & Mandate',
    summary: 'The kingdom learns to research — and answers to a new universal resource.',
    major: [
      'Upgrades page: research improvements per generator or globally across every line — faster cycles, higher output, bonus resource chance and yield, and cheaper generator purchases. Global research costs the same amount of every resource; per-generator research costs the line\u2019s own resource.',
      'Mandate: a new kingdom-wide resource that accrues +1 per second from the moment the save starts. Every generator purchase now costs mandate on top of the line\u2019s resource (Food 1 \u2026 Medicine 5) — the deeper the line, the pricier the writ.',
      'Mandate exchanges: trade stored resources for permanent mandate income, +1/s per level with unlimited levels. Each line\u2019s exchange unlocks at 500 in stock and scales \u00d7100 per level (500 \u2192 50K \u2192 5M\u2026).',
    ],
    minor: [
      'Two resource cards now sit above the line tabs: your mandate balance (with its rate) and the active line\u2019s resource stock with production per second.',
    ],
    qol: [
      'Hold-to-repeat: press and hold any buy, research or exchange button to act in series until you release (or run out of funds).',
      'Exchange buttons fill up like unlock buttons, showing progress toward the required stock.',
    ],
  },
  {
    version: 'v0.22.9',
    date: '06/07/2026',
    time: '12:15',
    title: 'The simulation experiment ends',
    summary: 'The Simulated activity view is retired; Activity is back to your real unlock log.',
    qol: [
      'Removed the Simulated tab and its forecast data from Activity. The experiment taught us a lot about the economy\u2019s deep tiers, but the upcoming upgrade mechanics will reshape those curves anyway — the forecasts would go stale with every rebalance. Activity now shows just your real log, one tab per production line, as before.',
    ],
  },
  {
    version: 'v0.22.8',
    date: '06/07/2026',
    time: '10:24',
    title: 'Speed dial retired',
    summary: 'The dev speed card is gone — the deep simulation script covers that job better.',
    qol: [
      'Removed the 1×/10×/…/5000× speed card from the top bar. Fast-forwarding the live game is obsolete now that the simulation tooling answers "what unlocks when" directly (and feeds the Simulated activity tab). Saves accelerated earlier keep their progress — nothing changes in how the game runs.',
    ],
  },
  {
    version: 'v0.22.7',
    date: '06/07/2026',
    time: '10:17',
    title: 'The deep ledger',
    summary: 'The Simulated activity now covers a 1500-year horizon.',
    minor: [
      'The Simulated tab\u2019s forecast now reaches 1500 years of strict auto mode: Exploration completes its chain (g20 at ~313 years), Military reaches g18 and Medicine g15 — every time genuinely simulated step by step, no extrapolation.',
    ],
    fixes: [
      'The bundled simulation data had accidentally regressed to a 1-year horizon in an earlier release today; the Simulated tab shows the full ladders again.',
    ],
  },
  {
    version: 'v0.22.6',
    date: '06/07/2026',
    time: '09:43',
    title: 'Pedal to the floor',
    summary: 'The speed dial tops out at 5000× — the most the clock can actually deliver.',
    qol: [
      'A 5000× step joins the speed dial (1× → 10× → 100× → 1000× → 5000×): one game day every ~17 real seconds. It\u2019s deliberately the ceiling — beyond that the catch-up loop can\u2019t keep pace and the save would only pile up simulation debt.',
    ],
  },
  {
    version: 'v0.22.5',
    date: '06/07/2026',
    time: '09:34',
    title: 'Faster still',
    summary: 'The speed dial gains a 1000× step.',
    qol: [
      'The dev speed card now cycles through 1×, 10×, 100× and 1000×. At full tilt a game day passes in ~86 real seconds — best enjoyed with automatic mode on.',
    ],
  },
  {
    version: 'v0.22.4',
    date: '06/07/2026',
    time: '09:30',
    title: 'The speed dial',
    summary:
      'A dev speed card in the top bar cycles the game clock through 1×, 10× and 100×.',
    qol: [
      'New clickable card next to the telemetry pills: each click cycles the game clock through 1×, 10× and 100× (lit while accelerated). It speeds up time itself — generator cycles keep their full in-game duration, nothing is shortened — by dragging the save\u2019s time anchor backwards, so determinism and offline catch-up stay intact. Reloading the page returns to 1×. A development tool for this phase; it will not ship at launch.',
    ],
  },
  {
    version: 'v0.22.3',
    date: '06/07/2026',
    time: '05:04',
    title: 'Real vs. simulated activity',
    summary:
      'Activity gains Real and Simulated views — compare your unlock log against the deterministic auto-mode forecast.',
    minor: [
      'Two new views in Activity, above the line tabs: Real shows your save\u2019s unlock log as before, and Simulated shows the auto-mode forecast for every line — computed by stepping the actual engine math, so a save left on automatic will match it to the second.',
      'The simulated ladder covers a 100-year horizon and only shows genuinely simulated times, no extrapolation: Food completes its 20 generators in ~130 days and Mining in ~13 years, while Exploration reaches g18, Military g14 and Medicine g12 within the century.',
    ],
    qol: [
      'Durations longer than a day now read naturally across the app: "3d 07h", and beyond a year "2y 41d".',
    ],
  },
  {
    version: 'v0.22.2',
    date: '06/07/2026',
    time: '03:20',
    title: 'Activity covers every front',
    summary: 'The unlock log now has one tab per production line, not just Food.',
    qol: [
      'Activity gained line tabs (Food / Mining / Exploration / Military / Medicine), mirroring the Kingdom tabs: each one shows that front\u2019s unlock log with its own summary — unlocks, play time, average interval and time since the last one — so pace comparisons stay within the same chain.',
      'Switching tabs reads the save immediately and jumps to the latest entry; fronts with no unlocks yet show their own empty state with a shortcut to the Kingdom.',
    ],
  },
  {
    version: 'v0.22.1',
    date: '06/07/2026',
    time: '03:09',
    title: 'Each front pays its own price',
    summary:
      'Every production line now has its own price ladder, and repeat purchases cost a flat +10% everywhere.',
    minor: [
      'Prices now follow the same philosophy as the cycles — the deeper the front, the heavier the costs. The entry price of the second generator doubles per line (25 wheat, ~51 ore, 100 maps, ~202 troops, ~398 herbs) and the ladder steepens faster in deeper lines. The first generator of every front still costs 1, so all five start right away.',
      'Repeat purchases were simplified to a flat +10%: every extra unit of the same generator costs 10% more than the previous one, in every line and every tier. (It used to grow per tier in Food — deep generators are now cheaper to stack than before.)',
    ],
  },
  {
    version: 'v0.22.0',
    date: '06/07/2026',
    time: '02:32',
    title: 'The five fronts of the realm',
    summary:
      'Four new production lines are playable — Mining, Exploration, Military and Medicine — each with its own resource, 20 themed generators and its own pace.',
    major: [
      'Four new production lines join Food, completing the five fronts of the realm: Mining (Ore — Miner, Digger, Adit … Iron Throne), Exploration (Maps — Scout, Tracker, Explorer … Terra Incognita), Military (Troops — Recruit, Militia, Soldier … Crusade) and Medicine (Herbs — Herbalist, Healer, Herb Garden … Immortality). Each is a full 20-generator chain, playable today.',
      'Each front has its own economy: the first generator\u2019s cycle doubles from line to line (2s, 4s, 8s, 16s, 32s), the cycle growth per tier rises (\u00d73, \u00d74, \u00d75, \u00d76, \u00d77) and the base delivery climbs (0.3 to 0.7). Deeper fronts are slower and heavier — the cost curve is the same for all.',
      'Starting a save now starts the whole realm: one mode choice (Manual/Automatic) and one Start press launch all five fronts at once, anchored to the same instant. The mode applies to every line — and Automatic remains a development tool, not a launch feature.',
    ],
    minor: [
      'Exploration is a brand-new front in the planned line-up, and the tabs now read Food / Mining / Exploration / Military / Medicine.',
    ],
  },
  {
    version: 'v0.21.0',
    date: '06/07/2026',
    time: '01:44',
    title: 'The 20-generator kingdom',
    summary:
      'The Food chain is renamed and grown from 12 to 20 generators, plus a card-based leaderboard.',
    major: [
      'The Food production chain is renamed and expanded from 12 to 20 generators, with a coherent wheat-to-realm theme. It now starts with the Peasant (who works the wheat), then the Mill, Granary, Cropfield, Farmstead, Market, Guild, Hamlet, Village, Borough, Fief, Shire, Citadel, City, Metropolis, Province, Principality, Kingdom, Empire and finally the Dynasty. No more out-of-place nobility titles producing wheat — every tier now reads as a step in growing the realm, and the eight new deep tiers stand as long-term goals.',
    ],
    qol: [
      'Leaderboard redesign: each player now gets their own card instead of a table row — position and daily change on the left, name, rank and clan in the middle, top generator and wheat/s as labelled stats, and prosperity highlighted on the right.',
      'Calmer look across the ranking: dropped the coloured card borders in favour of the app\u2019s paper-and-ink aesthetic, where hierarchy comes from weight and spacing rather than colour.',
    ],
    fixes: [
      'Fixed a harsh gradient band at the top and bottom of the ranking list — the scroll fades now blend into the page background like the game\u2019s other lists.',
    ],
  },
  {
    version: 'v0.20.0',
    date: '05/07/2026',
    time: '03:17',
    title: 'Login & profile preview',
    summary:
      'A mock sign-in gate and a profile tab, groundwork for binding saves to an account.',
    major: [
      'New login screen (100% mock): the app now opens on a sign-in gate — Sign in / Create account tabs with email and password, plus Google and Apple providers. Any submit "authenticates" and enters the game, and the choice is remembered so you land straight in your Kingdom next time. First step toward tying saves to a user account.',
    ],
    minor: [
      'New Profile tab in Settings (now the default tab): shows the signed-in user — name, rank and email — plus your Kingdom stats (ranking, prosperity, wheat/s, top generator, generators, clan and the season you started playing). "Sign out" lives here.',
    ],
    qol: [
      'The Settings modal is now a wider, taller panel instead of a square, giving the tabs and content more room to breathe.',
      'Leaderboard columns now spread evenly across the full width — the numeric columns (wheat, prosperity) flex too, instead of being clamped to the right edge.',
      'Portuguese footer: "Config" is now spelled out as "Configurações", matching the other unabbreviated tabs.',
    ],
    fixes: [
      'Signing out from within Settings no longer leaves the Config modal open on the next login — you now enter straight into the Kingdom screen.',
      'Login inputs keep the dark theme when the browser autofills a saved suggestion, instead of flashing the default blue background.',
    ],
  },
  {
    version: 'v0.19.1',
    date: '05/07/2026',
    time: '02:05',
    title: 'Leaderboard column balance',
    summary: 'The ranking table distributes its columns evenly on wide screens.',
    qol: [
      'Player, clan and generator columns now share the extra width proportionally — no more giant gap after the player name — and the position column sits closer to the card edge.',
    ],
  },
  {
    version: 'v0.19.0',
    date: '05/07/2026',
    time: '01:40',
    title: 'Leaderboard preview',
    summary:
      'A mock leaderboard joins the nav: season top 100 by prosperity, with friends and clan views.',
    major: [
      'New Leaderboard page (100% mock): the season ranking by prosperity. Top 100 with podium medals, daily position change (▲/▼), each player\'s rank, clan, highest generator and wheat/s — same cast as the Social preview.',
      'Global, Friends and Clan tabs; outside the top 100 your own row stays pinned at the bottom of the card so you always see where you stand.',
    ],
    qol: [
      'Rank badge colors moved to a shared stylesheet used by both Social and the Leaderboard (single source of truth).',
    ],
  },
  {
    version: 'v0.18.1',
    date: '05/07/2026',
    time: '01:10',
    title: 'Cleanup after the retirement',
    summary:
      'Sweeps away every leftover from the retired modes — smaller, tidier codebase.',
    qol: [
      'Activity lost its single-tab header: with Kingdom as the only mode, the log now opens straight into the summary and entries.',
    ],
    fixes: [
      'Removed orphaned translation strings, styles and tuning scripts that only served Generators and Cycles, plus stale comments that still referred to them.',
    ],
  },
  {
    version: 'v0.18.0',
    date: '05/07/2026',
    time: '00:55',
    title: 'Focus on Kingdom',
    summary:
      'Cycles and Generators retire so the app can center entirely on Kingdom.',
    major: [
      'The Generators and Cycles modes have been retired to focus development on Kingdom. Nothing is lost: their code lives on in the project history (tagged snapshot) and can be brought back at any time.',
      'The footer navigation is leaner now — Kingdom, Activity, Social and Patch notes — leaving room for what comes next.',
    ],
    qol: [
      'Activity now tracks Kingdom only; the shared list styling was kept intact.',
      'Existing Generators/Cycles saves are left untouched in storage — just no longer shown.',
    ],
  },
  {
    version: 'v0.17.0',
    date: '05/07/2026',
    time: '00:40',
    title: 'Social — chat preview',
    summary:
      'A rich preview of the upcoming multiplayer chat, with friends, ranking and profiles.',
    major: [
      'New Social page (100% mock, for now): a preview of the future multiplayer chat. Public channels (Global, Ranked, Clan) and 1:1 direct messages, with rank-colored names and system events like rank-ups.',
      'Friends: a friends list sits next to the online players, each with an online/offline status. Right-click any player — in Online, Friends or the DM list — for options: view profile, open chat, add/remove friend and delete conversation.',
      'Player profile modal: ranking position, prosperity, wheat/s, top generator, generators unlocked, clan and the season they started playing.',
    ],
    minor: [
      'Mentions: @-autocomplete while you type, highlighted mentions inside messages, and a persistent "jump to mention" card that jumps to the first message that mentioned you — shown only while that message is off-screen.',
      'Unread counters for DMs and per-channel mention counts; your own messages align to the right, chat-app style.',
    ],
    qol: [
      'Kingdom: the production-line tabs are now hidden on the mode-select screen, where there is nothing to switch between yet.',
    ],
  },
  {
    version: 'v0.16.11',
    date: '04/07/2026',
    time: '20:19',
    title: 'Smarter auto mode',
    summary:
      'Auto mode now stacks the highest generator, not just unlocks the next.',
    qol: [
      'Auto mode now keeps progressing like a player would: each step it either unlocks the next generator or stacks another copy of the highest one you already own — and it never touches lower tiers. If it can afford neither, it waits.',
      'This fixes Kingdom auto mode stalling once the finite chain was fully unlocked — it now reinforces the top generator instead of idling.',
    ],
  },
  {
    version: 'v0.16.10',
    date: '04/07/2026',
    time: '20:01',
    title: 'Restore settings & tidier modal',
    summary:
      'A button to restore default settings, and a cleaner Settings modal.',
    qol: [
      'New "Restore defaults" button in the Settings footer: resets Themes, Sound, Video and Language to their defaults (with a confirmation step). Saved games are never touched.',
      'Removed the redundant ✕ on the Settings modal — click outside or press Esc to close — so the navigation tabs now use the full width.',
    ],
  },
  {
    version: 'v0.16.9',
    date: '04/07/2026',
    time: '19:52',
    title: 'Telemetry off by default',
    summary:
      'Telemetry cards now start hidden, leaving a cleaner default top bar.',
    qol: [
      'All Video telemetry cards (FPS, frame time, battery, memory, DOM nodes) now start off by default — turn on only what you want; your choice stays saved per device.',
      'The cycle progress bars remain on by default.',
    ],
  },
  {
    version: 'v0.16.8',
    date: '04/07/2026',
    time: '19:49',
    title: 'Patch notes, browsable',
    summary:
      'The patch notes get Steam-style feature banners, collapsible patches and jump-to-edge controls.',
    qol: [
      'Feature releases (x.y.0) now wear a Steam-style blue treatment: a header banner ("Feature release" for a MINOR, "Major update" for a MAJOR), a blue border and a subtle blue tint — the milestones stand out at a glance.',
      'Small patches now start collapsed, showing just version, title and date/time; click the row (or press Enter) to expand the details.',
      'Fade controls at the top and bottom of the list jump you to the start or the end, matching the Generators and Cycles lists.',
    ],
  },
  {
    version: 'v0.16.7',
    date: '04/07/2026',
    time: '19:31',
    title: 'Highlighted feature releases',
    summary:
      'Feature releases now stand out in the patch notes, Steam-style.',
    qol: [
      'Feature releases (x.y.0 — a MINOR or MAJOR) now get their own accent in the patch notes: a brass left bar, a warm background tint and a brighter version number, so the big milestones pop out from the small patches.',
      'Housekeeping: the previous release was reclassified as a PATCH (v0.17.0 → v0.16.6) — new telemetry cards and reordering aren\u2019t new game content, so they don\u2019t warrant a MINOR.',
    ],
  },
  {
    version: 'v0.16.6',
    date: '04/07/2026',
    time: '19:28',
    title: 'Kingdom up front & new telemetry',
    summary:
      'Kingdom takes the lead across the app, and telemetry gains memory and DOM-node readouts.',
    qol: [
      'Two new telemetry cards next to FPS and frame time: JS heap memory (MB, Chromium only) and a live DOM-node count — toggle them in Settings → Video, on by default. Handy for gauging how much features like hidden cycle bars actually save.',
      'Kingdom is now the first mode in the navigation and the default landing screen for first-time players; the Activity tabs lead with Kingdom too (Kingdom, Generators, Cycles).',
      'The "Notes" menu is now labelled "Patch notes".',
    ],
  },
  {
    version: 'v0.16.5',
    date: '04/07/2026',
    time: '19:05',
    title: 'Patch notes, laid out',
    summary:
      'The patch notes get a wider layout with a patch time, and the whole version history is renumbered.',
    qol: [
      'Each release now spans the full page width, with its Major, Minor, Quality-of-life and Fixes categories side by side in fixed-width columns (empty categories are skipped) — much easier to scan.',
      'Entries now show the patch time next to the date; historical entries with no recorded time show a "—" instead.',
      'Housekeeping: the entire version history was renumbered to a MAJOR.MINOR.PATCH scheme — PATCH for small fixes/QoL, MINOR for new content, MAJOR reserved for massive expansions. The game stays on 0.x until the 1.0 launch.',
    ],
  },
  {
    version: 'v0.16.4',
    date: '04/07/2026',
    title: 'Kingdom in Activity',
    summary: 'The Activity tab now tracks Kingdom unlocks too.',
    minor: [
      'New "Kingdom" tab in Activity: the unlock log now covers Kingdom alongside Cycles and Generators, listing each generator by its name (Reaper, Peasant, Farmer…) with the same times, intervals and pace breakdown.',
    ],
  },
  {
    version: 'v0.16.3',
    date: '04/07/2026',
    title: 'Toggleable cycle bars',
    summary:
      'A Video setting to hide the cycle progress bars, on by default.',
    qol: [
      'New "Cycle progress bars" switch in Settings → Video (on by default): hide the in-card cycle bars in Cycles and Kingdom if you prefer — the remaining-time column already shows the cycle.',
      'Purely visual: the setting is a per-device preference and never touches saves or the deterministic, bit-for-bit simulation.',
    ],
  },
  {
    version: 'v0.16.2',
    date: '04/07/2026',
    title: 'Patch notes revamp',
    summary:
      'The patch notes got a full revamp — every release is now organized into a summary plus color-coded sections.',
    qol: [
      'Each entry leads with a one-line summary, then groups its changes into labeled Major, Minor, Quality-of-life and Fixes sections so you can scan a release at a glance.',
      'Cleaner card layout with color-coded section tags.',
      'Applied retroactively across the entire history.',
    ],
  },
  {
    version: 'v0.16.1',
    date: '04/07/2026',
    title: 'Settings modal & Counter removal',
    summary:
      'Settings moved into a centered modal and the Counter mode was retired.',
    minor: [
      'Removed the Counter mode entirely: it was only a sandbox for validating ideas and was never really a game. The app now focuses on Generators, Cycles and Kingdom.',
    ],
    qol: [
      'Settings now opens as a centered square modal over the interface instead of a full page — close it by clicking outside, the ✕, or pressing Esc. Its section tabs live back inside the card.',
    ],
  },
  {
    version: 'v0.16.0',
    date: '04/07/2026',
    title: 'Kingdom mode (medieval production lines)',
    summary:
      'A new medieval Kingdom mode arrives with a fully playable Food production line.',
    major: [
      'New "Kingdom" mode: a medieval theme with several production lines you switch between via sub-tabs.',
      'The Food line is fully playable — harvest Wheat through a finite chain of 12 named generators (Reaper, Peasant, Farmer… up to Kingdom), each a deterministic cycle just like Cycles mode.',
    ],
    minor: [
      'Deliberately slow, medieval economy: cycles start at 2s and grow 3× per tier (minutes-long at the top), while per-cycle output is decoupled from cycle length (+0.1 per tier) — deeper tiers run long cycles for a modest yield, so their effective rate keeps dropping. The idea is to stack many copies of the same generator, so repeat purchases get gradually pricier.',
      'Every line runs its own independent, frame-rate-proof simulation anchored to wall-clock time, so progress stays perfectly reproducible.',
      'Mining, Medicine and Military lines are in as placeholders ("coming soon") for now.',
    ],
    qol: [
      'Auto mode no longer blocks manual purchases — it still auto-buys the next generator, but you can also buy on your own at any time.',
      'Locked generators now read as a progress bar (across Generators, Cycles and Kingdom): no card, just a filling bar toward the unlock cost, with the filled part in the same brass as the buy button. Costs show decimals so incremental price bumps are visible.',
    ],
  },
  {
    version: 'v0.15.3',
    date: '04/07/2026',
    title: 'Consistent Settings labels',
    summary: 'Settings tab labels now match their section titles.',
    fixes: [
      'Settings tab labels now match their section titles — the Saves tab reads "Jogos salvos" and the Video section is no longer titled "Telemetria".',
    ],
  },
  {
    version: 'v0.15.2',
    date: '04/07/2026',
    title: 'Fullscreen persistence & empty saves',
    summary:
      'Fullscreen survives a refresh and empty saves stop showing a fake date.',
    qol: [
      'Fullscreen now survives a refresh: the app re-enters fullscreen on your first click or keypress after reloading (browsers block auto-fullscreen without a gesture).',
      'Saves with no progress in any mode show "no data" instead of a meaningless date.',
    ],
  },
  {
    version: 'v0.15.1',
    date: '04/07/2026',
    title: 'Save reset tweaks',
    summary: 'Reset buttons behave better inside the save panel.',
    qol: [
      'Reset buttons are now disabled for modes with no progress yet — nothing to wipe, nothing to click.',
      'The three reset buttons (and the load button) now span the full width of the expanded save panel.',
    ],
  },
  {
    version: 'v0.15.0',
    date: '04/07/2026',
    title: 'Fullscreen & tidier Settings',
    summary: 'A fullscreen toggle arrives and Settings gets tidier.',
    minor: [
      'New fullscreen toggle at the top-left corner — enter or leave fullscreen with a single click (hidden where the browser has no Fullscreen API).',
    ],
    qol: [
      'Settings tabs now sit above the panel as standalone cards (like Activity), leaving the content card shorter and less boxed-in.',
    ],
  },
  {
    version: 'v0.14.1',
    date: '03/07/2026',
    title: 'Locale housekeeping',
    summary: 'Internal locale refactor — nothing changes in game.',
    minor: [
      'Internal: translations refactored into one file per language (src/lib/locale/), ready for more languages after 1.0.',
    ],
  },
  {
    version: 'v0.14.0',
    date: '03/07/2026',
    title: 'Ahora en español',
    summary: 'Español joins the UI, completing the 1.0 language trio.',
    major: [
      'Third UI language: Español — full dictionary, auto-detection for Spanish systems, localized dates and default save names (Partida N).',
    ],
    minor: [
      'The 1.0 language trio is set: English, Português (Brasil) and Español.',
    ],
  },
  {
    version: 'v0.13.4',
    date: '03/07/2026',
    title: 'Jogos salvos',
    summary: 'The Portuguese UI drops the "saves" loanword for "jogos salvos".',
    qol: [
      'The Portuguese UI now says "jogos salvos" instead of the English loanword "saves" — tab, titles, buttons and the default name of new saves (Jogo salvo N).',
    ],
  },
  {
    version: 'v0.13.3',
    date: '03/07/2026',
    title: 'Sound switch',
    summary: 'A sound on/off switch and simpler Video labels.',
    minor: [
      'Sound tab gained an on/off switch alongside the volume slider — mute without losing your volume level.',
    ],
    qol: [
      'Simpler labels on the Video toggles (FPS, Frame time, Battery), grouped under an "individual cards" label.',
    ],
  },
  {
    version: 'v0.13.2',
    date: '03/07/2026',
    title: 'One switch to rule them all',
    summary: 'A master switch toggles every telemetry card at once.',
    minor: [
      'Video tab gained an "All cards" master switch at the top: turns every telemetry card on or off at once.',
    ],
  },
  {
    version: 'v0.13.1',
    date: '03/07/2026',
    title: 'Less chatter in Settings',
    summary: 'Trimmed Settings copy and a cleaner active-save row.',
    qol: [
      'Settings descriptions trimmed to the essentials — shorter hints for Saves, Themes, Sound, Video and Language.',
      'The active save no longer shows a delete button (it was disabled anyway) — its card now takes the full row.',
    ],
  },
  {
    version: 'v0.13.0',
    date: '03/07/2026',
    title: 'The app speaks your language',
    summary: 'First-visit language now follows the OS/browser.',
    minor: [
      'On first visit the UI language now follows the OS/browser language: Portuguese systems get pt-BR, everything else gets English.',
    ],
    qol: [
      'Picking a language in Settings still overrides the detection and is remembered on the device.',
    ],
  },
  {
    version: 'v0.12.1',
    date: '03/07/2026',
    title: 'English as the canonical language',
    summary: 'English becomes the project\u2019s canonical language.',
    minor: [
      'English is now the project\u2019s canonical language: README, page metadata, docs and — starting with this entry — the patch notes are written in English.',
      'Portuguese (Brasil) remains fully available as a UI language for players; the app still opens in pt-BR by default.',
      'Older patch notes stay in Portuguese, as the historical documents they are.',
    ],
  },
  {
    version: 'v0.12.0',
    date: '03/07/2026',
    title: 'O laboratório fala inglês',
    summary: 'i18n chega: toda a interface em Português e English.',
    major: [
      'Suporte a idiomas (i18n): toda a interface agora existe em Português e English, com dicionários próprios e chaves tipadas.',
    ],
    minor: [
      'Nova aba Idioma na Config para trocar a língua — a escolha fica salva no dispositivo e vale para o app inteiro.',
      'Datas e horários acompanham o idioma (dd/mm vs. mm/dd).',
      'As notas de patch permanecem no idioma original, como documentos históricos que são.',
    ],
  },
  {
    version: 'v0.11.0',
    date: '03/07/2026',
    title: 'Saves com nome próprio',
    summary: 'Saves agora podem ser batizados e renomeados.',
    minor: [
      'Criar um save agora abre um campo de nome já preenchido com o genérico (Save N) — é só apagar e batizar como quiser antes de confirmar.',
      'Todo save pode ser renomeado: o campo fica no painel expandido, junto das outras opções.',
    ],
    qol: [
      'Enter confirma, Esc cancela a criação.',
      'O input de renomear ganhou um fundo mais claro dentro do painel escuro.',
      'Botões pressionados agora afundam 1px fixo em vez de encolher em porcentagem — botões largos não recuam mais de forma exagerada.',
    ],
    fixes: [
      'O filete de foco do input agora é cor sólida de verdade: a sombra interna do baixo relevo escurecia o topo dele, dando impressão de gradiente.',
      'O ✕ de excluir e a setinha de expandir viraram ícones desenhados (SVG): como caracteres de texto, cada sistema usava uma fonte diferente e os tamanhos divergiam entre macOS e Windows.',
    ],
  },
  {
    version: 'v0.10.1',
    date: '03/07/2026',
    title: 'Saves com calma',
    summary: 'O fluxo de saves ficou mais calmo, sem trocas acidentais.',
    minor: [
      'Clicar num save não troca mais na hora: abre um painel abaixo dele com as opções de carregar e de zerar cada modo.',
      'Os botões de zerar progresso saíram da seção solta e agora vivem dentro do save escolhido, lado a lado — dá até para zerar um modo de um save inativo.',
    ],
    qol: [
      'Os botões de carregar e de criar save usam o mesmo estilo dos botões de compra dos Geradores, com texto centralizado.',
      'Criar um novo save também ficou mais calmo: ele entra na lista sem assumir o lugar do atual; carregue quando quiser.',
    ],
  },
  {
    version: 'v0.10.0',
    date: '03/07/2026',
    title: 'Aba Temas e faixas exorcizadas',
    summary: 'Config ganha a aba Temas e o Chrome/macOS para de listrar o preto.',
    major: [
      'Config ganhou a aba Temas: cada tema virou um card pintado com as próprias cores, com um mini-mockup de interface dentro.',
    ],
    minor: [
      'O tema ativo fica em destaque no topo; os disponíveis se organizam lado a lado, quebrando linha conforme a coleção cresce.',
      'Tabs da Config agora ocupam a largura toda, e o conteúdo das abas também — os cards de tema aproveitam o espaço no desktop.',
    ],
    qol: [
      'O tema ativo perdeu o anel de destaque: a posição no topo já conta a história.',
      'Cards de tema agora têm largura fixa — o ativo parou de esticar pela tela toda.',
      'O app lembra em qual página você estava: dar refresh não te devolve mais para os Ciclos.',
    ],
    fixes: [
      'Corrigidas as faixas de pretos diferentes no Chrome/macOS: um micro-ruído imperceptível no fundo força todos os blocos de pintura pelo mesmo caminho de rasterização.',
    ],
  },
  {
    version: 'v0.9.0',
    date: '03/07/2026',
    title: 'Atividade para os dois modos',
    summary: 'A Atividade passa a cobrir Ciclos e Geradores.',
    minor: [
      'A Atividade ganhou abas Ciclos e Geradores — o log de desbloqueios agora cobre os dois modos.',
      'Modo sem desbloqueios mostra um convite com botão para começar a jogar dali mesmo.',
    ],
    qol: [
      'O card do gerador nos Geradores perdeu a coluna de desbloqueio (a informação vive na Atividade) e o grid foi redistribuído.',
    ],
  },
  {
    version: 'v0.8.0',
    date: '03/07/2026',
    title: 'Verde musgo e amostras',
    summary: 'Quarto tema (verde-musgo) e amostras de cor no seletor.',
    minor: [
      'Quarto tema: base verde-musgo escura com amarelo queimado (mostarda) nos acentos.',
    ],
    qol: [
      'O seletor de temas ganhou amostras de cores (fundo, card, acento, texto) ao lado de cada nome.',
    ],
  },
  {
    version: 'v0.7.0',
    date: '03/07/2026',
    title: 'Creme terracota',
    summary: 'Terceiro tema, agora claro: creme com terracota.',
    minor: [
      'Terceiro tema, agora claro: fundos em areia/creme, tintas em marrons quentes, terracota queimada como acento e sombras recalibradas para superfície clara.',
    ],
  },
  {
    version: 'v0.6.0',
    date: '03/07/2026',
    title: 'Sistema de temas',
    summary: 'Nasce o sistema de temas escolhíveis.',
    major: [
      'Paleta de cores escolhível na Config (aba Vídeo): Dark neutro ou Azul meia-noite, com aplicação instantânea e persistência no dispositivo.',
    ],
  },
  {
    version: 'v0.5.3',
    date: '03/07/2026',
    title: 'Dark neutro',
    summary: 'Dark mode de verdade: pretos e cinzas puros.',
    minor: [
      'Teste de paleta: a base azulada deu lugar a pretos e cinzas puros — dark mode de verdade, mantendo a hierarquia de profundidade (fundo → cards → superfícies) e o latão como acento.',
    ],
  },
  {
    version: 'v0.5.2',
    date: '03/07/2026',
    title: 'Canaleta calibrada',
    summary: 'A canaleta da barra de ciclo foi calibrada.',
    qol: [
      'A parte vazia da barra de ciclo foi calibrada num meio-termo: visível sem roubar atenção do preenchimento.',
    ],
  },
  {
    version: 'v0.5.1',
    date: '03/07/2026',
    title: 'Setinhas honestas',
    summary: 'Correção nas setinhas de navegação da lista.',
    fixes: [
      'Corrige as setinhas de navegação que às vezes ficavam visíveis (e inertes) mesmo com a lista já no fim — o estado das bordas envelhecia quando a virtualização mudava a altura do conteúdo sem evento de scroll.',
    ],
  },
  {
    version: 'v0.5.0',
    date: '03/07/2026',
    title: 'Notas de patch',
    summary: 'Estreia a aba Notas — esta página.',
    major: [
      'Nova aba Notas com o histórico de versões do laboratório — esta página.',
    ],
  },
  {
    version: 'v0.4.1',
    date: '03/07/2026',
    title: 'Barra de ciclo interna',
    summary: 'A fitinha de ciclo virou uma barra interna dedicada.',
    minor: [
      'A fitinha de 3px na borda dos cards dos Ciclos virou uma barra interna dedicada, com canaleta em baixo relevo e preenchimento em alto relevo.',
    ],
    qol: [
      'Cantos achatados no padrão dos cards e espessura calibrada em audições sucessivas.',
    ],
  },
  {
    version: 'v0.4.0',
    date: '03/07/2026',
    title: 'Config de gente grande',
    summary: 'Config vira painel único com tabs internas.',
    major: [
      'Config virou painel único com tabs internas: Saves, Som e Vídeo.',
    ],
    minor: [
      'Aba Vídeo estreia os toggles de telemetria: cards de FPS, frame time e bateria podem ser desligados.',
    ],
    qol: [
      'Switches deslizantes com relevo físico (canaleta afundada, bolinha flutuando).',
      'Slider de volume repaginado: pegador em pill, trilho em baixo relevo, preenchimento em alto relevo e halo no hover.',
    ],
  },
  {
    version: 'v0.3.0',
    date: '03/07/2026',
    title: 'Saves múltiplos',
    summary: 'Sistema de slots de save com migração automática.',
    major: [
      'Sistema de slots de save: crie, troque e exclua saves sem perder progresso — cada slot guarda os três modos.',
    ],
    minor: ['Zerar por modo passou a morar junto dos saves.'],
    qol: [
      'Migração automática do save antigo para o "Save 1", com sincronia bit a bit preservada.',
    ],
  },
  {
    version: 'v0.2.1',
    date: '03/07/2026',
    title: 'Virtualização',
    summary: 'Virtualização da lista leva o frame rate ao teto do monitor.',
    major: [
      'Cards fora da janela de scroll (e de abas ocultas) viram fantasmas de mesma altura: com 80+ geradores, o frame rate subiu de ~135fps para o teto do monitor (180fps).',
    ],
    minor: [
      'Simulação, sincronia e saves intocados — só a renderização emagreceu.',
    ],
  },
  {
    version: 'v0.2.0',
    date: '03/07/2026',
    title: 'Identidade de versão',
    summary: 'Pill de versão e detector de deploy pendente.',
    minor: [
      'Pill de versão no hub, alimentada pelo carimbo do build.',
      'Detector de deploy pendente: a pill vira o botão "Nova versão pendente" quando o servidor tem build mais novo (version.json consultado a cada 60s, sem backend).',
    ],
    qol: [
      'Contador ganhou o hub completo: início do save, tempo e Exportar CSV.',
    ],
  },
  {
    version: 'v0.1.0',
    date: '02/07/2026',
    title: 'A fundação',
    summary:
      'A fundação do laboratório: contador, geradores, ciclos, atividade e a infra.',
    major: [
      'Contador de formatação com break_eternity.js: sufixos K…No, letras infinitas (aa…zz, aaa…) e truncamento estilo odômetro.',
      'Geradores em cadeia contínua com desbloqueio progressivo, modo automático e curva de custos tunada por simulação.',
      'Ciclos: produção em rajadas com ciclos progressivos (5s × N) — e a descoberta de que rajadas nunca alcançam o contínuo.',
      'Atividade: log de desbloqueios com tempos explicados e ritmo colorido.',
    ],
    minor: [
      'Sincronia bit a bit entre máquinas: timestep fixo determinístico ancorado no relógio, com catch-up offline.',
      'Telemetria (FPS, frame time, bateria, ambiente), export CSV para balanceamento e wake lock.',
      'Som de clique sintetizado (o "Toc", garimpado de um bug alheio) com par pressionar/soltar e volume.',
    ],
    qol: [
      'Visual portado do design system do Coders, responsivo até no iPhone, com deploy contínuo na Vercel.',
    ],
  },
];
