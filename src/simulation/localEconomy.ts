import type {
  EconomicProfileItemRule,
  GameState,
  ItemId,
  LocalStockpileRow,
  MarketId,
  MarketOrder,
  PriceMovementReason,
  SystemId
} from '../shared/types.js'
import { NPC_OWNER } from '../shared/types.js'
import { pushPriceRow, referencePrice } from './economyMath.js'
import { planetPopulation, populationGeneration } from './planetPopulation.js'
import {
  factionById,
  itemById,
  marketById,
  planetsInSystem,
  profileById,
  systemById
} from './stateIndex.js'
import type { Trade } from './market.js'

/** Per-market item rule after aggregating planet and system economic profiles. */
export interface AggregatedItemRule {
  itemId: ItemId
  consumedPerDay: number
  producedPerDay: number
  targetStockpile: number
  minPriceMultiplier: number
  maxPriceMultiplier: number
  shortagePressureMultiplier: number
  surplusPressureMultiplier: number
}

/** Stockpile within this fraction of target is treated as stable (no price drift). */
export const STABLE_EPSILON = 0.05

/** Base daily price step as a fraction of item base value at full imbalance. */
export const BASE_PRICE_STEP_RATE = 0.03

function mergeItemRule(
  into: AggregatedItemRule,
  rule: EconomicProfileItemRule,
  extraConsumedPerDay = 0
): void {
  into.consumedPerDay += rule.consumedPerDay + extraConsumedPerDay
  into.producedPerDay += rule.producedPerDay
  into.targetStockpile += rule.targetStockpile
  into.minPriceMultiplier = Math.min(into.minPriceMultiplier, rule.minPriceMultiplier)
  into.maxPriceMultiplier = Math.max(into.maxPriceMultiplier, rule.maxPriceMultiplier)
  into.shortagePressureMultiplier = Math.max(
    into.shortagePressureMultiplier,
    rule.shortagePressureMultiplier
  )
  into.surplusPressureMultiplier = Math.max(
    into.surplusPressureMultiplier,
    rule.surplusPressureMultiplier
  )
}

function ruleFromProfileItem(
  rule: EconomicProfileItemRule,
  extraConsumedPerDay = 0
): AggregatedItemRule {
  return {
    itemId: rule.itemId,
    consumedPerDay: rule.consumedPerDay + extraConsumedPerDay,
    producedPerDay: rule.producedPerDay,
    targetStockpile: rule.targetStockpile,
    minPriceMultiplier: rule.minPriceMultiplier,
    maxPriceMultiplier: rule.maxPriceMultiplier,
    shortagePressureMultiplier: rule.shortagePressureMultiplier,
    surplusPressureMultiplier: rule.surplusPressureMultiplier
  }
}

function computeMarketRules(state: GameState, systemId: SystemId): AggregatedItemRule[] {
  const byItem = new Map<ItemId, AggregatedItemRule>()

  const system = systemById(state, systemId)
  if (system?.economicProfileId) {
    const profile = profileById(state, system.economicProfileId)
    if (profile) {
      for (const rule of profile.items) {
        const existing = byItem.get(rule.itemId)
        if (existing) mergeItemRule(existing, rule)
        else byItem.set(rule.itemId, ruleFromProfileItem(rule))
      }
    }
  }

  // Only iterate planets in THIS system (indexed) rather than the whole galaxy.
  for (const planet of planetsInSystem(state, systemId)) {
    if (!planet.economicProfileId) continue
    const profile = profileById(state, planet.economicProfileId)
    if (!profile) continue
    for (const rule of profile.items) {
      // Population-driven demand: layered on top of the authored flat rate.
      const perCapita = planetPopulation(state, planet.id) * (rule.perCapitaConsumptionPerDay ?? 0)
      const existing = byItem.get(rule.itemId)
      if (existing) mergeItemRule(existing, rule, perCapita)
      else byItem.set(rule.itemId, ruleFromProfileItem(rule, perCapita))
    }
  }

  return [...byItem.values()]
}

// Memo of per-system aggregated rules. The result depends only on frozen
// definitions plus live populations, so it is cached and reused until any
// population changes (tracked by populationGeneration). The same array instance
// is handed back to all callers within a generation — callers must treat the
// returned rules as read-only.
interface RuleMemo {
  generation: number
  bySystem: Map<SystemId, AggregatedItemRule[]>
}
const ruleMemo = new WeakMap<GameState, RuleMemo>()

/** Collect and sum economic profile rules for all planets and the system itself. */
export function aggregateMarketRules(state: GameState, systemId: SystemId): AggregatedItemRule[] {
  const generation = populationGeneration(state)
  let memo = ruleMemo.get(state)
  if (!memo || memo.generation !== generation) {
    memo = { generation, bySystem: new Map() }
    ruleMemo.set(state, memo)
  }
  let rules = memo.bySystem.get(systemId)
  if (!rules) {
    rules = computeMarketRules(state, systemId)
    memo.bySystem.set(systemId, rules)
  }
  return rules
}

/** Set NPC order prices around the reference price for a single order. */
function applyNpcOrderPrice(order: MarketOrder, ref: number): void {
  if (order.side === 'sell') {
    order.price = Math.round(ref * 1.1)
  } else {
    order.price = Math.max(1, Math.round(ref * 0.9))
  }
}

/** Apply one day of regional consumption and production to a stockpile. Never negative. */
export function applyDailyFlows(quantity: number, rule: AggregatedItemRule): number {
  return Math.max(0, quantity + rule.producedPerDay - rule.consumedPerDay)
}

function itemBaseValue(state: GameState, itemId: ItemId): number {
  return itemById(state, itemId)?.baseValue ?? 0
}

/** Faction price bias for a system (1.0 when uncontrolled or unknown). */
export function factionPriceBias(state: GameState, systemId: string): number {
  const system = systemById(state, systemId)
  if (!system?.controllingFactionId) return 1
  return factionById(state, system.controllingFactionId)?.priceBias ?? 1
}

function clampPrice(price: number, minPrice: number, maxPrice: number): number {
  return Math.max(minPrice, Math.min(maxPrice, price))
}

/**
 * Compute the next reference price and movement reason from stockpile vs target.
 * Deterministic: same inputs always yield the same output.
 */
export function computePriceMovement(
  state: GameState,
  marketId: MarketId,
  rule: AggregatedItemRule,
  stockpile: number
): { price: number; reason: PriceMovementReason } {
  const market = marketById(state, marketId)
  const bias = market ? factionPriceBias(state, market.systemId) : 1
  const baseValue = itemBaseValue(state, rule.itemId)
  const currentPrice = referencePrice(state, marketId, rule.itemId)
  const minPrice = Math.max(1, Math.round(baseValue * rule.minPriceMultiplier * bias))
  const maxPrice = Math.max(minPrice, Math.round(baseValue * rule.maxPriceMultiplier * bias))

  if (rule.targetStockpile <= 0) {
    return { price: currentPrice, reason: 'stable' }
  }

  const imbalance = (rule.targetStockpile - stockpile) / rule.targetStockpile

  if (Math.abs(imbalance) < STABLE_EPSILON) {
    return { price: currentPrice, reason: 'stable' }
  }

  if (imbalance > 0) {
    const rawStep =
      baseValue * BASE_PRICE_STEP_RATE * imbalance * rule.shortagePressureMultiplier
    const step = Math.max(1, Math.round(rawStep))
    const price = clampPrice(Math.round((currentPrice + step) * bias), minPrice, maxPrice)
    const reason: PriceMovementReason =
      rule.consumedPerDay > 0 ? 'npc_demand' : 'shortage'
    return { price, reason }
  }

  const rawStep =
    baseValue * BASE_PRICE_STEP_RATE * Math.abs(imbalance) * rule.surplusPressureMultiplier
  const step = Math.max(1, Math.round(rawStep))
  const price = clampPrice(Math.round((currentPrice - step) * bias), minPrice, maxPrice)
  const reason: PriceMovementReason = rule.producedPerDay > 0 ? 'npc_supply' : 'surplus'
  return { price, reason }
}

// Stockpile lookup index: keyed by `${marketId}:${itemId}` -> the live row in
// state.localStockpiles. Lazily built and kept in sync by setRegionalStockpile.
// Guards on array identity so it rebuilds automatically when state.localStockpiles
// is replaced wholesale (e.g. loaded from disk, or reset by initLocalStockpiles).
interface StockpileIndex {
  array: LocalStockpileRow[]
  map: Map<string, LocalStockpileRow>
}
const stockpileIndex = new WeakMap<GameState, StockpileIndex>()

function stockpileKey(marketId: MarketId, itemId: ItemId): string {
  return `${marketId}:${itemId}`
}

function stockpileMap(state: GameState): Map<string, LocalStockpileRow> {
  let idx = stockpileIndex.get(state)
  if (!idx || idx.array !== state.localStockpiles) {
    const map = new Map<string, LocalStockpileRow>()
    for (const row of state.localStockpiles) map.set(stockpileKey(row.marketId, row.itemId), row)
    idx = { array: state.localStockpiles, map }
    stockpileIndex.set(state, idx)
  }
  return idx.map
}

function findStockpile(
  state: GameState,
  marketId: MarketId,
  itemId: ItemId
): LocalStockpileRow | undefined {
  return stockpileMap(state).get(stockpileKey(marketId, itemId))
}

/** Regional stockpile quantity, or the aggregated target when no row exists yet. */
export function getRegionalStockpile(
  state: GameState,
  marketId: MarketId,
  itemId: ItemId,
  fallbackTarget = 0
): number {
  const row = findStockpile(state, marketId, itemId)
  if (row) return row.quantity
  return fallbackTarget
}

export function setRegionalStockpile(
  state: GameState,
  marketId: MarketId,
  itemId: ItemId,
  quantity: number
): void {
  const row = findStockpile(state, marketId, itemId)
  const qty = Math.max(0, quantity)
  if (row) {
    row.quantity = qty
  } else {
    const created: LocalStockpileRow = { marketId, itemId, quantity: qty }
    state.localStockpiles.push(created)
    stockpileMap(state).set(stockpileKey(marketId, itemId), created)
  }
}

/** Seed regional stockpiles at each market's aggregated target levels. */
export function initLocalStockpiles(state: GameState): void {
  state.localStockpiles = []
  if (state.definitions.economicProfiles.length === 0) return

  for (const market of state.markets) {
    const rules = aggregateMarketRules(state, market.systemId)
    for (const rule of rules) {
      setRegionalStockpile(state, market.id, rule.itemId, rule.targetStockpile)
    }
  }
}

function isProfiledItem(state: GameState, marketId: MarketId, itemId: ItemId): boolean {
  const market = marketById(state, marketId)
  if (!market) return false
  return aggregateMarketRules(state, market.systemId).some((r) => r.itemId === itemId)
}

function stockpileQuantity(
  state: GameState,
  marketId: MarketId,
  itemId: ItemId
): number {
  const market = marketById(state, marketId)
  if (!market) return 0
  const rule = aggregateMarketRules(state, market.systemId).find((r) => r.itemId === itemId)
  return getRegionalStockpile(state, marketId, itemId, rule?.targetStockpile ?? 0)
}

/**
 * Adjust regional stockpiles from player↔NPC trades executed this tick.
 * Player buys draw from the regional stockpile; player sells add to it.
 */
export function applyTradesToLocalStockpiles(state: GameState, trades: Trade[]): void {
  if (state.definitions.economicProfiles.length === 0) return

  for (const trade of trades) {
    if (!trade.playerSide) continue
    if (!isProfiledItem(state, trade.marketId, trade.itemId)) continue

    const delta = trade.playerSide === 'buy' ? -trade.quantity : trade.quantity
    const next = Math.max(0, stockpileQuantity(state, trade.marketId, trade.itemId) + delta)
    setRegionalStockpile(state, trade.marketId, trade.itemId, next)
  }
}

/** Advance local demand/supply pressure for every market with economic profiles. */
export function processLocalEconomy(state: GameState, tick: number): void {
  if (state.definitions.economicProfiles.length === 0) return

  // Group NPC orders by market+item once (O(orders)) instead of re-scanning the
  // whole order book for every rule (which was O(markets × items × orders)).
  const npcOrders = new Map<string, MarketOrder[]>()
  for (const order of state.orders) {
    if (order.ownerId !== NPC_OWNER) continue
    const key = stockpileKey(order.marketId, order.itemId)
    const list = npcOrders.get(key)
    if (list) list.push(order)
    else npcOrders.set(key, [order])
  }

  for (const market of state.markets) {
    const rules = aggregateMarketRules(state, market.systemId)
    for (const rule of rules) {
      const before = getRegionalStockpile(state, market.id, rule.itemId, rule.targetStockpile)
      const stockpile = applyDailyFlows(before, rule)
      setRegionalStockpile(state, market.id, rule.itemId, stockpile)

      const { price, reason } = computePriceMovement(state, market.id, rule, stockpile)
      pushPriceRow(state, {
        marketId: market.id,
        itemId: rule.itemId,
        tick,
        price,
        reason
      })
      const ref = referencePrice(state, market.id, rule.itemId)
      const orders = npcOrders.get(stockpileKey(market.id, rule.itemId))
      if (orders) for (const order of orders) applyNpcOrderPrice(order, ref)
    }
  }
}
