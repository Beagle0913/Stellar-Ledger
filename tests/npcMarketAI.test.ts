import { describe, expect, it } from 'vitest'
import { marketIdForSystem } from '../src/shared/ids.js'
import { NPC_OWNER } from '../src/shared/types.js'
import { getNpcCorporations } from '../src/simulation/corporations.js'
import { availableQuantity, findInventory } from '../src/simulation/economyMath.js'
import { processNpcMarketAI } from '../src/simulation/npcMarketAI.js'
import { runTick } from '../src/simulation/tick.js'
import type { GameState } from '../src/shared/types.js'
import { newGame } from './helpers.js'

function snapshotCorpOrders(state: GameState) {
  const npcIds = new Set(getNpcCorporations(state).map((c) => c.id))
  return state.orders
    .filter((o) => npcIds.has(o.ownerId) && o.remainingQuantity > 0)
    .map((o) => ({
      ownerId: o.ownerId,
      marketId: o.marketId,
      itemId: o.itemId,
      side: o.side,
      price: o.price,
      remainingQuantity: o.remainingQuantity
    }))
    .sort(
      (a, b) =>
        a.ownerId.localeCompare(b.ownerId) ||
        a.marketId.localeCompare(b.marketId) ||
        a.itemId.localeCompare(b.itemId) ||
        a.side.localeCompare(b.side)
    )
}

describe('npcMarketAI', () => {
  it('places sell orders when an NPC corp has surplus inventory', () => {
    const state = newGame()
    const helion = getNpcCorporations(state).find((c) => c.id === 'corp_helion_mining')!
    const marketId = marketIdForSystem(helion.homeSystemId)
    processNpcMarketAI(state)
    const oreSell = state.orders.find(
      (o) =>
        o.ownerId === helion.id &&
        o.marketId === marketId &&
        o.itemId === 'ore' &&
        o.side === 'sell' &&
        o.remainingQuantity > 0
    )
    expect(oreSell).toBeDefined()
    expect(oreSell!.ownerId).not.toBe(NPC_OWNER)
  })

  it('never creates duplicate open orders for the same corp/system/item/side', () => {
    const state = newGame()
    for (let i = 0; i < 5; i += 1) processNpcMarketAI(state)
    const keys = new Set<string>()
    for (const order of state.orders) {
      if (order.ownerId === NPC_OWNER || order.remainingQuantity <= 0) continue
      const key = `${order.ownerId}:${order.marketId}:${order.itemId}:${order.side}`
      expect(keys.has(key)).toBe(false)
      keys.add(key)
    }
  })

  it('reserves NPC inventory for sell orders (not player stock)', () => {
    const state = newGame()
    const helion = getNpcCorporations(state).find((c) => c.id === 'corp_helion_mining')!
    const oreBefore = availableQuantity(
      findInventory(state, helion.id, helion.homeSystemId, 'ore')
    )
    processNpcMarketAI(state)
    const oreAfter = availableQuantity(findInventory(state, helion.id, helion.homeSystemId, 'ore'))
    expect(oreAfter).toBeLessThan(oreBefore)
  })

  it('produces identical corp order books after N ticks from the same start', () => {
    const a = newGame()
    const b = structuredClone(a) as GameState
    for (let i = 0; i < 15; i += 1) {
      runTick(a)
      runTick(b)
    }
    expect(snapshotCorpOrders(a)).toEqual(snapshotCorpOrders(b))
  })
})
