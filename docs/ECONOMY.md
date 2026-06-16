# ECONOMY

This document describes the economic model of the prototype and **documents the market
trade-price choice** required by the spec.

> **See also:** [DESIGN.md](DESIGN.md) (core loop) · [MODDING.md](MODDING.md) (content JSON) ·
> [BALANCE_ANALYTICS.md](BALANCE_ANALYTICS.md) · [README — Commands](../README.md#commands)

## Items

Items are defined in `data/vanilla/items.json`. Each item has:

- `id` — unique, lowercase identifier (never hardcoded in logic).
- `name` — display name.
- `category` — `raw | refined | component | good | energy | special`.
- `baseValue` — anchor price in credits, used to seed markets and value inventory.
- `volume` — cargo volume per unit, used by logistics capacity checks.

The 20 vanilla items span the full chain: raw (`ore`, `rare_ore`, `water`, `biomass`),
energy (`energy`), refined (`metal`, `alloys`, `chemicals`, `fuel`), components
(`electronics`, `machinery`, `construction_materials`, `ship_parts`, `industrial_tools`),
and goods (`food`, `consumer_goods`, `medical_supplies`, `luxury_goods`,
`research_equipment`, `habitat_modules`).

## Production

Buildings (`buildings.json`) run recipes (`recipes.json`). A recipe declares its
`buildingType`, `inputs`, `outputs`, and `duration` (in days/ticks).

- **Inputs are consumed when a job starts.** Outputs are created when it completes.
- A job has a `quantity` (number of recipe runs); inputs and outputs scale linearly
  with it, while the batch still takes the recipe's base `duration`.
- Inputs/outputs are drawn from / deposited into the inventory of the **system the
  building's planet is in**.

### Extraction & planet stats

Extraction recipes (`"extraction": true`) represent mining, water/biomass harvesting,
and power generation. Their output is scaled by a planet stat declared **in data** via
`yieldStat` (`mineralRichness | fertility | energyPotential | habitability`). This
keeps the simulation data-driven — `extraction.ts` reads `planet[recipe.yieldStat]`
and never references item names. A floor multiplier (0.25) guarantees a trickle even
on poorly-suited worlds.

Example chains:

```
energy (power plant, scaled by energyPotential)
ore  + energy            -> metal
metal + chemicals + energy -> alloys
rare_ore + chemicals + energy -> electronics
metal + electronics      -> machinery
metal + machinery        -> construction_materials
alloys + electronics + machinery -> ship_parts
chemicals + food         -> medical_supplies
construction_materials + machinery -> habitat_modules
```

## Markets

Each star system has exactly **one local market**. Orders have:

`id, marketId, itemId, side (buy|sell), quantity, remainingQuantity, price,
ownerId (corp id or "npc"), createdAt`.

NPC orders provide baseline liquidity: for every item, an NPC sell order is seeded at
`round(referencePrice * 1.1)` and an NPC buy order at `round(referencePrice * 0.9)`.
Each NPC order is backed by `NPC_ORDER_QUANTITY` (1000) units. After matching each
tick, depleted NPC depth is **replenished** so liquidity never permanently drains.

### Order placement

- **Sell orders** reserve the corresponding inventory in the market's system.
- **Buy orders** escrow credits (`quantity * price`) up front.

### Matching

Matching runs during the tick (step 4). For each market+item:

1. Sort buy orders by **highest price first**, sell orders by **lowest price first**
   (ties broken by creation order for determinism).
2. While the best buy price ≥ the best sell price, execute a trade for the minimum of
   the two remaining quantities.

### Trade-price rule — **MIDPOINT** (documented choice)

> When a buy order at price *B* crosses a sell order at price *S* (with *B ≥ S*), the
> trade settles at the **midpoint**: `price = round((B + S) / 2)`.

**Why midpoint?** It is symmetric and fair to both sides, prevents either party from
capturing the entire spread merely by being matched, and produces stable, readable
price history. The alternative (settling at the resting sell price) advantages
aggressive buyers and makes prices noisier. The rule is encoded by
`TRADE_PRICE_RULE = 'midpoint'` in `src/shared/constants.ts` and applied in
`src/simulation/market.ts` (`executeTrade`).

When a player buy settles below its escrow price, the difference is refunded; a player
sell is paid the trade price for the delivered (reserved) goods.

### Price history

After matching (step 7), one `price_history` row is recorded per traded item per market
using that tick's trade price. Economy-driven price rows (step 3) are written earlier for
profiled items; trade rows override the reference price for items that traded this tick.
Player↔NPC trades adjust regional stockpiles (step 5): buying draws stock down, selling
adds stock. `referencePrice()` returns the latest recorded price, or
the item's `baseValue` if it has never traded.

**Retention:** only the most recent **365 ticks** of price history are kept per
market+item. At the end of every tick, rows older than `tick - 365` are pruned. The
latest row per market+item always survives, so reference prices are unaffected; only
the visible chart depth is bounded (and save files stay small).

## Logistics

Ships have `cargoCapacity`, `fuelUsePerDistance`, `speed`, and a current system.
Distance between systems is the (scaled) Euclidean distance on the star map.

A transport job:

- validates cargo fits capacity (`quantity * item.volume`),
- reserves the cargo at the origin and **burns fuel immediately**
  (`ceil(distance * fuelUsePerDistance)`),
- advances by the ship's `speed` each tick; on arrival the reserved goods move from the
  origin system to the destination system and the ship relocates.

A **running** transport job can be cancelled: the reserved cargo is released back to the
origin system's free inventory and the job never delivers. The fuel burned at dispatch
is **not refunded** — fuel is consumed the moment the ship departs.

## The tick

`runTick(state)` advances exactly one day and is deterministic. Steps, in order:

1. process production jobs
2. process transport jobs
3. process local economy (daily flows + price pressure for profiled items)
4. process population dynamics (food security → growth/decline on live planet counts)
5. NPC regional trade (convoys move goods between surplus and shortage markets)
6. sync NPC order depth to regional stockpiles (profiled items only)
7. match market orders
8. apply player trades to regional stockpiles
9. replenish NPC order depth (stockpile-scaled for profiled items)
10. record trade price history
11. trigger events
12. (persistence is handled by the caller / save manager)

A `ticking` guard flag on the campaign meta protects against accidental re-entry, and
the tick number increments atomically once all steps succeed.

## Regional economy depth

### Stockpile-scaled NPC liquidity

For items covered by an **economic profile**, NPC buy/sell depth is no longer infinite.
Each tick, order quantity is set from the regional stockpile vs target:

- **NPC sell** (player buys): depth scales with stock on hand — shortages limit how much
  the region can export to you.
- **NPC buy** (player sells): depth rises when the region is in surplus.

Non-profiled items keep the full `NPC_ORDER_QUANTITY` (1000) backing. Tunables live in
`data/vanilla/economy_config.json` (`npcLiquidityMinFraction`, `npcLiquidityMaxFraction`).

### NPC regional trade

After daily flows, the simulation moves goods between markets when:

- one market has surplus stock (above target × `regionalTradeMinSurplusFraction`), and
- another has shortage (below target × `regionalTradeMinShortageFraction`), **or**
- price spread exceeds `regionalTradeMinSpreadPercent`.

Volume per item per tick is capped by `regionalTradeMaxUnitsPerDay`. This creates
cross-system arbitrage opportunities for the player without infinite NPC liquidity.

### Population dynamics

Each planet has a **live population** (saved separately from frozen definitions).
When regional food stockpile (configurable via `populationFoodItemId`) is healthy,
population grows slowly; during shortages it declines. Live population feeds
`perCapitaConsumptionPerDay` in economic profiles, so demand can rise over a long campaign.

### Mod tuning

Optional `economy_config.json` in any mod merges field-by-field (later mods in load order
win). See `docs/MODDING.md`.

## Player market shortcuts

The Market page supports **quick trades** against NPC liquidity:

- **Preview** (`previewMarketTrade`) — read-only check of quantity, price, and affordability.
- **Execute** (`executeMarketTrade`) — sell at best bid or buy at best ask in one step.

These use the same matching and midpoint pricing rules as resting orders.

## Smart time advance

The Dashboard exposes `runTicksSmart` with modes `production`, `transport`, and `changes`.
Each mode advances day-by-day until a stop condition is met or **30 days** elapse (whichever
comes first). Saves run once at the end, same as `runTicks(n)`.

## Balance analytics

Automated headless simulations (`src/balance/`) run scripted player strategies against the
vanilla economy and evaluate hard gates (arc completion, stockpile bounds, event cooldowns,
etc.). See [`docs/BALANCE_ANALYTICS.md`](BALANCE_ANALYTICS.md).
