# ROADMAP

Milestone status for the Stellar Ledger prototype. **Done** = shipped in this repo;
**Partial** = foundation exists but not the full vision; **Planned** = not started.

---

## Milestone 0 — MVP architecture ✅ Done

- Shared domain types + IPC contract (`src/shared/types/`)
- Data-driven mod system (Zod validation, dependency resolution, merge)
- Pure simulation core (production, market, logistics, extraction, events, tick)
- SQLite persistence with frozen mod-definition snapshots
- Electron main/preload with typed `contextBridge` API
- React UI with all campaign pages + dev Debug page
- Headless Vitest suites, ESLint, GitHub Actions CI

---

## Milestone 1 — First playable prototype ✅ Done

- New / Load / Save / Delete / Rename campaigns from the UI
- Dashboard: credits, day, inventory value, tick controls (1 day, 7 days, smart advance)
- Star Map → System → Planet drill-down
- Inventory, market orders, quick trades, production queues, transport jobs, ship purchase
- Objectives, contract board, faction standing, contextual action suggestions
- Visible state changes after ticks (prices, jobs, deliveries, events, explanations)
- Autosave on player actions + save on tick; save-status indicator in layout
- Portable Windows exe (`GalacticEconomy.exe`) + `Build Game.bat` / `Play.bat`

---

## Milestone 2 — Modding maturity 🟡 Partial

| Item | Status |
|------|--------|
| Per-mod enable/disable (`mod-settings.json`, Mods page) | ✅ Done |
| Mod load-order / dependency resolution | ✅ Done |
| Conflict & duplicate-id diagnostics on Mods page | ✅ Done |
| Reload mod JSON from disk without restart (`reloadModData`) | ✅ Done |
| `campaign_start.json` for starting conditions | ✅ Done |
| Interactive load-order editor in UI | Planned |
| Versioned migration of **frozen** definitions inside old saves | Planned |
| Mod-injected renderer pages / nav hooks | Planned |

---

## Milestone 3 — Economy balancing 🟡 Partial

| Item | Status |
|------|--------|
| Population dynamics & per-capita demand | ✅ Done |
| NPC regional trade convoys | ✅ Done |
| Stockpile-scaled NPC liquidity | ✅ Done |
| Headless balance harness + CI gates | ✅ Done |
| Player-facing price diagnostics & explanations | ✅ Done |
| First-hour objective arc + contract pacing | ✅ Done |
| Full NPC corporations (autonomous industry) | Planned |
| Interactive price charts & production planner | Planned |
| Difficulty presets & scenario starts | Planned |

---

## Milestone 4 — Depth & shipping 🟡 Partial

| Item | Status |
|------|--------|
| Fleet logistics (multiple ships, concurrent routes) | ✅ Done |
| Gated drama events + cooldowns | ✅ Done |
| Activity log + Debug page | ✅ Done |
| Windows portable packaging + CI dist artifact | ✅ Done |
| Research / tech trees | Planned |
| Colonization & habitat growth | Planned |
| Standing trade routes & logistics contracts | Planned |
| Richer faction relations & event chains | Planned |
| Installers for Linux / macOS | Planned |

---

## How to contribute

1. Read this index and the root [`README.md`](../README.md) (especially [Contributing](../README.md#contributing)).
2. `corepack pnpm install --frozen-lockfile` → `npm run rebuild:node` → `corepack pnpm verify`.
3. For economy changes, note `pnpm balance` results in your PR.
4. Update [`CHANGELOG.md`](../CHANGELOG.md) for player- or developer-visible changes.
