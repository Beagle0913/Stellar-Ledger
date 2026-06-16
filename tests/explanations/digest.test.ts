import { describe, expect, it } from 'vitest'
import { buildTickDigest } from '../../src/shared/explanations/digest.js'
import { TICK_DIGEST_MAX } from '../../src/shared/explanations/types.js'
import { runTick } from '../../src/simulation/tick.js'
import { newGame } from '../helpers.js'

describe('buildTickDigest', () => {
  it('caps digest length', () => {
    const state = newGame()
    const changes = Array.from({ length: 20 }, (_, i) => ({
      systemId: `s${i}`,
      systemName: `Sys${i}`,
      itemId: 'ore',
      itemName: 'Ore',
      price: 10 + i,
      previousPrice: 10,
      priceChange: i,
      priceChangePercent: i,
      reason: 'shortage' as const,
      reasonLabel: 'Shortage',
      trend: 'rising' as const
    }))
    const digest = buildTickDigest(state, { marketChanges: changes, newEvents: [] })
    expect(digest.length).toBeLessThanOrEqual(TICK_DIGEST_MAX)
  })
})

describe('TickResult.explanations', () => {
  it('includes capped explanations after runTick', () => {
    const state = newGame()
    const result = runTick(state)
    expect(result.explanations).toBeDefined()
    expect(result.explanations!.length).toBeLessThanOrEqual(TICK_DIGEST_MAX)
  })
})
