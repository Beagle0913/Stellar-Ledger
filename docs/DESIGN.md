# DESIGN

## What the game is

Stellar Ledger is a single-player, offline, spreadsheet-style strategy game about
running an industrial corporation across a small galaxy. You extract raw resources,
refine them through production chains, move goods between star systems, and buy/sell
on local markets to grow your credit balance and industrial footprint.

The aesthetic is deliberately minimal and information-dense: tables, panels, charts,
and a simple 2D star map — closer to a planning tool than an action game. It draws on
the broad *design space* of production-chain economy games and dense 4X interfaces,
but uses entirely original content, naming, and systems.

## Core loop

1. **Inspect** the galaxy: systems, planets, your inventory, and local markets.
2. **Decide**: what to extract/produce, what to build, what to trade, what to ship.
3. **Act**: construct buildings, queue production jobs, place market orders, dispatch
   transport jobs.
4. **Advance time**: press **Run 1 Day Tick**. The simulation processes production,
   logistics, market matching, price history, and events deterministically.
5. **React** to the new state (prices moved, jobs finished, goods arrived, events
   fired) and repeat.

Time only advances when *you* tick, so the game is a calm, turn-based planner.

## MVP scope (this prototype)

- Galaxy of **5 systems / 15 planets**, all data-driven.
- **20 items**, **12 building types**, **20 recipes** (including extraction recipes).
- **One player corporation** with starting credits, inventory, buildings, and a ship.
- **Local markets** (one per system) with an order book, NPC liquidity, midpoint trade
  pricing, and recorded price history.
- **Production**: buildings run recipes; inputs consumed on start, outputs on
  completion; extraction output scales with planet stats.
- **Logistics**: ships carry goods between systems, consuming fuel and time.
- **Events**: a tiny data-driven event system (interval + low-stock triggers).
- **Saves**: each campaign is a local SQLite file with a frozen snapshot of the loaded
  mod definitions.
- **Modding**: validated JSON mods; the base game is the built-in `vanilla` mod.

## Architecture principles

- The **simulation core** (`src/simulation`) is pure TypeScript: no Electron, no React,
  no database. It operates on an in-memory `GameState`, which makes every system
  unit-testable and keeps the tick deterministic.
- **Data drives everything.** No item/recipe/building names are hardcoded in logic;
  the code only references ids and definitions loaded from JSON.
- The **renderer never touches Node**. It talks to the main process through a single
  typed `contextBridge` API (`GameApi`).
- **Saves are durable.** Mod definitions are frozen into each save so changing or
  removing mods later cannot corrupt an existing campaign.

## Explanation layer

Player-facing "why" text is built in `src/shared/explanations/` from simulation
facts already present (`PriceMovementReason`, event triggers, objective prerequisites,
production validation messages, etc.). Explanations are **derived on demand** in view
builders and tick results — they are not persisted in saves. The renderer only formats
pre-built `Explanation` objects via shared components (`ExplanationLine`).

## Balance analytics

Headless balance runs live in `src/balance/`: scripted player strategies, daily metric snapshots, hard CI gates, and optional JSON/Markdown/CSV reports. See [`docs/BALANCE_ANALYTICS.md`](BALANCE_ANALYTICS.md).

## Future scope (beyond the slice)

- Population needs & consumption demand that endogenously drive prices.
- NPC corporations/factions that produce, consume, and trade.
- Research/tech trees, colonization mechanics, and habitat growth.
- Multiple ships, routes, and automated logistics contracts.
- Price charts, production planners, and richer event chains.
- Packaged installers via electron-builder for Windows/Linux/macOS.
