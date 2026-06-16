import { describe, expect, it } from 'vitest'
import {
  explainMarketChange,
  explainPriceDiagnostics,
  marketExplanationCode
} from '../../src/shared/explanations/market.js'
import { buildItemPriceDiagnostics } from '../../src/shared/economyDiagnostics.js'
import type { MarketChangeEntry } from '../../src/shared/types.js'

const baseChange: MarketChangeEntry = {
  systemId: 'system_sys_helion',
  systemName: 'Helion',
  itemId: 'food',
  itemName: 'Food',
  price: 15,
  previousPrice: 12,
  priceChange: 3,
  priceChangePercent: 25,
  reason: 'shortage',
  reasonLabel: 'Shortage',
  trend: 'rising'
}

describe('marketExplanationCode', () => {
  it('maps rising shortage to market.price.rising.shortage', () => {
    expect(marketExplanationCode('shortage', 'rising')).toBe('market.price.rising.shortage')
  })

  it('maps rising npc_demand to market.price.rising.npc_demand', () => {
    expect(marketExplanationCode('npc_demand', 'rising')).toBe('market.price.rising.npc_demand')
  })

  it('maps falling surplus to market.price.falling.surplus', () => {
    expect(marketExplanationCode('surplus', 'falling')).toBe('market.price.falling.surplus')
  })

  it('maps falling npc_supply to market.price.falling.npc_supply', () => {
    expect(marketExplanationCode('npc_supply', 'falling')).toBe('market.price.falling.npc_supply')
  })

  it('maps trade reason to market.price.changed.trade', () => {
    expect(marketExplanationCode('trade', 'rising')).toBe('market.price.changed.trade')
  })

  it('maps stable to market.price.stable', () => {
    expect(marketExplanationCode('stable', 'stable')).toBe('market.price.stable')
  })
})

describe('explainMarketChange', () => {
  it('includes stockpile details when context provided', () => {
    const ex = explainMarketChange(baseChange, { stockpile: 45, targetStockpile: 250 })
    expect(ex.code).toBe('market.price.rising.shortage')
    expect(ex.severity).toBe('warning')
    expect(ex.message).toContain('Helion')
    expect(ex.message).toContain('Food')
    expect(ex.message).toContain('18%')
    expect(ex.details?.stockpile).toBe(45)
    expect(ex.details?.targetStockpile).toBe(250)
    expect(ex.relatedSystemId).toBe('system_sys_helion')
    expect(ex.relatedItemId).toBe('food')
  })

  it('works without stockpile context', () => {
    const ex = explainMarketChange({ ...baseChange, reason: 'npc_supply', trend: 'falling' })
    expect(ex.code).toBe('market.price.falling.npc_supply')
    expect(ex.message).toContain('NPC production')
  })
})

describe('explainPriceDiagnostics', () => {
  it('returns null when no price history', () => {
    const d = buildItemPriceDiagnostics([], 100)
    expect(
      explainPriceDiagnostics(d, 'sys', 'food', 'Helion', 'Food')
    ).toBeNull()
  })

  it('builds explanation from diagnostics', () => {
    const d = buildItemPriceDiagnostics(
      [
        { tick: 1, price: 10, reason: 'stable' },
        { tick: 2, price: 12, reason: 'shortage' }
      ],
      45
    )
    const ex = explainPriceDiagnostics(
      d,
      'system_sys_helion',
      'food',
      'Helion',
      'Food',
      { stockpile: 45, targetStockpile: 250 }
    )
    expect(ex?.code).toBe('market.price.rising.shortage')
    expect(ex?.message).toContain('45')
    expect(ex?.relatedItemId).toBe('food')
  })
})
