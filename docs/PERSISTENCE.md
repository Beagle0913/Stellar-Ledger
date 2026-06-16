# Persistence guide

How campaign data is stored, and where to put new fields.

> **See also:** [MODDING.md](MODDING.md) (save snapshots vs live JSON) ·
> [README — Troubleshooting](../README.md#troubleshooting) · [DESIGN.md](DESIGN.md)

## Three storage tiers

| Tier | When to use | Examples | Survives save/load? |
|------|-------------|----------|---------------------|
| **Normalized tables** | Mutable gameplay rows you may query or index | `corporations`, `inventories`, `market_orders`, `production_jobs`, `buildings` | Yes |
| **JSON on `campaign_meta`** | Frozen mod snapshots or medium-sized blobs that change rarely | `factions_json`, `economy_config_json`, `progression_json`, `activity_log_json`, `scenario_config_json` | Yes |
| **Ephemeral `GameState` fields** | Derived or UI-only data rebuilt each session/tick | `recentRegionalTrades`, `ticking` guard | No (by design) |

## Frozen definitions vs mutable state

When a **new campaign** starts, merged mod definitions are written once into SQLite (`item_definitions`, `planets`, … plus JSON blobs on `campaign_meta`). Later mod edits affect **future** campaigns only.

Mutable state (credits, inventory, jobs, progression) is persisted:

- **After every player action** — `CampaignSession.persistAfterMutation()` from command handlers.
- **After each tick** — `runTick`, `runTicks`, and `runTicksSmart` call `session.save()`.
- **On explicit Save Now** — `saveCurrent()` via `saveManager.persistMutable()`.

The layout shows save status (`saved` / `saving` / `error`) and the last saved tick.

## Adding a new persisted field — checklist

1. **`src/shared/types/`** — add to `state.ts` (runtime) or `definitions.ts` (mod content).
2. **Migration** — bump schema version in `src/database/migrations.ts` if columns or JSON shape changes.
3. **Repository** — load/save in the appropriate repo under `src/database/repositories/`.
4. **`saveManager.ts`** — wire into `buildInitialState`, `loadCampaign`, and/or `persistMutable`.
5. **Tests** — `migrations.test.ts`, `saveManager.test.ts`, and any simulation tests that touch the field.

Prefer **normalized tables** when you need SQL queries or frequent partial updates. Prefer **JSON blobs** for nested structures that mirror mod JSON (progression, activity log). Prefer **ephemeral** when the data is cheap to recompute and does not affect gameplay if lost on crash.

## Campaign start configuration

Starting credits, stock, buildings, and home-system selection come from merged mod
`campaign_start.json` (`GameDefinitions.campaignStartConfig`). **Scenario presets**
(`scenarios.json`) layer partial overrides on top at new-campaign time; the full
`ScenarioDefinition` is frozen into `campaign_meta` (`scenario_id`, `scenario_name`,
`scenario_difficulty`, `scenario_config_json`). Bootstrap reads the **snapshot**, not
live mod files — editing `scenarios.json` on disk does not alter loaded saves.

Applied only in `buildInitialState()` — not re-read during play. Contract tuning knobs
remain in `src/shared/balance.ts`.

## Multi-corporation state

`GameState` holds `corporations[]` and `playerCorporationId`. All corporation rows
(credits, inventory, buildings, ships) persist in the `corporations` table and related
normalized rows keyed by corp `ownerId`. **NPC corporation seeds** from
`npc_corporations.json` apply on **new campaigns only**; old saves are not retrofitted
with new NPC corps when mod JSON changes.

## Activity log

`GameState.activityLog` is trimmed in memory and persisted in `activity_log_json`. Player actions logged via `logPlayerAction()` are saved with the same autosave as other mutations.

## Schema version history

Current schema version: **13** (see `src/database/migrations.ts`).

Recent milestones:

| Version | Notable changes |
|---------|-----------------|
| v11 | Scenario snapshot columns on `campaign_meta` |
| v12 | `player_corporation_id`; multi-row `corporations` save/load |
| v13 | NPC corporation bootstrap metadata for new campaigns |

Always add a forward migration and a test when bumping the version. See also
[`CHANGELOG.md`](../CHANGELOG.md) for player-visible release notes.
