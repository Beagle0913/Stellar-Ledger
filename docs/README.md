# Documentation

Guides for **Stellar Ledger** (galactic economy prototype). Start with the root
[`README.md`](../README.md) for install, build, and day-to-day commands.

## Reading order

| Doc | Audience | What it covers |
|-----|----------|----------------|
| [DESIGN.md](DESIGN.md) | Everyone | Game concept, core loop, architecture, explanation layer |
| [ECONOMY.md](ECONOMY.md) | Players & designers | Items, production, markets, logistics, tick pipeline |
| [MODDING.md](MODDING.md) | Mod authors | JSON content files, validation, examples, star map IPC |
| [PERSISTENCE.md](PERSISTENCE.md) | Developers | SQLite schema tiers, autosave, adding new fields |
| [BALANCE_ANALYTICS.md](BALANCE_ANALYTICS.md) | Developers & designers | Headless balance harness, strategies, CI gates |
| [ROADMAP.md](ROADMAP.md) | Contributors | Milestone status and planned work |
| [CHANGELOG.md](../CHANGELOG.md) | Everyone | Version history and notable changes |

## Example mods

| Folder | Purpose |
|--------|---------|
| [`mods/example-expanded-industry/`](../mods/example-expanded-industry/) | Adds items, a building, and recipes on top of vanilla |
| [`mods/example-star-map/`](../mods/example-star-map/) | Documents the `getStarMap` IPC for external tools |

## Quick links

- **Repository:** [github.com/Beagle0913/Stellar-Ledger](https://github.com/Beagle0913/Stellar-Ledger)
- **Vanilla content:** `data/vanilla/` (20 items, 12 buildings, 20 recipes, 5 systems, 15 planets)
- **CI:** `.github/workflows/ci.yml` — typecheck, lint, tests, Windows portable build
