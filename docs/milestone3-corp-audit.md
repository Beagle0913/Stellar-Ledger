# Milestone 3 corp refactor audit (Phase 0)

Historical notes from before multi-corp landed. Phase 3A shipped `corporations[]`, `playerCorporationId`, migration v12. Use `src/simulation/corporations.ts` in new code.

## Patterns we searched for

| Pattern | Why |
|---------|-----|
| `state.corporation` | Single-corp assumption |
| `corporation.id` | Player-scoped inventory/orders |
| `LIMIT 1` | Single corp row in SQLite |
| `NPC_OWNER` | Abstract liquidity id |
| `ownerId` | Corp vs NPC on entities |

## Files that had `state.corporation` (pre-3A)

`bootstrap.ts`, `market.ts`, `production.ts`, `logistics.ts`, `viewQueries.ts`, `gameService.ts`, repositories, renderer pages, tests — all migrated to `getPlayerCorporation()` and related helpers.

## SQLite

`worldRepo` and friends previously used `LIMIT 1` on corporations; now load/save all rows.

## Follow-up (completed)

1. Phase 0: helpers + old-save fixture  
2. Phase 3A: state shape + migration  
3. Phases 3B–3G: NPC defs, AI, docs  
