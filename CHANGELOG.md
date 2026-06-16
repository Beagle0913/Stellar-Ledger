# Changelog

All notable changes to this prototype are documented here.

## [Unreleased]

### Added — Milestone 3 NPC economy (Phases 3A–3G)
- **Multi-corporation state** (`corporations[]`, `playerCorporationId`) with save/load migration v12–v13.
- **Passive NPC corporation definitions** (`npc_corporations.json`) seed Helion Mining and Orion Refining on new campaigns only.
- **NPC production AI** — deterministic job queueing on idle NPC buildings after production completes.
- **NPC market AI** — corp-owned buy/sell orders (`corp_*`) alongside abstract `NPC_OWNER` liquidity.
- **NPC logistics AI** — inter-system convoys using the same transport job model as the player.
- **Economic profile retune** — reduced abstract `producedPerDay` for ore where NPC miners operate.
- **Debug / System / Planet visibility** for foreign NPC buildings; Debug panel shows corp jobs, orders, and transport.
- **Balance gates** — `market_not_empty_day_30`, `npc_orders_bounded`, `no_npc_inventory_negative`, `no_price_explosion_day_100`.
- **Docs** — `ECONOMY.md`, `MODDING.md`, `ROADMAP.md` updated for Milestone 3 completion.

### Changed — documentation
- **README** expanded: gameplay guide, troubleshooting, architecture diagram, CI badge, contributor workflow.
- **Docs cross-linked:** DESIGN, ECONOMY, MODDING, PERSISTENCE, BALANCE_ANALYTICS, ROADMAP, and `docs/README.md` aligned on clone flow, commands, content counts, and portable exe naming.
- **`LICENSE`** added (MIT). **`docs/README.md`** now includes developer quick reference and CI table matching `.github/workflows/ci.yml`.

### Added — developer tooling
- **`scripts/ensure-node-native.mjs`** + `pretest` hook — auto-rebuilds `better-sqlite3` for Node before tests.
- **`pnpm verify`** — runs typecheck, lint, test, and balance.
- **CI:** `rebuild:node` step on Ubuntu before tests (fixes postinstall Electron ABI).

### Changed — documentation (prior)
- **README** refreshed: GitHub clone instructions, current feature list, docs index, removed machine-specific dev notes.
- **`docs/README.md`** added as documentation index with reading order.
- **DESIGN**, **ROADMAP**, **MODDING**, **ECONOMY**, **PERSISTENCE** updated to match shipped features (objectives, fleet, star map, balance harness, autosave, example mods).

### Added — balance analytics
- **Headless balance harness** (`src/balance/`) with scripted strategies (`idle`, `arcPlay`, `smeltAndSell`, `smeltAndSellOptimal`, `logistics`, `contracts`), daily metric snapshots, hard CI gates, and diagnostic warnings.
- **Pure campaign bootstrap** extracted to `src/simulation/bootstrap.ts` (re-exported from save manager) so analytics never imports SQLite.
- **`npm run balance`** / **`npm run balance:report`** — Vitest-driven runs; reports written only to `reports/balance/` by the report runner.
- See [`docs/BALANCE_ANALYTICS.md`](docs/BALANCE_ANALYTICS.md).

### Added — explanation layer ("Why did this happen?")
- **Shared explanation module** (`src/shared/explanations/`) with structured codes, player-facing text templates, and family-specific builders for market, events, objectives, production, logistics, and errors.
- **Market explanations** on the Market page diagnostics panel and Dashboard tick market changes (maps existing `PriceMovementReason` + trend into richer messages).
- **Error explanations** via `explainFromError` — maps `GameError.code` first, known message patterns second, falls back to original message without inventing causes.
- **Objective locked sublines** on Dashboard Upcoming objectives (prerequisite name shown).
- **Event log sublines** describing trigger summaries; **`explainEventEligibility`** for read-only gate breakdown (no gating rule changes).
- **Production/Logistics page hints** for idle buildings, queued input blocks, and in-transit ETAs.
- **`TickResult.explanations`** — capped ephemeral daily digest ("Why today") on Dashboard after advancing time.
- Derived on demand — **no save schema migration**.

### Added — economic drama events
- **Event gating** via optional `minCampaignTick`, `requiresCompletedObjectiveId`, and `cooldownTicks` on `EventDefinition`.
- **Event cooldown state** via `progression.eventLastFiredTick` (defaults to `{}` on old saves).
- **`eventEligible`** checks tick gate, objective completion, and cooldown before a trigger is evaluated; persistent triggers no longer fire every tick.
- **Five gated vanilla drama events**: industrial metal rally, food security warning, food relief convoy, logistics fuel pressure, machinery squeeze — plus retuned market pulse and trade guild subsidy.
- Punitive events are gated behind first-hour arc milestones (`obj_arc_revenue`, `obj_arc_convoy`, `obj_arc_fleet`).
- **Content version** bumped to `3` (`data/vanilla/content_version.json`).

### Added — first-hour campaign arc
- **Staged objective chain** in `data/vanilla/objectives.json` teaches the core loop step by step: smelt your first metal → scale production → earn sales revenue → run your first convoy → expand to two ships → grow net worth.
- **Objective prerequisites** via `dependsOnObjectiveId` (a single prerequisite id). An objective stays locked — never syncing or completing — until its prerequisite completes, then snaps to its cumulative lifetime progress.
- **Optional objectives** via `optional: true`. These appear in a dedicated Optional section and are excluded from the main current-goal hint; they never block the critical path. The new optional "Complete a faction contract" side quest uses this.
- **`complete_contracts` objective type** that tracks the number of completed contracts.
- **Template-level contract gating** via `minCampaignTick` on contract templates: gated templates (fleet expansion, capital milestone) only appear on the board once the campaign reaches that day, keeping the early board focused on simple sell/produce work.
- **Dashboard objective sections**: Active (highlighted main goal), Optional, Upcoming (muted, locked), and Completed.
- **Current-goal suggestion**: the Dashboard now leads with the first non-optional, unlocked objective.
- **Content version** bumped to `2` (`data/vanilla/content_version.json`).

### Added — vanilla Star Map page
- **Star Map** renderer page: static SVG trade network, overlay toggles, selected-system detail panel, systems table, navigation to System/Market/Logistics.
- Reuses existing **`getStarMap` IPC** and `StarMapView` DTO (no backend changes).

### Added — P0/P1 hardening
- **Autosave on player actions** plus save-status indicator in the layout.
- **Scaling foundations**: index-backed NPC regional trade, incremental order/stockpile saves, trimmed price-history load.
- **Windows CI dist job** builds and verifies portable exe.
- **Strict save validation** (`GE_STRICT_SAVE=1`) and load warnings on Debug page.
- **Vanilla content versioning** for portable exe updates beside the exe.

### Removed from vanilla UI (superseded)
- ~~**Star Map page** removed from vanilla renderer~~ — restored in unreleased; **`getStarMap` IPC** unchanged.

### Added — star map backend (mod hook)
- **`getStarMap` IPC** and `StarMapView` DTO: faction colors, economy heat, transport/NPC convoy arcs, contract highlights.
- **Live map data** updated each tick via `recordRegionalTradesForMap`.

### Added — modularity (Priority 2)
- **Renderer smoke tests**: Vitest + Testing Library for key pages (`tests/renderer/`, mock `api` via `vi.mock`).
- **IPC checklist** in README; **`pnpm scaffold:ipc`** script prints boilerplate snippets and `verify` mode.

### Changed — modularity (Priority 1)
- **Split `types.ts`** into `src/shared/types/{definitions,state,views,api}.ts` with barrel re-export.
- **Registry pattern** for events (`eventRegistry.ts`), objectives/contracts (`progressionRegistry.ts`).
- **`campaign_start.json`** mod file for starting credits, stock, buildings, and home-system selection (replaces hardcoded lists in `saveManager`).
- **`docs/PERSISTENCE.md`** — when to use tables vs JSON blobs vs ephemeral state.

### Changed — modularity (Priority 0)
- **Slim `gameService.ts`**: read-model assembly moved to `src/simulation/viewQueries.ts`; campaign lifecycle to `src/main/campaignSession.ts`; mod cache to `src/main/modCatalog.ts`.
- **`buildBuilding`** logic moved to `src/simulation/buildings.ts`.
- **`actionSuggestions`** moved from `src/shared/` to `src/simulation/` (fixes shared→simulation layer violation).
- **ESLint import boundaries**: `shared`, `simulation`, and `renderer` layers enforce `no-restricted-imports`.

### Removed from vanilla (star map UI — backend kept)
- Star Map **page** and renderer components; tutorial now points to **Systems** page.
- Phase 1/2 star map **UI** features below apply to the mod hook / `getStarMap` only, not the shipped vanilla app.

### Added — star map backend (Phase 2 — mod hook)
- **Live economy heat** on system nodes (surplus / stable / shortage rings from regional stockpiles).
- **NPC convoy arcs** (last 3 days) with fade animation after each tick.
- **Event pulses** on systems affected by recent events (3-day window).
- **Contract destination** highlights for accepted delivery/regional-sale contracts.
- **Distance-weighted lanes** (opacity and stroke scale with jump distance).

### Added — star map backend (Phase 1 — mod hook)
- **`getStarMap` IPC** and `StarMapView` DTO: faction colors, home ring, per-system stock/building/ship counts, top shortage, transport arcs.

### Fixed — portable exe SQLite ABI
- **`better-sqlite3` ABI mismatch** (NODE_MODULE_VERSION 127 vs 130): dist now force-rebuilds
  with `electron-rebuild -f` and verifies the module under Electron before packaging.

### Added — packaging / easy launch
- **Portable exe** output as `release/GalacticEconomy.exe` (single file, no installer).
- **`Play.bat`** and **`Build Game.bat`** for double-click build and launch on Windows.
- **`pnpm play:portable`** launches the packaged exe; **`pnpm play`** runs a production build from source.

### Added — activity logging
- **Persistent activity log** (`activityLog` on `GameState`, up to 500 entries) saved with each campaign (schema v6: `activity_log_json`).
- **Per-tick detailed log** (`TickResult.log`): production completions, transport deliveries, NPC convoys, player trades, population shifts, price moves, and events.
- **Player action logging** for market orders, quick trades, production, transport, buildings, ships, contracts, save/load.
- **`getActivityLog` IPC** and Debug page viewer with category filter; Dashboard last-tick report shows detailed activity lines.
- **Console mirroring** via `GE_DEBUG=1` (and `GE_DEBUG_VERBOSE=1` for tick headers); see README.
- **Tests**: `gameLog.test.ts`, `tickLog.test.ts`.

### Added — economy depth
- **Stockpile-scaled NPC liquidity**: profiled items limit NPC buy/sell depth from regional stockpiles (no infinite drain).
- **NPC regional trade**: surplus/shortage and price-spread convoys move goods between markets each tick.
- **Population dynamics**: live planet populations grow or shrink from food security; feed per-capita demand.
- **`economy_config.json`**: moddable tunables (liquidity fractions, trade caps, population rates); merged field-by-field in load order.
- **Schema v5**: `economy_config_json` and `planet_populations_json` on `campaign_meta`.
- **Tests**: `npcLiquidity.test.ts`, `npcRegionalTrade.test.ts`.

### Added — modding
- **Mod diagnostics**: load order + duplicate-id conflict warnings on Mods page.
- **`reloadModData` IPC** and **Reload mod data from disk** button (dev hot-reload without restart).
- **MODDING.md** updated for `economic_profiles.json`, `economy_config.json`, ships, objectives, contracts.

### Changed
- Tick pipeline extended (population → regional trade → liquidity sync); Dashboard tick report shows NPC convoy count.
- Planet/System pages show **live population** from runtime state.

### Added
- **Smart time controls (Dashboard)**: advance to next production completion, next transport arrival, or until something changes (trades/jobs/deliveries/events), each capped at 30 days (`runTicksSmart` IPC).
- **Quick market actions (Market page)**: sell max / sell qty at best bid and buy qty at best ask with read-only preview (`previewMarketTrade`) and immediate execute (`executeMarketTrade`).
- **Production queue**: one running job per building with queued overflow; inputs consumed when a job starts running; cancel queued without loss, cancel running without refund; Repeat and Run until exhausted actions on Production page.
- **Objectives & contract board**: five persistent objectives and a rotating contract board (accept/complete/abandon) with credits + faction reputation rewards; data in `objectives.json` and `contract_templates.json`.
- **Dashboard suggestions**: contextual hints via `src/simulation/actionSuggestions.ts` (idle refinery, affordable ships, price spreads, idle ships, smelting capacity, stockpile shortages).
- **Schema v4**: `progression_json`, `objectives_json`, and `contract_templates_json` on `campaign_meta`.
- **Tests**: production queue, market trade preview/execute, smart tick, objectives/contracts, action suggestions.

### Added (M4 — balance & reputation)
- **`src/shared/balance.ts`**: documented tuning knobs (starting credits/stock, contract guards, reputation payout bonus).
- **Early campaign tests** (`tests/earlyCampaign.test.ts`): bad/normal/optimal first-30-days scripted paths.
- **Contract economy tests** (`tests/contractBalance.test.ts`): tier-1 reward caps vs market value; tier-2 day gates.
- **Faction standing panel** on Dashboard (reputation, next tier, contract bonus — no regional price discounts).

### Changed (M4)
- Starting credits **38,000** (was 100,000); tighter starting stock.
- Hauler II **39,500 cr**, Bulk Freighter **65,000 cr**.
- Net-worth objective **130,000**; contract rewards reduced ~50%; tier 2 gated by day 25+.
- Reputation adds up to **+10% contract credit bonus** only (does not modify `priceBias`).

### Added (prior unreleased)
- **Mod management UX**: external mods can be enabled/disabled before starting a new campaign (`mod-settings.json`, `setModEnabled` IPC). Mods page shows active mod ids, new-campaign definition counts, and clear messaging that loaded saves keep frozen definitions.
- **Fleet logistics**: purchasable ship types (`data/vanilla/ships.json`), `purchaseShip` IPC, Logistics page buy UI, and multi-ship concurrent transport jobs.
- **Production job cancel**: `cancelProductionJob` IPC (inputs not refunded); Production page Cancel action; Dashboard production job snippet.
- **Faction regional identity**: `controllingFactionId` on systems, `priceBias` on factions, applied in local economy price movement; System page shows controller and bias.
- **Debug page** (dev builds only): read-only view of `getDebugState()` stockpiles, NPC orders, and recent prices.
- **Schema v3**: `ships_json` on `campaign_meta`, `controlling_faction_id` on `star_systems`.
- **Tests**: `modSettings.test.ts`, `ships.test.ts`, `factions.test.ts`, `apiError.test.ts`; extended mod merge and IPC coverage.

### Added (prior unreleased)
- **Structured error model** (`src/shared/errors.ts`): a `GameError` class with a stable `ErrorCode` (`VALIDATION`, `NOT_FOUND`, `CONFLICT`, `NO_CAMPAIGN`, `MOD_VALIDATION`, `INTERNAL`). Failed `IpcResult`s now carry `{ code, message }` instead of a bare string, so the renderer can distinguish user mistakes from bugs.
- **`safeDispatch` in `dispatch.ts`**: the IPC try/catch wrapper moved out of `main.ts` into the Electron-free dispatcher so the full error path is unit-testable. Unexpected (`INTERNAL`) errors are logged with their stack via a new always-on `logError`; expected domain errors are not.
- **Renderer `ApiError`**: `api.*` calls throw an `ApiError` carrying the error code, so pages can branch on it (message-only handling keeps working unchanged).
- **React error boundary** around the page view: a render crash on one page shows an inline error panel with a Retry button instead of blanking the whole app; it resets on navigation/refresh.
- **Main-process last-resort handlers** for `uncaughtException` / `unhandledRejection` that log instead of dying silently.
- **`tests/errors.test.ts`** (11 tests): `toIpcError` classification (GameError, ModValidationError, plain Error, non-Error throws), and `safeDispatch` end-to-end code mapping (NO_CAMPAIGN, VALIDATION, NOT_FOUND, CONFLICT, INTERNAL + logging).
- **No-campaign UI recovery**: `campaignRequired.ts` helpers (`isNoCampaignError`, `resolveNoCampaignRecovery`, …), `useCampaignAsync` / `handleApiError` in the renderer, `CampaignRequiredBoundary` + `NoCampaignPanel`, and **`tests/campaignRequired.test.ts`** (7 tests). Campaign pages redirect to Save / Load on `NO_CAMPAIGN` instead of showing raw error panels; Save / Load and Mods stay put and only sync `campaignActive`.
- **Player-facing economy diagnostics**: `src/shared/economyDiagnostics.ts` with price reason labels, change/trend formatting, and tick-level `marketChanges` reporting. Market page shows price movement, regional NPC stockpile, trend, and a short economy guide; Dashboard tick report adds a compact “Market changes” section (notable moves only). **`tests/economyDiagnostics.test.ts`** (12 tests).

### Changed
- All intentional domain throws in `gameService`, `ipcSchemas`, `market`, `logistics`, `production`, and `tick` now use `GameError` with an explicit code; `ModValidationError` extends `GameError` (`MOD_VALIDATION`). Plain `Error` throws are reserved for genuine invariant violations and are auto-classified `INTERNAL` (and logged) at the boundary.
- Unsafe `(err as Error).message` casts replaced with a shared `errorMessage()` helper, so non-Error throws can no longer surface as `"undefined"` in the UI.
- **App context** moved to `src/renderer/context.ts`; campaign-dependent pages use `useCampaignAsync` so stale data is cleared and the player is guided to Save / Load when the backend has no open campaign. `VALIDATION` / `NOT_FOUND` / `CONFLICT` errors still display normally; `INTERNAL` errors still surface through existing panels/boundary.
- **`MarketItemView`** and **`TickResult`** now include structured price diagnostics (`ItemPriceDiagnostics`, `MarketChangeEntry[]`) for renderer display — no simulation rule changes.

## [0.1.3] — Quality, scaling & depth pass

### Added
- **Cancel market orders** end-to-end: `cancelMarketOrder` IPC + a Cancel action on your own resting orders in the Market page (escrowed credits / reserved inventory are released in full).
- **Batch tick advancement**: `runTicks(n)` (1–365) with a single save at the end, plus a "Run 7 Days" button on the Dashboard.
- **Save management**: delete saves (with confirmation; the open campaign is protected) and rename campaigns (updates the name inside the save file — the file name on disk is unchanged).
- **Transport job cancellation**: running jobs can be cancelled; reserved cargo is released at the origin, fuel is **not** refunded (see ECONOMY.md).
- **Zod-validated IPC**: every payload-carrying IPC method is validated in the main process (`src/main/ipcSchemas.ts`) before reaching the game service.
- **Debug state inspector**: read-only `getDebugState()` IPC returning local stockpiles, the NPC order book, and the last 50 price rows.
- **Population-driven demand**: optional `perCapitaConsumptionPerDay` on economic profile item rules, layered on authored flat rates for planet-attached profiles (population × rate). Used by vanilla food/luxury rules.
- **5 new vanilla economic profiles** (aquaculture food supply, rocky-world ore supply, gas-giant fuel/energy harvest, mining-colony water+machinery demand, garden-world food demand) attached to 7 previously unprofiled planets, plus luxury-goods demand on Helion Prime and energy demand on Marrow A via extended existing profiles (8 profiles total).
- **New event types**: `stockpileShortage` trigger (any market's regional stockpile below a threshold) and `stockpileShock` / `creditBonus` effects, with reference-integrity validation and two new vanilla events (Food Relief Convoy, Trade Guild Subsidy).
- **Price-history reasons over IPC**: `PricePoint.reason` is exposed and the Market page shows the last movement reason.
- **Economic profile count** on the Mods page (`definitionCounts.economicProfiles`).
- **Dev logging**: tiny `GE_DEBUG=1`-gated logger; previously silent catches in save listing/closing now log when enabled.
- **ESLint** (flat config, typescript-eslint + react-hooks) with a `lint` script, and a **GitHub Actions CI** workflow running typecheck + lint + tests.

### Changed
- **Save cadence**: the game now saves **on tick** (`runTick`/`runTicks`) and on explicit "Save Now" only; individual actions (orders, jobs, construction) no longer write to disk immediately. Actions taken since the last tick or manual save are lost on a crash — a deliberate single-player tradeoff for snappier interaction and fewer writes.
- **Price history retention**: only the most recent 365 ticks are kept per market+item; older rows are pruned at the end of each tick (reference prices are unaffected).
- **Reference price lookup is O(1)** via a derived in-memory latest-price index (`pushPriceRow`/`notePriceRow` in `economyMath.ts`); not part of the save schema.
- **Migration framework**: `migrations.ts` restructured into an ordered `MIGRATIONS` array (v1 = full schema, v2 = local-economy additions); behavior unchanged.
- **Mod loading is cached** in the game service; the cache refreshes when a new campaign is created.

### Fixed
- Tick-step doc comment in `tick.ts` reads coherently again and matches ECONOMY.md.

### Tests
- 45 → 69 tests: real v1→v2 migration test against a hand-built v1 database, IPC dispatcher coverage test (every `GameApi` method must dispatch; compile-time exhaustive), 300-tick economy soak with scripted trading, order/transport cancellation, `runTicks` equivalence, price-history pruning, per-capita aggregation, new event triggers/effects, and a `definitionCounts` drift guard.

## [0.1.2] — Dynamic Local Economy v1

### Added
- **Economic profiles** in mod content (`economic_profiles.json`) with per-item consumed/produced rates, target stockpiles, and price multiplier bounds.
- **Planet/system profile attachment** via optional `economicProfileId` on planets and star systems.
- **`src/simulation/localEconomy.ts`**: deterministic daily demand/supply pressure that adjusts regional reference prices and records movement reasons (`shortage`, `surplus`, `stable`, `npc_demand`, `npc_supply`, `trade`).
- **Regional stockpiles** (`localStockpiles` on `GameState`) simulate NPC inventory pressure per system market (not player inventory).
- **Vanilla examples**: food demand on Helion Prime, ore supply on Cinder Core, machinery demand on Marrow A.
- **NPC order price refresh** after local economy updates so seeded liquidity tracks reference prices.

### Changed
- **Tick order**: local economy runs after production/transport and before market matching.
- **Save schema v2** (migrated automatically): `local_stockpiles` table, `price_history.reason` column, frozen `economic_profiles_json` and profile ids on planets/systems. v1 saves still load; they behave as before until a new campaign is started with updated content.

### Added (0.1.2 continued)
- **Market/economy loop:** NPC order depth replenishes each tick after matching; player↔NPC trades adjust regional `localStockpiles` (buys draw stock down, sells add stock).

## [0.1.1] — Stability & clarity pass

### Fixed
- **Production tick safety:** completing a job on an orphan building (building removed but job still running) no longer throws and aborts the tick; output is skipped instead.
- **`rebuild:node` script:** uses `npm rebuild better-sqlite3` so it works when `pnpm` is not on PATH inside npm scripts.

### Improved error messages
- **Building construction:** insufficient credits or materials now report exact need/have amounts and item names (via shared `explainAffordability` helper) instead of a generic "Not enough credits or materials to build."
- **Production input consumption:** rare consume failures now name the item and quantity.
- **Logistics fuel:** fuel shortfall messages use the item display name from data (e.g. "Fuel").

### Tests added
- Production: invalid building/recipe/quantity, wrong building type, orphan-building tick safety.
- Market: insufficient inventory for sell, insufficient credits for buy, non-crossing spread, partial fills.
- Logistics: cargo capacity, missing fuel, missing cargo, same-system rejection, delivery on completion.
- Economy: `explainAffordability` credit and material messages.
- Save manager: multi-tick round-trip with production completion and market trade.

### Unchanged
- Save file schema and format (existing `.sqlite` saves remain compatible).
- Core loop: produce → sell → transport → tick → save/load.
- Simulation architecture and IPC surface.
