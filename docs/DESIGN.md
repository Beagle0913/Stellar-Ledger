# Design

## What this is

Stellar Ledger is an offline single-player game about running an industrial corporation across a 100-system galaxy. You mine and refine goods, ship them between systems, and trade on local markets. The UI is dense tables, charts, and a flat star map — closer to a planning spreadsheet than an action game. Original content and naming throughout.

## Core loop

Look at the galaxy (map, systems, markets, inventory). Decide what to build, produce, trade, or haul. Do it. Tick time forward — one day, seven, or smart advance up to 30 days. Read what changed (prices, jobs, events, objectives) and repeat.

Nothing happens until you tick.

## Prototype scope

**World:** 100 systems, approximately 550 generated planets (see `galaxy-meta.json` for exact count), 20 items, 12 buildings, 20 recipes, 3 factions, 7 events, 7 objectives, contract board. Four scenario presets and two seeded NPC corporations in vanilla JSON.

**Player:** Start from `campaign_start.json` plus chosen scenario (frozen in the save). Fleet logistics, production queues, read-only chain planner, quick market trades, price charts, objectives with a first-hour arc.

**Economy:** One market per system. Abstract `NPC_OWNER` liquidity plus real corp orders from Helion Mining and Orion Refining. Economic profiles, stockpile-scaled depth, regional trade convoys, live populations, gated events. Deterministic tick — see [ECONOMY.md](ECONOMY.md).

**Tech:** SQLite saves (schema v13), frozen mod/scenario snapshots, autosave on actions and ticks. JSON mods with Zod validation. Explanation strings derived at display time, not stored in saves. Balance harness in [BALANCE_ANALYTICS.md](BALANCE_ANALYTICS.md).

## Code layout

- `src/simulation` — pure TypeScript, no Electron/React/DB. Takes `GameState`, returns new state.
- Content ids come from JSON only; logic never hardcodes item names.
- Renderer talks to main through typed IPC (`GameApi`); no Node in the UI.
- Saves copy mod definitions at campaign creation so later JSON edits can't break old games.

## Explanations

`src/shared/explanations/` turns existing simulation facts (price reasons, event triggers, objective locks, etc.) into player text. Built in view queries and tick results, not persisted.

## Not done yet

Research trees, colonization, standing routes, richer diplomacy, planner auto-queue, Linux/macOS installers, mod-injected UI pages. Shipped but still rough around the edges: portable Windows exe only, read-only planner, two NPC corps. See [ROADMAP.md](ROADMAP.md).
