# Stellar Ledger — Galactic Economy Prototype

An original, moddable, single-player **galactic economy / spreadsheet strategy** game.
This repository is a **vertical slice prototype**: it proves the architecture end to
end (data-driven mods → simulation core → SQLite saves → Electron/React UI) rather
than shipping the full game.

**Repository:** [github.com/Beagle0913/Stellar-Ledger](https://github.com/Beagle0913/Stellar-Ledger)

---

## Quick start (Windows — just play)

You only need Node.js **once** to build the game. After that, play with a single exe.

1. **Build** — double-click **`Build Game.bat`** (installs deps on first run, then packages).
2. **Play** — double-click **`Play.bat`**, or run **`release\GalacticEconomy.exe`** directly.

Copy `release\GalacticEconomy.exe` anywhere you like (Desktop, USB stick, etc.). On first
launch it creates editable `data/`, `mods/`, and `saves/` folders **beside the exe**.

> No install wizard, no registry entries — one portable exe.

---

## What you get today

- **Single-player, fully local.** No server, no cloud, no accounts, no telemetry.
- **Spreadsheet-first UI.** Dense tables and panels plus a 2D **Star Map** trade-network view. No 3D.
- **Data-driven & moddable.** All content lives in JSON; the base game is a built-in mod called `vanilla`.
- **Campaign loop.** Objectives, contract board, faction reputation, fleet logistics, production queues, quick market trades, and smart time advance on the Dashboard.
- **Economy depth.** Regional stockpiles, NPC liquidity, cross-system NPC trade, population dynamics, and player-facing “why did this happen?” explanations.
- **Saves & mods.** SQLite campaigns with frozen mod snapshots; enable/disable mods per new campaign; reload JSON from disk in dev.

> **Tech:** TypeScript (strict) · Electron · React · Vite (`electron-vite`) · better-sqlite3 · Zod · Vitest

---

## Clone and develop (any machine)

**Requirements:** Node.js **22+** and `pnpm` (via Corepack, which ships with Node).

```powershell
git clone https://github.com/Beagle0913/Stellar-Ledger.git
cd Stellar-Ledger

# Install dependencies (builds native better-sqlite3 / electron / esbuild binaries)
corepack pnpm install

# Headless verification
corepack pnpm test
corepack pnpm typecheck
corepack pnpm lint
```

If `pnpm` is already on your `PATH`, you can drop the `corepack` prefix. `npm` also works as a fallback (`npm install`, `npm test`, …).

pnpm blocks native build scripts by default; this repo pre-approves the required ones in
`pnpm-workspace.yaml` (`better-sqlite3`, `electron`, `esbuild`), so a plain install builds them automatically.

### Run from source

```powershell
# Rebuild better-sqlite3 for Electron (required once before GUI)
corepack pnpm run rebuild:electron

# Development (Vite HMR + Electron)
corepack pnpm dev
```

After using the GUI, restore the Node ABI used by tests:

```powershell
corepack pnpm run rebuild:node
corepack pnpm test
```

> **Why two ABIs?** Vitest runs on Node; the app runs on Electron. `better-sqlite3` is a native addon compiled for one ABI at a time. The rebuild scripts flip between them.

---

## Commands

```powershell
corepack pnpm install          # Install dependencies
corepack pnpm test             # Full Vitest suite
corepack pnpm typecheck        # Strict TypeScript check
corepack pnpm lint             # ESLint
corepack pnpm build            # Build main / preload / renderer → out/
corepack pnpm dev              # Dev desktop app
corepack pnpm play             # Production build from source (no packaging)
corepack pnpm run play:portable # Launch packaged exe (after dist)
corepack pnpm run dist         # Full portable exe pipeline
corepack pnpm start            # Preview a production build
corepack pnpm balance          # Headless balance CI gates
corepack pnpm run balance:report  # Balance run + reports in reports/balance/
```

---

## Packaging a portable Windows .exe

```powershell
corepack pnpm run dist
```

Or double-click **`Build Game.bat`** on Windows.

Pipeline (`scripts/dist.mjs`): stop running exe → rebuild `better-sqlite3` for Electron → build → package → verify → restore Node ABI for tests.

Output:

```
release/GalacticEconomy.exe
```

**If you see `NODE_MODULE_VERSION 127` vs `130`:** close any running `GalacticEconomy.exe`, then run **`Build Game.bat`** again.

### First-run folder behavior (editable content)

The portable exe ships read-only **seed** copies of `data/` and `mods/` inside itself.
The first time you run it, the game creates editable folders beside the exe:

```
GalacticEconomy.exe
data/      <- editable game content (incl. data/vanilla)
mods/      <- drop external mods here
saves/     <- your campaign .sqlite files
```

- Live content is read from these folders — not from the bundled seed (seed is only used to create them once).
- **Seed-if-missing:** your edits are never overwritten on relaunch. Delete a folder to reset defaults.
- Move the `.exe` to a new folder to get a fresh seed there.

**Debug env vars (optional):**

| Variable | Effect |
|----------|--------|
| `GE_DEBUG_PATHS=1` | Log resolved data/mods/saves paths and seeding decisions |
| `GE_DEBUG=1` | Mirror simulation and player actions to the terminal |
| `GE_DEBUG_VERBOSE=1` | Include per-tick header lines (noisier) |
| `GE_STRICT_SAVE=1` | Strict save validation on load |

The in-game **Debug** page (dev builds only) shows the full persisted activity log.

---

## Project layout

```
src/
  shared/        Domain types, ids, constants, explanations (no Node/React)
  simulation/    Pure deterministic game logic (tick, production, market, …)
  database/      SQLite schema, migrations, repositories, save manager
  mods/          Mod types, Zod schemas, loader, validation, merge
  balance/       Headless balance harness and report formatters
  main/          Electron main process + preload (contextBridge IPC)
  renderer/      React app: pages/ and components/
data/vanilla/    Base game content (the built-in "vanilla" mod)
mods/            External mods (see docs/README.md)
saves/           Local SQLite campaign files (dev; gitignored except .gitkeep)
tests/           Vitest suites (unit + renderer smoke tests)
docs/            Design, economy, modding, persistence, balance, roadmap
```

### UI pages

Dashboard · Star Map · System · Planet · Market · Production · Inventory · Logistics · Mods · Save / Load · Debug (dev only)

### What this slice implements

1. **Shared contracts** (`src/shared/types/`) — `definitions`, `state`, `views`, `api`; every layer uses the IPC `GameApi` surface.
2. **Mod system** — Zod-validated JSON, dependency resolution, merge, reference-integrity checks.
3. **Vanilla content** — 20 items, 12 buildings, 20 recipes, 5 systems, 15 planets, factions, events, objectives, contracts.
4. **Simulation core** (`src/simulation`) — pure TS: production, markets, logistics, extraction, events, deterministic daily tick.
5. **Database** (`src/database`) — SQLite schema, migrations, frozen mod definitions per save.
6. **Electron main + preload** — typed IPC bridge; renderer never touches Node.
7. **React renderer** — all pages above, explanations, autosave status, tutorial hints.
8. **Tests + docs** — headless Vitest; see [`docs/README.md`](docs/README.md).

### Adding a new IPC endpoint

Every `GameApi` method must be wired in six places. `tests/ipc.test.ts` enforces parity between `GameApi` and `HANDLED_METHODS` at compile time (via `payloadFor()`).

| Step | File | What to add |
|------|------|-------------|
| 1 | `src/shared/types/api.ts` | Return/args types + `GameApi` method signature |
| 2 | `src/main/ipcSchemas.ts` | Zod schema (only if the method takes a payload) |
| 3 | `src/main/gameService.ts` | Implementation (delegate to simulation / view query) |
| 4 | `src/main/dispatch.ts` | Entry in `HANDLED_METHODS` + `switch` case |
| 5 | `src/main/preload.ts` | `contextBridge` `api` entry |
| 6 | `tests/ipc.test.ts` | `payloadFor()` sample (missing key = TypeScript error) |

Optional renderer follow-ups: page/component call, `tests/renderer/mockApi.ts` default, smoke test in `tests/renderer/pages.smoke.test.tsx`.

```bash
corepack pnpm scaffold:ipc myNewMethod --payload   # method with args
corepack pnpm scaffold:ipc myNewMethod             # no-arg method
corepack pnpm scaffold:ipc verify                  # GameApi vs HANDLED_METHODS
```

---

## Documentation

| Doc | Topic |
|-----|-------|
| [`docs/README.md`](docs/README.md) | Index and reading order |
| [`docs/DESIGN.md`](docs/DESIGN.md) | Game design and architecture |
| [`docs/ECONOMY.md`](docs/ECONOMY.md) | Economic model and tick pipeline |
| [`docs/MODDING.md`](docs/MODDING.md) | Creating and validating mods |
| [`docs/PERSISTENCE.md`](docs/PERSISTENCE.md) | Saves, schema, adding fields |
| [`docs/BALANCE_ANALYTICS.md`](docs/BALANCE_ANALYTICS.md) | Headless balance runs |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Milestones and planned work |
| [`CHANGELOG.md`](CHANGELOG.md) | Release notes |
