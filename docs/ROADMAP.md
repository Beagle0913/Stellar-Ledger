# Roadmap

Status labels: **done** (in repo), **partial** (started), **planned** (not started).

## Milestone 0 — MVP architecture (done)

Shared types and IPC, mod loader, simulation core, SQLite saves, Electron/React UI, Vitest + ESLint + CI.

## Milestone 1 — Playable prototype (done)

Campaign CRUD, dashboard ticks, star map drill-down, market/production/logistics, objectives and contracts, autosave, portable Windows exe.

## Milestone 2 — Modding (partial)

Done: per-mod enable/disable, dependency order, conflict diagnostics, reload JSON from disk, `campaign_start.json`.

Planned: interactive load-order editor, migrating frozen defs inside old saves, mod hooks for renderer pages.

## Milestone 3 — Economy (done)

Population and per-capita demand, regional trade, stockpile-scaled liquidity, balance harness, price explanations, first-hour arc, multi-corp state, scenario snapshots, price charts, production planner, NPC corp AI (production/market/logistics), ore profile retune.

## Milestone 4 — Depth & shipping (partial)

Done: fleet logistics, gated events, activity log, Windows CI dist.

Planned: research, colonization, standing routes, faction depth, Linux/macOS installers.

## Contributing

Clone, `pnpm install --frozen-lockfile`, `npm run rebuild:node`, `pnpm verify`. Mention balance results if you touch the economy. Update [CHANGELOG.md](../CHANGELOG.md) for visible changes.
