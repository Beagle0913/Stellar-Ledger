# Documentation

Start with the root [README](../README.md) for install and commands. These files cover game design, architecture, economy rules, modding, saves, and balance tooling.

## Reading order

| Audience | Start here | Then |
|----------|------------|------|
| Players | [README](../README.md) | [DESIGN.md](DESIGN.md) |
| Content modders | [MODDING.md](MODDING.md) | [ECONOMY.md](ECONOMY.md), [PERSISTENCE.md](PERSISTENCE.md) |
| Contributors | [ARCHITECTURE.md](ARCHITECTURE.md) | [PERSISTENCE.md](PERSISTENCE.md), area-specific docs below |

## Index

| Doc | Contents |
|-----|----------|
| [DESIGN.md](DESIGN.md) | Concept, core loop, product scope |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Layers, IPC registry, services, scaffolds, tests |
| [ECONOMY.md](ECONOMY.md) | Markets, production, tick order, NPC tuning |
| [MODDING.md](MODDING.md) | JSON content, validation, examples |
| [PERSISTENCE.md](PERSISTENCE.md) | SQLite layout, repositories, adding fields |
| [BALANCE_ANALYTICS.md](BALANCE_ANALYTICS.md) | Headless runs, strategies, gates |
| [ROADMAP.md](ROADMAP.md) | Milestone status |
| [CHANGELOG.md](../CHANGELOG.md) | Release notes |

## Vanilla content counts

| | Count | File |
|---|------:|------|
| Items | 20 | `data/vanilla/items.json` |
| Buildings | 12 | `data/vanilla/buildings.json` |
| Recipes | 20 | `data/vanilla/recipes.json` |
| Systems / planets | 100 / ~505 | `systems.json`, `planets.json`, `galaxy-meta.json` |
| Factions / events / objectives | 3 / 7 / 7 | `factions.json`, `events.json`, `objectives.json` |
| Scenarios / NPC corps | 4 / 2 | `scenarios.json`, `npc_corporations.json` |

Also in `data/vanilla/`: contracts, economic profiles, ships, `campaign_start.json`, `economy_config.json`.

Example mods: [`mods/example-expanded-industry/`](../mods/example-expanded-industry/), [`mods/example-star-map/`](../mods/example-star-map/).

## Dev commands

```powershell
corepack pnpm install --frozen-lockfile
npm run rebuild:node
corepack pnpm verify
```

`better-sqlite3` is compiled for Node (tests) or Electron (app). See [README troubleshooting](../README.md#troubleshooting).

| Script | Purpose |
|--------|---------|
| `pnpm verify` | Branding + galaxy check + typecheck + lint + test + balance |
| `pnpm scaffold:ipc verify` | IPC registry ↔ GameApi ↔ dispatch |
| `pnpm scaffold:state <field>` | Checklist for new mutable save fields |

CI (`.github/workflows/ci.yml`): `check` on ubuntu (pnpm), `dist-windows` on windows (pnpm, after check), `release` on green `main` / `v*` tag pushes. Player downloads: [GitHub Releases](../README.md#play-windows).

Pull requests use [`.github/PULL_REQUEST_TEMPLATE.md`](../.github/PULL_REQUEST_TEMPLATE.md) for persistence and IPC checklists.
