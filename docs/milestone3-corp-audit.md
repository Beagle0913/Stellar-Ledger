# Milestone 3 — single-corporation audit (Phase 0)

> **Status:** Completed in Phase 3A (`corporations[]`, `playerCorporationId`, migration v12).
> This file is a historical audit trail — use `src/simulation/corporations.ts` helpers in new code.

Generated during Phase 0 preparation. Use this list when refactoring to `corporations[]` + `playerCorporationId`.

## Search patterns

| Pattern | Purpose |
|---------|---------|
| `state.corporation` | Direct player corp access |
| `corporation.id` | Player-scoped inventory/orders/ships |
| `LIMIT 1` | Single corp / meta row in SQLite |
| `NPC_OWNER` | Abstract market liquidity (`'npc'`) |
| `ownerId` | Corp or NPC ownership on entities |

## Affected files (`state.corporation`)

| File | Notes |
|------|-------|
| `src/simulation/bootstrap.ts` | Creates player corp |
| `src/simulation/market.ts` | Credits, inventory, order ownership |
| `src/simulation/marketTrade.ts` | Player inventory for quick trades |
| `src/simulation/buildings.ts` | Player credits and build costs |
| `src/simulation/ships.ts` | Player credits and ship purchase |
| `src/simulation/progression.ts` | Contract payouts |
| `src/simulation/progressionRegistry.ts` | Objective progress, net worth |
| `src/simulation/eventRegistry.ts` | Stock checks, credit events |
| `src/simulation/economyMath.ts` | Credit checks |
| `src/simulation/viewQueries.ts` | Dashboard, inventory views |
| `src/simulation/actionSuggestions.ts` | Player suggestions |
| `src/simulation/starMapView.ts` | Player home, fleet |
| `src/database/saveManager.ts` | save/load corporation |
| `src/balance/harness.ts` | Starting credits metric |
| `src/balance/metrics.ts` | Player-focused snapshots |
| `src/balance/strategies/*.ts` | Strategy helpers |

## SQLite `LIMIT 1`

| File | Table |
|------|-------|
| `src/database/repositories/worldRepo.ts` | `campaign_meta`, `corporations`, `activity_log_json`, `planet_populations_json` |
| `src/database/repositories/progressionRepo.ts` | `campaign_meta.progression_json` |

## Refactor strategy

1. Phase 0: `getPlayerCorporation(state)` helpers — use in new code.
2. Phase 3A: Add `corporations[]`, `playerCorporationId`; migrate save/load; replace `state.corporation` reads via helpers.
3. Phase 3B+: NPC corps appended to `corporations[]` at bootstrap only.

## Helpers

See [`src/simulation/corporations.ts`](../src/simulation/corporations.ts).
