import { describe, expect, it } from 'vitest'
import { previewMarketTrade, executeMarketTrade } from '../src/simulation/marketTrade.js'
import { findInventory } from '../src/simulation/economyMath.js'
import { marketIdForSystem } from '../src/shared/ids.js'
import { setRegionalStockpile } from '../src/simulation/localEconomy.js'
import { syncNpcLiquidityToStockpiles } from '../src/simulation/npcLiquidity.js'
import { getPlayerCorporation, newGame } from './helpers.js'

describe('market trade preview', () => {
  it('previews sell max at best bid with fill breakdown', () => {
    const state = newGame()
    const home = getPlayerCorporation(state).homeSystemId
    const marketId = marketIdForSystem(home)
    setRegionalStockpile(state, marketId, 'ore', 800)
    syncNpcLiquidityToStockpiles(state)

    const preview = previewMarketTrade(state, {      systemId: home,
      itemId: 'ore',
      action: 'sell_max'
    })

    expect(preview.quantity).toBeGreaterThan(0)
    expect(preview.estimatedRevenue).toBeGreaterThan(0)
    expect(preview.fillCount).toBeGreaterThan(0)
    expect(preview.averagePrice).toBeGreaterThan(0)
  })

  it('executeMarketTrade matches immediately and updates inventory/credits', () => {
    const state = newGame()
    const home = getPlayerCorporation(state).homeSystemId
    const oreBefore = findInventory(state, getPlayerCorporation(state).id, home, 'ore')!.quantity
    const creditsBefore = getPlayerCorporation(state).credits

    const preview = executeMarketTrade(state, {
      systemId: home,
      itemId: 'ore',
      action: 'sell_amount',
      quantity: 5
    })

    expect(preview.quantity).toBe(5)
    const oreAfter = findInventory(state, getPlayerCorporation(state).id, home, 'ore')!.quantity
    expect(oreAfter).toBe(oreBefore - 5)
    expect(getPlayerCorporation(state).credits).toBeGreaterThan(creditsBefore)
  })
})
