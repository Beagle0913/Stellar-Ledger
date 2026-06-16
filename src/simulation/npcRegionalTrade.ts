import type {
  GameState,
  ItemId,
  MarketId,
  SystemId
} from '../shared/types.js'
import {
  aggregateMarketRules,
  getRegionalStockpile,
  setRegionalStockpile
} from './localEconomy.js'
import { referencePrice } from './economyMath.js'

export interface RegionalTrade {
  itemId: ItemId
  fromMarketId: MarketId
  toMarketId: MarketId
  fromSystemId: SystemId
  toSystemId: SystemId
  quantity: number
}

interface MarketItemSnapshot {
  marketId: MarketId
  systemId: SystemId
  rule: ReturnType<typeof aggregateMarketRules>[number]
  stock: number
  price: number
}

/** One pass over markets — O(markets × rulesPerMarket) instead of per-item rescans. */
function buildSnapshotsByItem(state: GameState): Map<ItemId, MarketItemSnapshot[]> {
  const byItem = new Map<ItemId, MarketItemSnapshot[]>()
  for (const market of state.markets) {
    const rules = aggregateMarketRules(state, market.systemId)
    for (const rule of rules) {
      let list = byItem.get(rule.itemId)
      if (!list) {
        list = []
        byItem.set(rule.itemId, list)
      }
      list.push({
        marketId: market.id,
        systemId: market.systemId,
        rule,
        stock: getRegionalStockpile(state, market.id, rule.itemId, rule.targetStockpile),
        price: referencePrice(state, market.id, rule.itemId)
      })
    }
  }
  return byItem
}

function resolveTradePair(
  markets: MarketItemSnapshot[],
  config: GameState['definitions']['economyConfig']
): { from: MarketItemSnapshot; to: MarketItemSnapshot } | null {
  if (markets.length < 2) return null

  let from: MarketItemSnapshot | null = null
  let to: MarketItemSnapshot | null = null

  for (const m of markets) {
    const surplusThreshold = m.rule.targetStockpile * (1 + config.regionalTradeMinSurplusFraction)
    const shortageThreshold = m.rule.targetStockpile * (1 - config.regionalTradeMinShortageFraction)
    if (m.stock > surplusThreshold) {
      if (!from || m.stock - m.rule.targetStockpile > from.stock - from.rule.targetStockpile) {
        from = m
      }
    }
    if (m.stock < shortageThreshold) {
      if (!to || m.rule.targetStockpile - m.stock > to.rule.targetStockpile - to.stock) {
        to = m
      }
    }
  }

  if (!from || !to) {
    const cheapest = markets.reduce((a, b) => (a.price < b.price ? a : b))
    const expensive = markets.reduce((a, b) => (a.price > b.price ? a : b))
    if (cheapest.marketId !== expensive.marketId && cheapest.price > 0) {
      const spreadPct = ((expensive.price - cheapest.price) / cheapest.price) * 100
      if (spreadPct >= config.regionalTradeMinSpreadPercent) {
        from = cheapest
        to = expensive
      }
    }
  }

  if (!from || !to || from.marketId === to.marketId) return null
  return { from, to }
}

/**
 * NPC corporations move goods between regional stockpiles when imbalances or
 * price spreads create arbitrage. Deterministic: same state always yields the
 * same convoys.
 */
export function processNpcRegionalTrade(state: GameState): RegionalTrade[] {
  const config = state.definitions.economyConfig
  if (state.definitions.economicProfiles.length === 0) return []

  const snapshotsByItem = buildSnapshotsByItem(state)
  const trades: RegionalTrade[] = []

  for (const [itemId, markets] of snapshotsByItem) {
    const pair = resolveTradePair(markets, config)
    if (!pair) continue

    const { from, to } = pair
    const surplus =
      from.stock - from.rule.targetStockpile * (1 + config.regionalTradeMinSurplusFraction)
    const deficit = to.rule.targetStockpile - to.stock
    let qty = config.regionalTradeMaxUnitsPerDay
    if (surplus > 0) qty = Math.min(qty, surplus)
    if (deficit > 0) qty = Math.min(qty, deficit)
    qty = Math.floor(qty)
    if (qty <= 0) continue

    setRegionalStockpile(state, from.marketId, itemId, from.stock - qty)
    setRegionalStockpile(state, to.marketId, itemId, to.stock + qty)

    trades.push({
      itemId,
      fromMarketId: from.marketId,
      toMarketId: to.marketId,
      fromSystemId: from.systemId,
      toSystemId: to.systemId,
      quantity: qty
    })
  }

  return trades
}
