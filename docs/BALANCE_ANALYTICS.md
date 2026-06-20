# Balance analytics

Headless economy runs under Node/Vitest — no Electron, SQLite, or renderer.

```powershell
corepack pnpm balance           # CI gates only
corepack pnpm run balance:report  # also writes reports/balance/ (gitignored)
```

## Layout

| Module | Role |
|--------|------|
| `src/simulation/bootstrap.ts` | Pure `buildInitialState` |
| `src/balance/bootstrap.ts` | Load vanilla defs via `shared/vanillaLoader`, create state |
| `src/balance/harness.ts` | Strategy → tick loop → snapshots |
| `src/balance/strategies/` | Scripted player policies |
| `src/balance/metrics.ts` | Daily snapshots, summary |
| `src/balance/thresholds.ts` | Hard gates vs report-only warnings |

## Strategies

| ID | What it does |
|----|----------------|
| `idle` | Tick only |
| `arcPlay` | First-hour arc path |
| `smeltAndSell` | Basic smelt and sell |
| `smeltAndSellOptimal` | Aggressive smelt/sell |
| `logistics` | Haul-focused |
| `contracts` | Board contracts |

`GameError` from expected blocks (no liquidity, bad inputs) counts as `failedActions` and the run continues. Anything else fails the run — treat as a bug.

## Gates

Hard gates fail `pnpm balance`:

- `no_hauler2_day1`, `arc_completes`, `no_negative_stockpiles`
- `event_cooldown_respected`, `no_event_every_tick`
- Strategy-specific wealth/pacing checks
- NPC soak (idle baseline, ~100 days): `market_not_empty_day_30`, `npc_orders_bounded`, `no_npc_inventory_negative`, `no_price_explosion_day_100`

Warnings (volatility, idle buildings, stockouts, etc.) show in reports only.

## Reports

Console summary; JSON full or slim; Markdown; CSV. `balance:report` writes `<strategy>-<timestamp>.json` and `.summary.json`.

## New strategy

Implement `PlayerStrategy`, register in `src/balance/strategies/index.ts`, add gates in `thresholds.ts` if needed, cover in `tests/balance/strategies.test.ts`. Don't import test helpers from `src/balance/`.
