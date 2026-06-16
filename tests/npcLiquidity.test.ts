import { describe, expect, it } from 'vitest'
import { npcLiquidityQuantity, mergeEconomyConfig } from '../src/shared/economyConfig.js'
import { NPC_ORDER_QUANTITY } from '../src/shared/constants.js'
import { NPC_OWNER } from '../src/shared/types.js'
import { marketIdForSystem } from '../src/shared/ids.js'
import { createMarketOrder, matchMarket } from '../src/simulation/market.js'
import { syncNpcLiquidityToStockpiles } from '../src/simulation/npcLiquidity.js'
import { setRegionalStockpile } from '../src/simulation/localEconomy.js'
import { newGame } from './helpers.js'

describe('NPC stockpile-scaled liquidity', () => {
  it('reduces NPC sell depth when regional stockpile is low', () => {
    const state = newGame()
    const marketId = marketIdForSystem('sys_helion')
    setRegionalStockpile(state, marketId, 'food', 20)
    syncNpcLiquidityToStockpiles(state)

    const sell = state.orders.find(
      (o) =>
        o.marketId === marketId &&
        o.itemId === 'food' &&
        o.side === 'sell' &&
        o.ownerId === NPC_OWNER
    )!
    expect(sell.remainingQuantity).toBeLessThan(NPC_ORDER_QUANTITY)
    expect(sell.remainingQuantity).toBeGreaterThan(0)
  })

  it('caps player buy volume when NPC sell depth is depleted', () => {
    const state = newGame()
    const home = state.corporation.homeSystemId
    const marketId = marketIdForSystem(home)
    const config = mergeEconomyConfig(undefined)
    const lowDepth = npcLiquidityQuantity(config, 10, 500, 'sell', NPC_ORDER_QUANTITY)
    setRegionalStockpile(state, marketId, 'food', 10)
    syncNpcLiquidityToStockpiles(state)

    const npcSell = state.orders.find(
      (o) => o.marketId === marketId && o.itemId === 'food' && o.side === 'sell' && o.ownerId === NPC_OWNER
    )!
    expect(npcSell.price).toBeGreaterThan(0)

    createMarketOrder(state, {
      systemId: home,
      itemId: 'food',
      side: 'buy',
      quantity: lowDepth + 50,
      price: npcSell.price,
      tick: state.meta.tick
    })

    const trades = matchMarket(state)
    const foodTrade = trades.find((t) => t.itemId === 'food')
    expect(foodTrade?.quantity).toBeLessThanOrEqual(lowDepth + 50)
    expect(foodTrade?.quantity).toBeLessThanOrEqual(npcSell.remainingQuantity + (foodTrade?.quantity ?? 0))
  })
})
