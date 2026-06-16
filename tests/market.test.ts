import { describe, expect, it } from 'vitest'
import { cancelOrder, createMarketOrder, matchMarket } from '../src/simulation/market.js'
import { findInventory } from '../src/simulation/economyMath.js'
import { getPlayerCorporation, newGame } from './helpers.js'

describe('market matching', () => {
  it('matches a player buy against NPC liquidity at the midpoint price', () => {
    const state = newGame()
    const home = getPlayerCorporation(state).homeSystemId
    const creditsBefore = getPlayerCorporation(state).credits
    const foodBefore = findInventory(state, getPlayerCorporation(state).id, home, 'food')!.quantity

    // NPC seeds a food sell order at round(15 * 1.1) = 17. Bid above it to cross.
    createMarketOrder(state, {
      systemId: home,
      itemId: 'food',
      side: 'buy',
      quantity: 5,
      price: 20,
      tick: 0
    })
    // Escrowed 5 * 20 = 100 credits up front.
    expect(getPlayerCorporation(state).credits).toBe(creditsBefore - 100)

    const trades = matchMarket(state)
    expect(trades.length).toBeGreaterThan(0)

    const trade = trades.find((t) => t.itemId === 'food')!
    // Midpoint of 20 (buy) and 17 (npc sell) -> round(18.5) = 19.
    expect(trade.price).toBe(19)
    expect(trade.quantity).toBe(5)

    const foodAfter = findInventory(state, getPlayerCorporation(state).id, home, 'food')!.quantity
    expect(foodAfter).toBe(foodBefore + 5)

    // Paid 5 * 19 = 95; escrow refund of 5 returned.
    expect(getPlayerCorporation(state).credits).toBe(creditsBefore - 95)
  })

  it('matches highest buy with lowest sell first', () => {
    const state = newGame()
    const home = getPlayerCorporation(state).homeSystemId
    // Player sells ore; NPC buys ore at round(10 * 0.9) = 9.
    const creditsBefore = getPlayerCorporation(state).credits
    createMarketOrder(state, {
      systemId: home,
      itemId: 'ore',
      side: 'sell',
      quantity: 10,
      price: 5,
      tick: 0
    })
    const trades = matchMarket(state)
    const oreTrade = trades.find((t) => t.itemId === 'ore')
    expect(oreTrade).toBeDefined()
    // Player gains credits for the sold ore.
    expect(getPlayerCorporation(state).credits).toBeGreaterThan(creditsBefore)
  })

  it('rejects sell orders when inventory is insufficient', () => {
    const state = newGame()
    const home = getPlayerCorporation(state).homeSystemId
    const ore = findInventory(state, getPlayerCorporation(state).id, home, 'ore')!
    ore.quantity = 2
    ore.reserved = 0

    expect(() =>
      createMarketOrder(state, {
        systemId: home,
        itemId: 'ore',
        side: 'sell',
        quantity: 10,
        price: 5,
        tick: 0
      })
    ).toThrow(/Not enough Ore to sell here: need 10, have 2/)
  })

  it('rejects buy orders when credits are insufficient', () => {
    const state = newGame()
    getPlayerCorporation(state).credits = 10

    expect(() =>
      createMarketOrder(state, {
        systemId: getPlayerCorporation(state).homeSystemId,
        itemId: 'food',
        side: 'buy',
        quantity: 100,
        price: 50,
        tick: 0
      })
    ).toThrow(/Not enough credits to escrow/)
  })

  it('does not match when the best buy is below the best ask', () => {
    const state = newGame()
    const home = getPlayerCorporation(state).homeSystemId
    const market = state.markets.find((m) => m.systemId === home)!

    // Strip NPC liquidity for ore so we control the book.
    state.orders = state.orders.filter((o) => o.itemId !== 'ore' || o.marketId !== market.id)

    state.orders.push({
      id: 'test-buy',
      marketId: market.id,
      itemId: 'ore',
      side: 'buy',
      quantity: 10,
      remainingQuantity: 10,
      price: 5,
      ownerId: getPlayerCorporation(state).id,
      createdAt: 0
    })
    getPlayerCorporation(state).credits -= 50

    state.orders.push({
      id: 'test-sell',
      marketId: market.id,
      itemId: 'ore',
      side: 'sell',
      quantity: 10,
      remainingQuantity: 10,
      price: 20,
      ownerId: getPlayerCorporation(state).id,
      createdAt: 0
    })
    findInventory(state, getPlayerCorporation(state).id, home, 'ore')!.reserved = 10

    const trades = matchMarket(state)
    expect(trades.filter((t) => t.itemId === 'ore')).toHaveLength(0)
  })

  it('cancelling a buy order refunds the full escrow', () => {
    const state = newGame()
    const home = getPlayerCorporation(state).homeSystemId
    const creditsBefore = getPlayerCorporation(state).credits

    const order = createMarketOrder(state, {
      systemId: home,
      itemId: 'food',
      side: 'buy',
      quantity: 8,
      price: 12,
      tick: 0
    })
    expect(getPlayerCorporation(state).credits).toBe(creditsBefore - 96)

    cancelOrder(state, order.id)
    expect(getPlayerCorporation(state).credits).toBe(creditsBefore)
    expect(state.orders.find((o) => o.id === order.id)).toBeUndefined()
  })

  it('cancelling a sell order releases the inventory reservation', () => {
    const state = newGame()
    const home = getPlayerCorporation(state).homeSystemId
    const ore = findInventory(state, getPlayerCorporation(state).id, home, 'ore')!
    const reservedBefore = ore.reserved

    const order = createMarketOrder(state, {
      systemId: home,
      itemId: 'ore',
      side: 'sell',
      quantity: 25,
      price: 999, // far above any bid so it never matches
      tick: 0
    })
    expect(ore.reserved).toBe(reservedBefore + 25)

    cancelOrder(state, order.id)
    expect(ore.reserved).toBe(reservedBefore)
    expect(state.orders.find((o) => o.id === order.id)).toBeUndefined()
  })

  it('partially fills when buy and sell quantities differ', () => {
    const state = newGame()
    const home = getPlayerCorporation(state).homeSystemId
    const market = state.markets.find((m) => m.systemId === home)!

    state.orders = state.orders.filter((o) => o.itemId !== 'food' || o.marketId !== market.id)

    state.orders.push({
      id: 'big-buy',
      marketId: market.id,
      itemId: 'food',
      side: 'buy',
      quantity: 20,
      remainingQuantity: 20,
      price: 30,
      ownerId: getPlayerCorporation(state).id,
      createdAt: 0
    })
    getPlayerCorporation(state).credits -= 600

    state.orders.push({
      id: 'small-sell',
      marketId: market.id,
      itemId: 'food',
      side: 'sell',
      quantity: 7,
      remainingQuantity: 7,
      price: 10,
      ownerId: getPlayerCorporation(state).id,
      createdAt: 0
    })
    findInventory(state, getPlayerCorporation(state).id, home, 'food')!.reserved = 7

    const trades = matchMarket(state)
    const foodTrade = trades.find((t) => t.itemId === 'food')
    expect(foodTrade?.quantity).toBe(7)
    expect(foodTrade?.price).toBe(20) // midpoint of 30 and 10
  })
})
