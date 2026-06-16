# ROADMAP

## Milestone 0 — MVP architecture (done)

- Shared domain types + IPC contract.
- Data-driven mod system with Zod validation, dependency resolution, and merge.
- Pure simulation core (production, market, logistics, extraction, events, tick).
- SQLite persistence with frozen mod-definition snapshots.
- Electron main/preload with a single typed contextBridge API.
- React UI shell with all ten pages.
- Headless Vitest suites + strict typecheck.

## Milestone 1 — First playable prototype (this slice)

- New/Load/Save campaigns from the UI.
- Dashboard with credits, day, counts, inventory value, and a **Run 1 Day Tick** button.
- Star map → system → planet drill-down.
- Inventory, market order placement, production jobs, transport jobs.
- Visible state changes after a tick (prices, jobs, deliveries, events).
- Launch the Electron GUI on a machine with a display and rebuild `better-sqlite3`
  for the Electron ABI (see README).

## Milestone 2 — Modding maturity

- Per-mod enable/disable persisted to disk (currently conceptual in the UI).
- Mod load-order editor and conflict diagnostics.
- Hot-reload of vanilla/mod JSON in dev.
- Versioned save migrations when frozen definitions need upgrading.

## Milestone 3 — Economy balancing

- Population consumption that generates real demand and drives prices endogenously.
- NPC corporations that extract, produce, and trade (beyond static liquidity).
- Price charts and a production/logistics planner.
- Tunable difficulty and starting conditions.

## Milestone 4 — Depth & shipping

- Research/tech trees and colonization/habitat growth.
- Multiple ships, standing trade routes, and logistics contracts.
- Richer, chained events and faction relations.
- Packaged installers (electron-builder) for Windows/Linux/macOS.
