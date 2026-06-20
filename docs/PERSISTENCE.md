# Persistence

Where campaign data lives and how to extend it.

## Storage tiers

**Normalized tables** — mutable rows you query or update often: `corporations`, `inventories`, `market_orders`, `production_jobs`, `buildings`, etc.

**JSON on `campaign_meta`** — frozen snapshots or bulky blobs: `factions_json`, `economy_config_json`, `progression_json`, `activity_log_json`, `scenario_config_json`, …

**Ephemeral `GameState`** — rebuilt each session/tick: `recentRegionalTrades`, `ticking` guard. Not saved on purpose.

## Frozen vs live

New campaigns write merged mod definitions into SQLite once. Edit JSON later → affects only future new campaigns.

**v0.2.0 galaxy break:** Saves from v0.1.x reference the old 5-system map. Loading them in v0.2.0 shows a friendly conflict — start a new campaign for the 100-system galaxy. No automatic migration.

Mutable state saves after player commands (`persistAfterMutation`), after ticks, and on Save Now. The layout shows saved / saving / error and last saved tick.

## Adding a field

1. Types in `src/shared/types/` (`state.ts` or `definitions.ts`)
2. Migration in `src/database/migrations.ts` if schema changes
3. Repository load/save
4. `saveManager.ts` — bootstrap, load, persist
5. Tests: migrations, save round-trip, anything that touches the field

Run `pnpm scaffold:state <fieldName>` (or `node scripts/scaffold-state-field.mjs`) for a step-by-step checklist. PR template includes the same list.

## Repository layout

Persistence code is split by concern (re-exported from `worldRepo.ts` for compatibility):

| Module | Responsibility |
|--------|----------------|
| `metaRepo.ts` | `campaign_meta`, scenario columns, activity log JSON |
| `corpRepo.ts` | `corporations` table |
| `definitionsRepo.ts` | Frozen defs written once at campaign creation |
| `entityRepo.ts` | Building instances, ships, events log, planet populations |

Use tables when you need queries or frequent partial updates. Use JSON blobs for nested mod-shaped data. Keep derived UI-only stuff ephemeral.

## Campaign start

Defaults from merged `campaign_start.json`. Scenarios in `scenarios.json` overlay credits, stock, buildings, etc. at creation. Full scenario copied to `campaign_meta` (`scenario_id`, `scenario_name`, `scenario_difficulty`, `scenario_config_json`). Loaded saves read the snapshot, not live files on disk.

Applied in `buildInitialState()` only. Contract tuning constants stay in `src/shared/balance.ts`.

## Corporations

`GameState` has `corporations[]` and `playerCorporationId`. Credits, inventory, buildings, ships persist per corp id. NPC seeds from `npc_corporations.json` apply on new campaigns only — old saves are not backfilled when you add corps to JSON.

## Activity log

`activityLog` on state, capped in memory, stored in `activity_log_json`.

## Schema version

Current: **13** (`src/database/migrations.ts`).

| Version | Change |
|--------:|--------|
| 11 | Scenario columns on `campaign_meta` |
| 12 | Multi-row corporations, `player_corporation_id` |
| 13 | NPC corp bootstrap metadata |

Bump version with a forward migration and a test. Player-facing notes go in [CHANGELOG.md](../CHANGELOG.md).
