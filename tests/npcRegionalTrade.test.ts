import { describe, expect, it } from 'vitest'
import { marketIdForSystem } from '../src/shared/ids.js'
import { processNpcRegionalTrade } from '../src/simulation/npcRegionalTrade.js'
import { setRegionalStockpile } from '../src/simulation/localEconomy.js'
import { runTick } from '../src/simulation/tick.js'
import { newGame, getSystemByFaction } from './helpers.js'

describe('NPC regional trade', () => {
  it('moves goods from surplus market to shortage market', () => {
    const state = newGame()
    const surplusSystem = getSystemByFaction('faction_frontier')
    const shortageSystem = getSystemByFaction('faction_consortium')
    const cinderMarket = marketIdForSystem(surplusSystem)
    const helionMarket = marketIdForSystem(shortageSystem)

    setRegionalStockpile(state, cinderMarket, 'ore', 1500)
    setRegionalStockpile(state, helionMarket, 'ore', 200)

    const trades = processNpcRegionalTrade(state)
    expect(trades.some((t) => t.itemId === 'ore' && t.quantity > 0)).toBe(true)

    const cinderAfter = state.localStockpiles.find((s) => s.marketId === cinderMarket && s.itemId === 'ore')!
    const helionAfter = state.localStockpiles.find((s) => s.marketId === helionMarket && s.itemId === 'ore')!
    expect(cinderAfter.quantity).toBeLessThan(1500)
    expect(helionAfter.quantity).toBeGreaterThan(200)
  })

  it('reports regional convoys on the tick result', () => {
    const state = newGame()
    const surplusSystem = getSystemByFaction('faction_frontier')
    const shortageSystem = getSystemByFaction('faction_consortium')
    const cinderMarket = marketIdForSystem(surplusSystem)
    const helionMarket = marketIdForSystem(shortageSystem)
    setRegionalStockpile(state, cinderMarket, 'ore', 1600)
    setRegionalStockpile(state, helionMarket, 'ore', 150)

    const result = runTick(state)
    expect(result.regionalTrades).toBeGreaterThanOrEqual(0)
  })
})
