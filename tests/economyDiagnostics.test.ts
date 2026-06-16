import { describe, expect, it } from 'vitest'
import {
  buildItemPriceDiagnostics,
  collectMarketChangesForTick,
  computePriceDelta,
  computePriceTrend,
  formatPriceChange,
  formatPriceReason,
  formatTrendLabel,
  isNotableMarketChange,
  trendTagClass
} from '../src/shared/economyDiagnostics.js'
import type { GameState } from '../src/shared/types.js'
import { newGame } from './helpers.js'

describe('formatPriceReason', () => {
  it('maps reason codes to player-facing labels', () => {
    expect(formatPriceReason('shortage')).toBe('Shortage')
    expect(formatPriceReason('surplus')).toBe('Surplus')
    expect(formatPriceReason('stable')).toBe('Stable')
    expect(formatPriceReason('npc_demand')).toBe('NPC demand')
    expect(formatPriceReason('npc_supply')).toBe('NPC supply')
    expect(formatPriceReason('trade')).toBe('Recent trade')
  })

  it('returns null for missing reasons', () => {
    expect(formatPriceReason(undefined)).toBeNull()
    expect(formatPriceReason(null)).toBeNull()
  })
})

describe('computePriceDelta and trend', () => {
  it('computes signed change and percentage', () => {
    expect(computePriceDelta(110, 100)).toEqual({ change: 10, percentChange: 10 })
    expect(computePriceDelta(90, 100)).toEqual({ change: -10, percentChange: -10 })
  })

  it('handles missing previous price', () => {
    expect(computePriceDelta(10, null)).toEqual({ change: null, percentChange: null })
    expect(computePriceTrend(10, null)).toBe('unknown')
  })

  it('classifies rising, falling, and stable trends', () => {
    expect(computePriceTrend(12, 10)).toBe('rising')
    expect(computePriceTrend(8, 10)).toBe('falling')
    expect(computePriceTrend(10, 10)).toBe('stable')
  })
})

describe('formatPriceChange', () => {
  it('formats signed currency and percent', () => {
    expect(formatPriceChange(5, 10)).toBe('+5 cr (+10.0%)')
    expect(formatPriceChange(-3, -6)).toBe('-3 cr (-6.0%)')
    expect(formatPriceChange(null, null)).toBe('—')
  })
})

describe('buildItemPriceDiagnostics', () => {
  it('returns empty diagnostics when history is missing', () => {
    expect(buildItemPriceDiagnostics([], 500)).toEqual({
      currentPrice: null,
      previousPrice: null,
      priceChange: null,
      priceChangePercent: null,
      trend: 'unknown',
      latestReason: null,
      latestReasonLabel: null,
      npcStockpile: 500
    })
  })

  it('derives change, trend, reason, and stockpile from history', () => {
    const d = buildItemPriceDiagnostics(
      [
        { tick: 1, price: 10, reason: 'stable' },
        { tick: 2, price: 12, reason: 'shortage' }
      ],
      42
    )
    expect(d.currentPrice).toBe(12)
    expect(d.previousPrice).toBe(10)
    expect(d.priceChange).toBe(2)
    expect(d.trend).toBe('rising')
    expect(d.latestReasonLabel).toBe('Shortage')
    expect(d.npcStockpile).toBe(42)
  })
})

describe('isNotableMarketChange', () => {
  it('filters stable and zero-change rows', () => {
    expect(isNotableMarketChange('stable', 0)).toBe(false)
    expect(isNotableMarketChange('stable', 1)).toBe(false)
    expect(isNotableMarketChange('shortage', 2)).toBe(true)
    expect(isNotableMarketChange('trade', 0)).toBe(true)
  })
})

describe('collectMarketChangesForTick', () => {
  it('returns only notable changes for the requested tick', () => {
    const state = newGame()
    const marketId = state.markets[0]!.id
    state.priceHistory.push({ marketId, itemId: 'food', tick: 1, price: 10, reason: 'stable' })
    state.priceHistory.push({ marketId, itemId: 'food', tick: 2, price: 12, reason: 'shortage' })
    state.priceHistory.push({ marketId, itemId: 'ore', tick: 2, price: 5, reason: 'stable' })

    const changes = collectMarketChangesForTick(state, 2)
    expect(changes).toHaveLength(1)
    expect(changes[0]!.itemId).toBe('food')
    expect(changes[0]!.reasonLabel).toBe('Shortage')
    expect(changes[0]!.priceChange).toBe(2)
  })

  it('sorts by largest absolute percent move first', () => {
    const state = newGame() as GameState
    const marketId = state.markets[0]!.id
    state.priceHistory.push({ marketId, itemId: 'food', tick: 1, price: 100, reason: 'stable' })
    state.priceHistory.push({ marketId, itemId: 'ore', tick: 1, price: 10, reason: 'stable' })
    state.priceHistory.push({ marketId, itemId: 'food', tick: 3, price: 110, reason: 'shortage' })
    state.priceHistory.push({ marketId, itemId: 'ore', tick: 3, price: 15, reason: 'surplus' })

    const changes = collectMarketChangesForTick(state, 3)
    expect(changes.map((c) => c.itemId)).toEqual(['ore', 'food'])
  })
})

describe('trendTagClass', () => {
  it('maps trends to tag colors', () => {
    expect(trendTagClass('rising')).toContain('green')
    expect(trendTagClass('falling')).toContain('red')
    expect(formatTrendLabel('unknown')).toBe('—')
  })
})
