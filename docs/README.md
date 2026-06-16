# Documentation

Guides for **Stellar Ledger** (galactic economy prototype).

**New here?** Start with the root [`README.md`](../README.md) for install, play, and
developer setup. Use this page as the index for deeper docs.

---

## Reading order

| # | Doc | Audience | What it covers |
|---|-----|----------|----------------|
| 1 | [DESIGN.md](DESIGN.md) | Everyone | Game concept, core loop, architecture, explanation layer |
| 2 | [ECONOMY.md](ECONOMY.md) | Players & designers | Items, production, markets, logistics, tick pipeline |
| 3 | [MODDING.md](MODDING.md) | Mod authors | JSON content files, validation, examples, star map IPC |
| 4 | [PERSISTENCE.md](PERSISTENCE.md) | Developers | SQLite schema tiers, autosave, adding new fields |
| 5 | [BALANCE_ANALYTICS.md](BALANCE_ANALYTICS.md) | Developers & designers | Headless balance harness, strategies, CI gates |
| 6 | [ROADMAP.md](ROADMAP.md) | Contributors | Milestone status and planned work |
| 7 | [CHANGELOG.md](../CHANGELOG.md) | Everyone | Version history and notable changes |

The root [`README.md`](../README.md) covers **how to run and build** the project; the
docs above cover **how the game works** and **how to extend it**.

---

## Vanilla content (reference)

| Content | Count | Location |
|---------|-------|----------|
| Items | 20 | `data/vanilla/items.json` |
| Buildings | 12 | `data/vanilla/buildings.json` |
| Recipes | 20 | `data/vanilla/recipes.json` |
| Star systems | 5 | `data/vanilla/systems.json` |
| Planets | 15 | `data/vanilla/planets.json` |
| Factions | 3 | `data/vanilla/factions.json` |
| Events | 7 | `data/vanilla/events.json` |
| Objectives | 7 | `data/vanilla/objectives.json` |

Contract templates, economic profiles, ships, and campaign start config live in the
same `data/vanilla/` folder. See [MODDING.md](MODDING.md) for the full file list.

---

## Example mods

| Folder | Purpose |
|--------|---------|
| [`mods/example-expanded-industry/`](../mods/example-expanded-industry/) | Adds items, a building, and recipes on top of vanilla |
| [`mods/example-star-map/`](../mods/example-star-map/) | Documents the `getStarMap` IPC for external tools |

---

## Developer quick reference

Matches the root README — keep these in sync when scripts change.

```powershell
git clone https://github.com/Beagle0913/Stellar-Ledger.git
cd Stellar-Ledger
corepack pnpm install --frozen-lockfile
npm run rebuild:node          # required after install (postinstall → Electron ABI)
corepack pnpm verify          # typecheck + lint + test + balance
```

| Command | Purpose |
|---------|---------|
| `corepack pnpm verify` | Full local CI check before push |
| `corepack pnpm test` | Vitest (`pretest` fixes Node ABI if needed) |
| `corepack pnpm run rebuild:electron` | Before `pnpm dev` / GUI |
| `corepack pnpm run dist` | Portable `release/GalacticEconomy.exe` |

**Native module note:** `better-sqlite3` is compiled for either Node (tests) or Electron
(GUI). See [README — Troubleshooting](../README.md#troubleshooting).

---

## CI (GitHub Actions)

Workflow: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)

| Job | Runner | Steps |
|-----|--------|-------|
| `check` | ubuntu-latest | install → `rebuild:node` → typecheck → lint → test |
| `dist-windows` | windows-latest | install → `dist` → upload portable exe artifact |

Runs on every push and pull request to `main`.

---

## Quick links

- **Repository:** [github.com/Beagle0913/Stellar-Ledger](https://github.com/Beagle0913/Stellar-Ledger)
- **Actions / portable download:** [Actions tab](https://github.com/Beagle0913/Stellar-Ledger/actions)
- **License:** [MIT](../LICENSE)
