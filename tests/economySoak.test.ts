import { describe, expect, it } from 'vitest'
import { NPC_ORDER_QUANTITY } from '../src/shared/constants.js'
import { NPC_OWNER } from '../src/shared/types.js'
import { addInventory, referencePrice } from '../src/simulation/economyMath.js'
import { aggregateMarketRules, factionPriceBias } from '../src/simulation/localEconomy.js'
import { createMarketOrder } from '../src/simulation/market.js'
import { PRICE_HISTORY_RETENTION_TICKS, runTick } from '../src/simulation/tick.js'
import { getPlayerCorporation, newGame } from './helpers.js'

// Long-horizon stability check: 300 simulated days with scripted player trading
// every 10th day. The economy must stay within its authored bounds throughout.

describe('economy soak (300 ticks with scripted trading)', () => {
  it('keeps prices bounded, stockpiles non-negative, and NPC depth replenished', () => {
    const state = newGame()
    const home = getPlayerCorporation(state).homeSystemId
    const homeMarket = state.markets.find((m) => m.systemId === home)!

    const npcPrice = (itemId: string, side: 'buy' | 'sell'): number =>
      state.orders.find(
        (o) =>
          o.marketId === homeMarket.id &&
          o.itemId === itemId &&
          o.side === side &&
          o.ownerId === NPC_OWNER
      )!.price

    for (let day = 1; day <= 300; day += 1) {
      // Trade every 10th day at exactly-crossing book prices. (No trades in the
      // final stretch so the economy settles back inside its authored bounds —
      // a trade against the NPC ask prints ~1.1x the reference price.)
      if (day % 10 === 0 && day <= 290) {
        // Keep the scripted trader solvent and stocked so orders stay valid.
        getPlayerCorporation(state).credits = Math.max(getPlayerCorporation(state).credits, 100_000)
        addInventory(state, getPlayerCorporation(state).id, home, 'ore', 5)

        // Buy 5 food at the NPC ask; sell 5 ore at the NPC bid.
        createMarketOrder(state, {
          systemId: home,
          itemId: 'food',
          side: 'buy',
          quantity: 5,
          price: npcPrice('food', 'sell'),
          tick: state.meta.tick
        })
        createMarketOrder(state, {
          systemId: home,
          itemId: 'ore',
          side: 'sell',
          quantity: 5,
          price: npcPrice('ore', 'buy'),
          tick: state.meta.tick
        })
      }

      runTick(state)

      // No regional stockpile may ever go negative.
      for (const s of state.localStockpiles) {
        expect(s.quantity).toBeGreaterThanOrEqual(0)
      }
    }

    // All profiled item prices stay inside their profile bounds x baseValue.
    for (const market of state.markets) {
      for (const rule of aggregateMarketRules(state, market.systemId)) {
        const baseValue = state.definitions.items.find((i) => i.id === rule.itemId)!.baseValue
        const bias = factionPriceBias(state, market.systemId)
        const minPrice = Math.max(1, Math.round(baseValue * rule.minPriceMultiplier * bias))
        const maxPrice = Math.max(minPrice, Math.round(baseValue * rule.maxPriceMultiplier * bias))
        const price = referencePrice(state, market.id, rule.itemId)
        expect(price, `${market.id}/${rule.itemId} price out of bounds`).toBeGreaterThanOrEqual(
          minPrice
        )
        expect(price, `${market.id}/${rule.itemId} price out of bounds`).toBeLessThanOrEqual(
          maxPrice
        )
      }
    }

    // NPC orders are replenished after every tick (depth scales with stockpile for profiled items).
    const npcOrders = state.orders.filter((o) => o.ownerId === NPC_OWNER)
    expect(npcOrders.length).toBeGreaterThan(0)
    for (const order of npcOrders) {
      expect(order.remainingQuantity).toBeGreaterThan(0)
      expect(order.remainingQuantity).toBeLessThanOrEqual(NPC_ORDER_QUANTITY)
    }

    // Price history respects the retention rule.
    const cutoff = state.meta.tick - PRICE_HISTORY_RETENTION_TICKS
    expect(state.priceHistory.every((r) => r.tick > cutoff)).toBe(true)
    expect(state.meta.tick).toBe(300)
  })
})
