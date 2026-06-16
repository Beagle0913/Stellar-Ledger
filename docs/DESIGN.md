# DESIGN

> **See also:** [README — How to play](../README.md#how-to-play) · [ECONOMY.md](ECONOMY.md) ·
> [MODDING.md](MODDING.md) · [ROADMAP.md](ROADMAP.md)

## What the game is

Stellar Ledger is a single-player, offline, spreadsheet-style strategy game about
running an industrial corporation across a small galaxy. You extract raw resources,
refine them through production chains, move goods between star systems, and buy/sell
on local markets to grow your credit balance and industrial footprint.

The aesthetic is deliberately minimal and information-dense: tables, panels, sparklines,
price charts, and a 2D star map — closer to a planning tool than an action game. It draws on the
broad *design space* of production-chain economy games and dense 4X interfaces, but
uses entirely original content, naming, and systems.

## Core loop

1. **Inspect** the galaxy: Star Map, systems, planets, inventory, and local markets.
2. **Decide** what to extract, produce, build, trade, ship, or contract for.
3. **Act** — construct buildings, queue production, place market orders, dispatch transport, accept contracts.
4. **Advance time** — **Run 1 Day Tick**, **Run 7 Days**, or smart advance (next production, next transport, or until something changes; capped at 30 days).
5. **React** to the new state (prices, jobs, deliveries, events, objective progress) and repeat.

Time only advances when *you* tick, so the game is a calm, turn-based planner.

## MVP scope (this prototype)

### World & content

- Galaxy of **5 systems / 15 planets**, all data-driven.
- **20 items**, **12 building types**, **20 recipes** (including extraction).
- **3 factions**, **7 events**, **7 objectives**, rotating **contract board**.
- **4 scenario presets** (`scenarios.json`) and **2 NPC corporation seeds** (`npc_corporations.json`).
- Base game is the built-in **`vanilla`** mod; external example mods in `mods/`.

### Player corporation

- Starting layout from merged `campaign_start.json` + chosen **scenario** (snapshot frozen in save).
- **Fleet logistics** — purchase multiple ship types; concurrent transport jobs.
- **Production queues** — one running job per building with queued overflow.
- **Production planner** — read-only chain feasibility from current player stock (no auto-queue).
- **Quick market trades** — preview and execute at best bid/ask; interactive price charts.
- **Objectives & contracts** — staged first-hour arc, optional side quests, faction reputation.

### Economy & simulation

- **Local markets** per system: order book, abstract `NPC_OWNER` liquidity, corp-owned NPC orders, midpoint trade pricing, price history (365-tick retention).
- **NPC corporations** — Helion Mining and Orion Refining run production, list surplus/shortage on markets, and ship goods between systems (deterministic AI).
- **Regional economy** — economic profiles, stockpile-scaled NPC depth, abstract cross-system trade convoys.
- **Population dynamics** — live planet populations driven by food security; per-capita demand.
- **Events** — tick interval, low stock, stockpile shortage triggers; gating and cooldowns.
- **Deterministic tick** — pure TypeScript simulation; see [`ECONOMY.md`](ECONOMY.md) for step order.

### Tech & persistence

- **Saves** — SQLite per campaign; mod definitions frozen at campaign creation; autosave on player actions and ticks.
- **Modding** — validated JSON mods; enable/disable before new campaign; reload from disk in dev.
- **Explanations** — derived “why” text for market moves, events, objectives, production, logistics (not persisted).
- **Balance analytics** — headless scripted strategies with CI gates; see [`BALANCE_ANALYTICS.md`](BALANCE_ANALYTICS.md).

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
builders and tick results — they are not persisted in saves. The renderer formats
pre-built `Explanation` objects via shared components (`ExplanationLine`).

## Balance analytics

Headless balance runs live in `src/balance/`: scripted player strategies, daily metric
snapshots, hard CI gates, and optional JSON/Markdown/CSV reports. See
[`BALANCE_ANALYTICS.md`](BALANCE_ANALYTICS.md).

## Future scope (beyond the slice)

| Area | Status | Notes |
|------|--------|-------|
| Population-driven demand | **In prototype** | Live populations + per-capita consumption |
| NPC regional trade | **In prototype** | Abstract convoys between surplus/shortage markets |
| NPC corporations | **In prototype** | Helion Mining + Orion Refining; production, market, logistics AI |
| Scenario difficulty starts | **In prototype** | Four presets with frozen save snapshots |
| Production chain planner | **In prototype** | Read-only feasibility; no auto-queue yet |
| Interactive price charts | **In prototype** | Market page SVG chart with range + tooltip |
| Multiple ships & fleet | **In prototype** | Purchasable types, concurrent jobs |
| Windows portable exe | **In prototype** | `release/GalacticEconomy.exe` |
| Research / tech trees | Planned | — |
| Colonization & habitat growth | Planned | — |
| Standing trade routes & automation | Planned | — |
| Richer event chains & diplomacy | Planned | — |
| Planner auto-queue / market buying | Planned | v1.1 stretch |
| Installers (Linux/macOS) | Planned | electron-builder targets beyond Windows portable |
| Mod-injected UI pages | Planned | `getStarMap` IPC exists today for tools/forks |

See [`ROADMAP.md`](ROADMAP.md) for milestone tracking.
