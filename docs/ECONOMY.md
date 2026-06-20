# Economy

How the simulation handles goods, markets, and the daily tick. Mod format lives in [MODDING.md](MODDING.md); balance runs in [BALANCE_ANALYTICS.md](BALANCE_ANALYTICS.md).

## Items

Defined in `data/vanilla/items.json`: `id`, `name`, `category` (`raw|refined|component|good|energy|special`), `baseValue`, `volume`.

Vanilla runs ore → metal → alloys/components → goods across 20 items. Categories cover raw materials, energy, refined metals, components, and finished goods.

## Production

Buildings run recipes from `recipes.json`. Inputs are consumed when a job **starts**; outputs appear when it **finishes**. Quantity scales inputs/outputs; duration stays the recipe base. Stock is per system (where the building's planet sits).

Extraction recipes set `"extraction": true` and a `yieldStat` (`mineralRichness`, `fertility`, `energyPotential`, `habitability`). Output scales with that planet stat; minimum multiplier 0.25 so barren worlds still trickle.

Typical chain:

```
energy → ore + energy → metal → … → ship_parts, habitat_modules, etc.
```

## Markets

One market per system. Orders: buy/sell, quantity, price, `ownerId`.

Baseline liquidity: for each item, an NPC sell at ~110% reference and buy at ~90%, 1000 units deep, replenished each tick.

Order owners:

| ownerId | Meaning |
|---------|---------|
| `npc` | Abstract regional liquidity (`NPC_OWNER`) |
| `corp_*` | NPC corporation listing surplus or covering shortage |
| player corp id | Your resting orders |

Corp market AI (`npcMarketAI.ts`) keeps at most one open buy or sell per corp/system/item. Surplus → sell near 1.05× reference; shortage → buy near 0.95×. Objective progress counts player production only.

Sell orders reserve inventory. Buy orders escrow credits upfront.

### Matching

Per market and item: highest buys vs lowest sells; trade while bid ≥ ask. Tie-break on creation time for determinism.

### Trade price (midpoint)

When bid *B* crosses ask *S*, settlement is `round((B + S) / 2)`. Encoded as `TRADE_PRICE_RULE = 'midpoint'` in `src/shared/constants.ts`, used in `market.ts`. Symmetric, stable history. Escrow refunds the difference on player buys; player sells get the trade price.

### Price history

Trade rows recorded after matching. Profile-driven price moves happen earlier in the tick. Player↔NPC trades nudge regional stockpiles. `referencePrice()` uses latest row or `baseValue`.

365 ticks retained per market/item; older rows pruned at end of tick. Reference price always kept.

## Logistics

Ships: capacity, fuel per distance, speed, current system. Jobs reserve cargo and burn fuel on dispatch (`ceil(distance × fuelUsePerDistance)`). Ship moves `speed` per tick; arrival moves cargo and relocates the ship.

Cancel a running job: cargo returns at origin, fuel already spent is gone.

## Tick order

`runTick(state)` — one day, deterministic:

1. Finish production jobs (player + NPC)
2. Finish transport jobs (player + NPC)
3. NPC production AI — queue on idle buildings
4. NPC market AI — refresh corp orders
5. NPC logistics AI — up to one haul per NPC corp
6. Local economy (profiles → price pressure)
7. Population (food security → growth/decline)
8. NPC regional trade (abstract inter-market moves)
9. Sync NPC order depth to stockpiles (profiled items)
10. Match orders
11. Apply player trades to stockpiles
12. Replenish NPC depth
13. Record trade prices
14. Events

Persistence is the caller's job.

### Profiles vs NPC corps

`economic_profiles.json` models background regional demand/supply. NPC corps add real buildings, inventory, jobs, corp orders, and ships. Ore `producedPerDay` in profiles was lowered where Helion already mines, to avoid double supply.

Vanilla NPC seeds (`npc_corporations.json`, new campaigns only):

- **Helion Mining** — extractor corp; home system/planet ids in `galaxy-meta.json`
- **Orion Refining** — refiner corp; home system/planet ids in `galaxy-meta.json`

Runtime corp state lives in SQLite; editing JSON later does not touch existing saves.

## Regional depth

**Stockpile-scaled liquidity:** for profiled items, NPC order size follows regional stock vs target. Shortages cap how much you can buy from the region; surpluses cap how much you can sell into it. Other items keep full 1000-unit depth. Tunables in `economy_config.json`.

**Regional trade:** goods move between markets when one side is in surplus and another in shortage, or when price spread exceeds a threshold. Capped per item per day.

**Population:** live counts per planet; food security drives slow growth or decline. Feeds `perCapitaConsumptionPerDay` on profiles.

## UI helpers

**Quick trades:** `previewMarketTrade` / `executeMarketTrade` — hit best bid/ask in one step, same midpoint rules.

**Charts:** `getPriceHistory({ systemId, itemId, sinceTick?, limit? })` for the Market page chart.

**Planner:** `getProductionPlan({ targetItemId, targetQty })` — feasibility from player stock only; no market buys, no auto-queue.

**Smart advance:** `runTicksSmart` modes `production`, `transport`, `changes` — day-by-day until condition or 30-day cap. One save at the end like `runTicks(n)`.

## Balance

Headless strategies in `src/balance/` with hard CI gates (arc completion, stock bounds, NPC order limits, day-100 price caps). See [BALANCE_ANALYTICS.md](BALANCE_ANALYTICS.md).
