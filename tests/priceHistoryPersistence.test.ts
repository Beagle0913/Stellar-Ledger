import { describe, expect, it } from 'vitest'
import { openDatabase } from '../src/database/db.js'
import { createCampaign, loadCampaign, saveState } from '../src/database/saveManager.js'
import { runTick } from '../src/simulation/tick.js'
import { executeMarketTrade } from '../src/simulation/marketTrade.js'
import type { PriceHistoryRow } from '../src/shared/types.js'
import { loadVanillaDefs } from './helpers.js'

// price_history is persisted INCREMENTALLY (marketRepo.savePriceHistory) rather
// than wiped+reinserted every tick. These tests pin the round-trip behaviour so
// that optimisation can never silently drop or duplicate rows.

function sortRows(rows: PriceHistoryRow[]): PriceHistoryRow[] {
  return [...rows].sort(
    (a, b) =>
      a.tick - b.tick ||
      a.marketId.localeCompare(b.marketId) ||
      a.itemId.localeCompare(b.itemId) ||
      a.price - b.price
  )
}

describe('incremental price history persistence', () => {
  it('round-trips price history across multiple ticks and saves', () => {
    const db = openDatabase(':memory:')
    const state = createCampaign(db, loadVanillaDefs(), 'Persist Campaign')

    for (let i = 0; i < 5; i += 1) {
      runTick(state)
      saveState(db, state)
    }

    const reloaded = loadCampaign(db)
    expect(sortRows(reloaded.priceHistory)).toEqual(sortRows(state.priceHistory))
    expect(reloaded.priceHistory.length).toBe(state.priceHistory.length)
    db.close()
  })

  it('persists rows added at the current tick between saves (instant trades)', () => {
    const db = openDatabase(':memory:')
    const state = createCampaign(db, loadVanillaDefs(), 'Trade Campaign')

    runTick(state)
    saveState(db, state)
    const afterTick = state.priceHistory.length

    // An instant trade records a price-history row at the CURRENT (already
    // persisted) tick. The incremental save must re-sync that tick, not skip it.
    const homeSystemId = state.corporation.homeSystemId
    const itemId = state.definitions.items[0]!.id
    executeMarketTrade(state, { systemId: homeSystemId, itemId, action: 'buy_amount', quantity: 1 })
    expect(state.priceHistory.length).toBeGreaterThan(afterTick)

    saveState(db, state)
    const reloaded = loadCampaign(db)
    expect(sortRows(reloaded.priceHistory)).toEqual(sortRows(state.priceHistory))
    db.close()
  })
})
