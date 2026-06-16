# Balance Analytics

Headless balance simulation and reporting for the vanilla economy. Runs under Node/Vitest with **no Electron, no SQLite, and no renderer**.

## Running

```bash
# CI-style hard gates (no report files written)
npm run balance

# Full suite including report artifact generation
npm run balance:report
```

Reports are written only by `balance:report` into `reports/balance/` (gitignored).

## Architecture

| Module | Role |
|--------|------|
| [`src/simulation/bootstrap.ts`](../src/simulation/bootstrap.ts) | Pure `buildInitialState` (no DB) |
| [`src/balance/bootstrap.ts`](../src/balance/bootstrap.ts) | Load vanilla defs + create campaign state |
| [`src/balance/harness.ts`](../src/balance/harness.ts) | Day loop: strategy → `runTick` → snapshots |
| [`src/balance/strategies/`](../src/balance/strategies/) | Scripted player policies |
| [`src/balance/metrics.ts`](../src/balance/metrics.ts) | Daily snapshots + run summary |
| [`src/balance/thresholds.ts`](../src/balance/thresholds.ts) | Hard gates (CI) vs warnings (report-only) |

## Player strategies

| ID | Purpose |
|----|---------|
| `idle` | Tick-only baseline (no free wealth) |
| `arcPlay` | First-hour arc: smelt → sell → convoy → 2nd Hauler I |
| `smeltAndSell` | Modest smelt-and-sell loop |
| `smeltAndSellOptimal` | Aggressive smelt-and-sell (Hauler II pacing) |
| `logistics` | Cross-system hauls + minimal smelting |
| `contracts` | Accept and fulfill board contracts |

## Error policy

- **`GameError`** from blocked actions (book won't cross, insufficient inputs) → counted as `failedActions`, run continues.
- **Any other error** → run fails immediately (strategy or simulation bug).

## Hard gates vs warnings

**Hard gates** fail CI (`npm run balance`):

- `no_hauler2_day1`
- `arc_completes` (arcPlay only)
- `no_negative_stockpiles`
- `event_cooldown_respected`
- `no_event_every_tick`
- Strategy-specific gates (idle wealth, modest growth, Hauler II window, etc.)

**Warnings** appear in reports but do **not** fail CI:

- `avgPriceVolatility`, `idleBuildings`, `shipUtilization`
- `explanationTotals`, `stockoutDays`
- `second_hauler1_window_arc`, `no_permanent_critical_shortage`
- `explanations_present_on_activity`

## Report formats

- **Console** — summary via `formatConsoleSummary`
- **JSON (full)** — `formatJsonReport(report)` or `{ includeSnapshots: true }` — meta, summary, gates, warnings, and per-day snapshots
- **JSON (slim)** — `formatJsonReportSummary(report)` or `formatJsonReport(report, { includeSnapshots: false })` — same fields without snapshots (smaller files)
- **Markdown** — gates, milestones, top volatility
- **CSV** — daily time series + optional volatility series

When `npm run balance:report` writes artifacts, it produces both `<strategy>-<timestamp>.json` (full) and `<strategy>-<timestamp>.summary.json` (slim).

## Adding a strategy

1. Implement `PlayerStrategy` in `src/balance/strategies/`.
2. Register in `src/balance/strategies/index.ts`.
3. Add hard gates in `src/balance/thresholds.ts` if needed.
4. Add smoke coverage in `tests/balance/strategies.test.ts`.

Do not import `tests/helpers.ts` from `src/balance/`.
