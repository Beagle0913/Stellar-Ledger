# Stellar Ledger — Galactic Economy Prototype

An original, moddable, single-player **galactic economy / spreadsheet strategy** game.
This repository is a **vertical slice prototype**: it proves the architecture end to
end (data-driven mods → simulation core → SQLite saves → Electron/React UI) rather
than shipping the full game.

---

## Quick start (Windows — just play)

You only need Node.js **once** to build the game. After that, play with a single exe.

1. **Build** — double-click **`Build Game.bat`** (installs deps on first run, then packages).
2. **Play** — double-click **`Play.bat`**, or run **`release\GalacticEconomy.exe`** directly.

Copy `release\GalacticEconomy.exe` anywhere you like (Desktop, USB stick, etc.). On first
launch it creates editable `data/`, `mods/`, and `saves/` folders **beside the exe**.

> No install wizard, no registry entries — one portable exe.

---

- **Single-player, fully local.** No server, no cloud, no accounts, no telemetry.
- **Spreadsheet-first UI.** Dense tables and panels plus a simple 2D **Star Map** trade-network view. No 3D. `getStarMap` IPC also available for mod overlays.
- **Data-driven & moddable.** All content lives in JSON; the base game is a built-in
  mod called `vanilla`.

> Tech: TypeScript (strict) · Electron · React · Vite (`electron-vite`) ·
> better-sqlite3 · Zod · Vitest.

---

## Implementation plan (what this slice builds)

1. **Shared contracts first** (`src/shared/types/`) — domain types split across
   `definitions`, `state`, `views`, and `api` barrels; every layer depends on the IPC `GameApi` surface.
2. **Mod system** — Zod-validated JSON loading, dependency resolution, and merge with
   full reference-integrity checks.
3. **Vanilla content** — 20 items, 12 buildings, 20 recipes, 5 systems, 15 planets,
   factions, events; plus one example external mod.
4. **Simulation core** (`src/simulation`) — pure TS, no Electron/React. Production,
   markets, logistics, extraction, events, and a deterministic daily tick.
5. **Database** (`src/database`) — SQLite schema, migrations, repositories, and a save
   manager that freezes mod definitions into each save.
6. **Electron main + preload** — a single typed IPC bridge; renderer never touches Node.
7. **React renderer** — Dashboard, System, Planet, Market, Production,
   Inventory, Logistics, Star Map, Mods, Save/Load pages.
8. **Tests + docs** — Vitest suites that run headlessly; design/modding/economy docs.

---

## Requirements

- Node.js 22+ (tested on v22).
- `pnpm` via Corepack (ships with Node). This project was developed with `pnpm@11`.

### A note on `pnpm` on this machine

`corepack enable pnpm` failed here with an `EPERM` writing the global shim, so every
command below is shown as **`corepack pnpm …`**, which works without the global shim.
If you have a normal `pnpm` on your `PATH`, you can drop the `corepack` prefix. `npm`
also works as a fallback (`npm install`, `npm test`, `npm run build`, …).

pnpm blocks native build scripts by default; this repo pre-approves the required ones
in `pnpm-workspace.yaml` (`better-sqlite3`, `electron`, `esbuild`), so a plain install
builds them automatically.

---

## Commands

```powershell
# Install dependencies (builds native better-sqlite3 / electron / esbuild binaries)
corepack pnpm install

# Run the headless test suite (pure simulation + an in-memory SQLite round-trip)
corepack pnpm test

# Type-check in strict mode
corepack pnpm typecheck

# Build all three bundles (main / preload / renderer) into out/
corepack pnpm build

# Run the desktop app in development (Vite HMR + Electron)
corepack pnpm dev

# Run a production build from source (no packaging — for developers)
corepack pnpm play

# Launch the packaged portable exe (after `dist` / Build Game.bat)
corepack pnpm run play:portable

# Build portable exe (full pipeline: Electron rebuild, verify, package)
npm run dist

# Preview a production build
corepack pnpm start
```

### Running the GUI: native module ABI note

`corepack pnpm install` builds `better-sqlite3` for the **Node** ABI, which is what the
headless tests use. The Electron runtime uses a **different** ABI, so to launch the
actual desktop app you must rebuild the native module for Electron once:

```powershell
# Rebuild native modules (better-sqlite3) against the project's Electron ABI.
# Uses electron-rebuild with -f (force) and verifies the binary loads under Electron.
corepack pnpm run rebuild:electron

# then start the GUI
corepack pnpm dev
```

After running the GUI, restore the Node ABI build used by the tests:

```powershell
corepack pnpm run rebuild:node   # then `corepack pnpm test` works again
```

> Why two ABIs? `vitest` runs on Node, while the app runs on Electron, and
> `better-sqlite3` is a native addon compiled for one ABI at a time. The two scripts
> above flip the compiled binary between them. (`corepack pnpm install` also restores
> the Node build.)

> The Electron GUI was **not** launched in the development environment (no display).
> Main, preload, and renderer all compile and bundle cleanly, and the full
> create-campaign → tick → save → reload flow is verified headlessly via SQLite tests.

---

## Packaging a portable Windows .exe

Build a single, self-contained portable executable:

```powershell
corepack pnpm run dist
```

Or double-click **`Build Game.bat`** on Windows (runs `npm run dist` with npm/pnpm fallback).

This runs `scripts/dist.mjs`: stop running exe → rebuild `better-sqlite3` for Electron →
build → package → verify native module + exe smoke test → restore Node ABI for tests.

```
release/GalacticEconomy.exe
```

Launch with **`Play.bat`**, `corepack pnpm run play:portable`, or by double-clicking the exe.

**If you see `NODE_MODULE_VERSION 127` vs `130`:** the SQLite native module was built for
Node (tests) instead of Electron. Close any running `GalacticEconomy.exe`, then run
**`Build Game.bat`** again (or `corepack pnpm run dist`).

> Because `dist` rebuilds `better-sqlite3` for Electron's ABI, run
> `corepack pnpm run rebuild:node` afterward if you want `corepack pnpm test` to work
> again (tests use the Node ABI).

### First-run folder behavior (editable content)

The portable exe ships read-only **seed** copies of `data/` and `mods/` inside itself.
The **first time** you run it, the game creates editable folders right next to the
`.exe`:

```
GalacticEconomy-0.1.0-portable.exe
data/      <- editable game content (incl. data/vanilla)
mods/      <- drop external mods here
saves/     <- your campaign .sqlite files
```

- The game reads all live content from these folders beside the exe — never from the
  bundled seed (the seed is used only to create them on first run).
- Seeding is **seed-if-missing**: your edits are never overwritten on later runs. To
  reset to defaults, delete the folder and relaunch.
- Move the `.exe` to a new empty folder and it will seed a fresh set there.

To see resolved paths and seeding decisions while testing, set `GE_DEBUG_PATHS=1`
before launching (logs `baseDir`, `process.resourcesPath`, `dataDir`, `modsDir`,
`savesDir`, and whether data/mods were seeded). Leave it unset for normal play.

For simulation and action logging in the terminal, set `GE_DEBUG=1` on the main
process. Add `GE_DEBUG_VERBOSE=1` to include per-tick header lines (noisier). The
in-game **Debug** page shows the full persisted activity log regardless.

---

## Project layout

```
src/
  shared/        Domain types, ids, constants (no Node/React imports)
  simulation/    Pure deterministic game logic (tick, production, market, …)
  database/      SQLite schema, migrations, repositories, save manager
  mods/          Mod types, Zod schemas, loader, validation, merge
  main/          Electron main process + preload (contextBridge IPC)
  renderer/      React app: pages/ and components/
data/vanilla/    Base game content (the built-in "vanilla" mod)
mods/            External mods (example-expanded-industry)
saves/           Local SQLite campaign files (dev)
tests/           Vitest suites (unit + tests/renderer UI smoke tests)
docs/            DESIGN, MODDING, ECONOMY, ROADMAP, PERSISTENCE
```

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

Scaffold snippets for a new method:

```bash
pnpm scaffold:ipc myNewMethod --payload   # method with args
pnpm scaffold:ipc myNewMethod             # no-arg method
pnpm scaffold:ipc verify                  # GameApi vs HANDLED_METHODS
```

UI smoke tests (mock `window.api` via `vi.mock` on `src/renderer/api.js`):

```bash
pnpm test tests/renderer
```

See [`docs/DESIGN.md`](docs/DESIGN.md) for the game design, [`docs/ECONOMY.md`](docs/ECONOMY.md)
for the economic model (including the market trade-price rule), and
[`docs/MODDING.md`](docs/MODDING.md) to make a mod.
