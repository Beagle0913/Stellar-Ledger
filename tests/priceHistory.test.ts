import { describe, expect, it } from 'vitest'
import { buildPriceHistory } from '../src/simulation/viewQueries.js'
import { getPlayerCorporation, newGame } from './helpers.js'
import { marketIdForSystem } from '../src/shared/ids.js'
import { pushPriceRow } from '../src/simulation/economyMath.js'

describe('buildPriceHistory', () => {
  it('filters by sinceTick and limit', () => {
    const state = newGame()
    const marketId = marketIdForSystem(getPlayerCorporation(state).homeSystemId)
    for (let t = 1; t <= 20; t += 1) {
      pushPriceRow(state, {
        marketId,
        itemId: 'food',
        tick: t,
        price: 10 + t,
        reason: 'stable'
      })
    }
    const all = buildPriceHistory(state, {
      systemId: getPlayerCorporation(state).homeSystemId,
      itemId: 'food'
    })
    expect(all).toHaveLength(20)

    const since = buildPriceHistory(state, {
      systemId: getPlayerCorporation(state).homeSystemId,
      itemId: 'food',
      sinceTick: 15
    })
    expect(since[0]!.tick).toBe(15)

    const limited = buildPriceHistory(state, {
      systemId: getPlayerCorporation(state).homeSystemId,
      itemId: 'food',
      limit: 5
    })
    expect(limited).toHaveLength(5)
    expect(limited[0]!.tick).toBe(16)
  })
})
