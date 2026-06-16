import { NPC_ORDER_QUANTITY } from '../shared/constants.js'
import { npcLiquidityQuantity } from '../shared/economyConfig.js'
import { NPC_OWNER, type GameState } from '../shared/types.js'
import { aggregateMarketRules, getRegionalStockpile } from './localEconomy.js'

/**
 * Scale NPC order depth to regional stockpiles for profiled items.
 * Non-profiled items keep full base liquidity.
 */
export function syncNpcLiquidityToStockpiles(state: GameState): void {
  const config = state.definitions.economyConfig
  const profiled = new Map<string, ReturnType<typeof aggregateMarketRules>[number]>()

  for (const market of state.markets) {
    for (const rule of aggregateMarketRules(state, market.systemId)) {
      profiled.set(`${market.id}:${rule.itemId}`, rule)
    }
  }

  for (const order of state.orders) {
    if (order.ownerId !== NPC_OWNER) continue
    const rule = profiled.get(`${order.marketId}:${order.itemId}`)
    if (!rule) {
      order.quantity = NPC_ORDER_QUANTITY
      order.remainingQuantity = NPC_ORDER_QUANTITY
      continue
    }
    const stock = getRegionalStockpile(state, order.marketId, order.itemId, rule.targetStockpile)
    const depth = npcLiquidityQuantity(
      config,
      stock,
      rule.targetStockpile,
      order.side,
      NPC_ORDER_QUANTITY
    )
    order.quantity = depth
    order.remainingQuantity = depth
  }
}

/** Restore NPC order depth after matching (stockpile-scaled for profiled items). */
export function replenishNpcLiquidity(state: GameState): void {
  syncNpcLiquidityToStockpiles(state)
}
