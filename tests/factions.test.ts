import { describe, expect, it } from 'vitest'
import { marketIdForSystem } from '../src/shared/ids.js'
import { referencePrice } from '../src/simulation/economyMath.js'
import {
  aggregateMarketRules,
  computePriceMovement,
  factionPriceBias,
  processLocalEconomy
} from '../src/simulation/localEconomy.js'
import { newGame, getSystemByFaction, homeMarketId } from './helpers.js'

describe('faction regional identity', () => {
  it('factionPriceBias reads controlling faction from system definitions', () => {
    const state = newGame()
    expect(factionPriceBias(state, getSystemByFaction('faction_consortium'))).toBe(1.08)
    expect(factionPriceBias(state, getSystemByFaction('faction_frontier'))).toBe(0.92)
  })

  it('consortium-controlled Helion raises food prices more than independents at Vesper under shortage', () => {
    const helion = newGame()
    const vesper = newGame()
    const consortiumSystem = getSystemByFaction('faction_consortium')
    const independentsSystem = getSystemByFaction('faction_independents')
    const helionMarket = marketIdForSystem(consortiumSystem)
    const vesperMarket = marketIdForSystem(independentsSystem)

    const helionFood = aggregateMarketRules(helion, consortiumSystem).find((r) => r.itemId === 'food')!
    const vesperFood = aggregateMarketRules(vesper, independentsSystem).find((r) => r.itemId === 'food')!
    expect(helionFood).toBeDefined()
    expect(vesperFood).toBeDefined()

    helion.localStockpiles = [{ marketId: helionMarket, itemId: 'food', quantity: 50 }]
    vesper.localStockpiles = [{ marketId: vesperMarket, itemId: 'food', quantity: 50 }]

    const helionMove = computePriceMovement(helion, helionMarket, helionFood, 50)
    const vesperMove = computePriceMovement(vesper, vesperMarket, vesperFood, 50)

    expect(helionMove.price).toBeGreaterThan(vesperMove.price)
    expect(helionMove.reason).toBe('npc_demand')
  })

  it('processLocalEconomy applies faction bias on live ticks', () => {
    const state = newGame()
    const marketId = homeMarketId()
    state.localStockpiles = [{ marketId, itemId: 'food', quantity: 80 }]
    const before = referencePrice(state, marketId, 'food')
    processLocalEconomy(state, 1)
    const after = referencePrice(state, marketId, 'food')
    expect(after).toBeGreaterThanOrEqual(before)
  })
})
