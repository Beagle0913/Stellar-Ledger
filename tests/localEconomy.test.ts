import { describe, expect, it } from 'vitest'
import { openDatabase } from '../src/database/db.js'
import { createCampaign, loadCampaign, saveState } from '../src/database/saveManager.js'
import { mergeMods } from '../src/mods/mergeMods.js'
import { economicProfilesFileSchema } from '../src/mods/modSchemas.js'
import { ModValidationError, type LoadedMod } from '../src/mods/modTypes.js'
import { marketIdForSystem } from '../src/shared/ids.js'
import { referencePrice } from '../src/simulation/economyMath.js'
import { findInventory } from '../src/simulation/economyMath.js'
import { NPC_ORDER_QUANTITY } from '../src/shared/constants.js'
import { NPC_OWNER } from '../src/shared/types.js'
import { createMarketOrder, matchMarket, replenishNpcLiquidity } from '../src/simulation/market.js'
import {
  aggregateMarketRules,
  applyDailyFlows,
  applyTradesToLocalStockpiles,
  computePriceMovement,
  factionPriceBias,
  initLocalStockpiles,
  processLocalEconomy
} from '../src/simulation/localEconomy.js'
import { runTick } from '../src/simulation/tick.js'
import { setPlanetPopulation } from '../src/simulation/planetPopulation.js'
import { loadVanillaDefs, newGame } from './helpers.js'

function helionMarketId(): string {
  return marketIdForSystem('sys_helion')
}

function cinderMarketId(): string {
  return marketIdForSystem('sys_cinder')
}

describe('local economy', () => {
  it('shortage increases price over ticks', () => {
    const state = newGame()
    const marketId = helionMarketId()
    const rules = aggregateMarketRules(state, 'sys_helion')
    const foodRule = rules.find((r) => r.itemId === 'food')!
    expect(foodRule).toBeDefined()

    // Start below target so daily consumption deepens the shortage.
    state.localStockpiles = [{ marketId, itemId: 'food', quantity: 100 }]
    const startPrice = referencePrice(state, marketId, 'food')

    processLocalEconomy(state, 1)
    const afterOne = referencePrice(state, marketId, 'food')
    expect(afterOne).toBeGreaterThan(startPrice)

    processLocalEconomy(state, 2)
    const afterTwo = referencePrice(state, marketId, 'food')
    expect(afterTwo).toBeGreaterThan(afterOne)

    const row = state.priceHistory.find((h) => h.itemId === 'food' && h.tick === 1)
    expect(row?.reason).toBe('npc_demand')
  })

  it('surplus decreases price over ticks', () => {
    const state = newGame()
    const marketId = cinderMarketId()
    const rules = aggregateMarketRules(state, 'sys_cinder')
    const oreRule = rules.find((r) => r.itemId === 'ore')!
    expect(oreRule.producedPerDay).toBeGreaterThan(0)

    state.localStockpiles = [{ marketId, itemId: 'ore', quantity: 1200 }]
    const startPrice = referencePrice(state, marketId, 'ore')

    processLocalEconomy(state, 1)
    const afterOne = referencePrice(state, marketId, 'ore')
    expect(afterOne).toBeLessThan(startPrice)

    const row = state.priceHistory.find((h) => h.itemId === 'ore' && h.tick === 1)
    expect(row?.reason).toBe('npc_supply')
  })

  it('price changes are bounded by profile multipliers', () => {
    const state = newGame()
    const marketId = helionMarketId()
    const rules = aggregateMarketRules(state, 'sys_helion')
    const foodRule = rules.find((r) => r.itemId === 'food')!
    const baseValue = state.definitions.items.find((i) => i.id === 'food')!.baseValue
    const bias = factionPriceBias(state, 'sys_helion')
    const maxPrice = Math.round(baseValue * foodRule.maxPriceMultiplier * bias)

    state.localStockpiles = [{ marketId, itemId: 'food', quantity: 0 }]
    for (let tick = 1; tick <= 50; tick += 1) {
      processLocalEconomy(state, tick)
    }

    const finalPrice = referencePrice(state, marketId, 'food')
    expect(finalPrice).toBeLessThanOrEqual(maxPrice)
    expect(finalPrice).toBeGreaterThanOrEqual(Math.round(baseValue * foodRule.minPriceMultiplier * bias))
  })

  it('stable market at target stockpile does not drift price', () => {
    const state = newGame()
    const marketId = helionMarketId()
    const rules = aggregateMarketRules(state, 'sys_helion')
    const foodRule = rules.find((r) => r.itemId === 'food')!

    // Balanced flows: produced equals consumed keeps stockpile at target.
    const balancedRule = {
      ...foodRule,
      consumedPerDay: 10,
      producedPerDay: 10
    }
    state.localStockpiles = [{ marketId, itemId: 'food', quantity: foodRule.targetStockpile }]
    const startPrice = referencePrice(state, marketId, 'food')

    for (let tick = 1; tick <= 10; tick += 1) {
      const stock = state.localStockpiles[0]!.quantity
      const nextStock = applyDailyFlows(stock, balancedRule)
      state.localStockpiles[0]!.quantity = nextStock
      const { price, reason } = computePriceMovement(state, marketId, balancedRule, nextStock)
      state.priceHistory.push({ marketId, itemId: 'food', tick, price, reason })
    }

    expect(referencePrice(state, marketId, 'food')).toBe(startPrice)
    const reasons = state.priceHistory
      .filter((h) => h.itemId === 'food')
      .map((h) => h.reason)
    expect(reasons.every((r) => r === 'stable')).toBe(true)
  })

  it('local economy tick is deterministic', () => {
    const run = (): number[] => {
      const state = newGame()
      const marketId = helionMarketId()
      state.localStockpiles = [{ marketId, itemId: 'food', quantity: 200 }]
      for (let tick = 1; tick <= 5; tick += 1) {
        processLocalEconomy(state, tick)
      }
      return state.priceHistory
        .filter((h) => h.itemId === 'food')
        .map((h) => h.price)
    }

    expect(run()).toEqual(run())
  })

  it('persists price history and stockpiles through save/load', () => {
    const db = openDatabase(':memory:')
    const defs = loadVanillaDefs()
    const state = createCampaign(db, defs, 'Local economy save')

    runTick(state)
    saveState(db, state)

    const reloaded = loadCampaign(db)
    expect(reloaded.localStockpiles.length).toBeGreaterThan(0)
    expect(reloaded.priceHistory.some((h) => h.reason && h.reason !== 'trade')).toBe(true)
    expect(reloaded.definitions.economicProfiles.length).toBe(8)

    db.close()
  })

  it('initializes stockpiles at aggregated target levels', () => {
    const state = newGame()
    initLocalStockpiles(state)
    const marketId = helionMarketId()
    const food = state.localStockpiles.find((s) => s.marketId === marketId && s.itemId === 'food')
    expect(food?.quantity).toBe(500)
  })

  it('runTick applies local economy before market matching', () => {
    const state = newGame()
    const marketId = helionMarketId()
    state.localStockpiles = [{ marketId, itemId: 'food', quantity: 50 }]

    runTick(state)

    const economyRow = state.priceHistory.find(
      (h) => h.marketId === marketId && h.itemId === 'food' && h.tick === 1
    )
    expect(economyRow).toBeDefined()
    expect(economyRow?.reason).toBe('npc_demand')
  })

  it('player buys reduce regional stockpile relative to flows-only tick', () => {
    const flowsOnly = newGame()
    runTick(flowsOnly)
    const marketId = helionMarketId()
    const afterFlows = flowsOnly.localStockpiles.find(
      (s) => s.marketId === marketId && s.itemId === 'food'
    )!.quantity

    const withTrade = newGame()
    createMarketOrder(withTrade, {
      systemId: 'sys_helion',
      itemId: 'food',
      side: 'buy',
      quantity: 10,
      price: 50,
      tick: 0
    })
    runTick(withTrade)
    const afterTrade = withTrade.localStockpiles.find(
      (s) => s.marketId === marketId && s.itemId === 'food'
    )!.quantity

    expect(afterTrade).toBe(afterFlows - 10)
  })

  it('combined trade and economy tick stays bounded and deterministic', () => {
    const run = (): { stockpile: number; price: number; npcDepth: number } => {
      const state = newGame()
      createMarketOrder(state, {
        systemId: 'sys_helion',
        itemId: 'food',
        side: 'buy',
        quantity: 5,
        price: 50,
        tick: 0
      })
      runTick(state)
      runTick(state)

      const marketId = helionMarketId()
      const rules = aggregateMarketRules(state, 'sys_helion')
      const foodRule = rules.find((r) => r.itemId === 'food')!
      const baseValue = state.definitions.items.find((i) => i.id === 'food')!.baseValue
      const bias = factionPriceBias(state, 'sys_helion')
      const minPrice = Math.round(baseValue * foodRule.minPriceMultiplier * bias)
      const maxPrice = Math.round(baseValue * foodRule.maxPriceMultiplier * bias)
      const price = referencePrice(state, marketId, 'food')
      expect(price).toBeGreaterThanOrEqual(minPrice)
      expect(price).toBeLessThanOrEqual(maxPrice)

      const npcSell = state.orders.find(
        (o) =>
          o.marketId === marketId &&
          o.itemId === 'food' &&
          o.side === 'sell' &&
          o.ownerId === NPC_OWNER
      )!

      return {
        stockpile: state.localStockpiles.find((s) => s.marketId === marketId && s.itemId === 'food')!
          .quantity,
        price,
        npcDepth: npcSell.remainingQuantity
      }
    }

    expect(run()).toEqual(run())
    expect(run().npcDepth).toBeGreaterThan(0)
    expect(run().npcDepth).toBeLessThanOrEqual(NPC_ORDER_QUANTITY)
  })
})

describe('market economy loop', () => {
  it('NPC liquidity replenishes after matching so depth never permanently drains', () => {
    const state = newGame()
    const home = state.corporation.homeSystemId
    const market = state.markets.find((m) => m.systemId === home)!
    const food = findInventory(state, state.corporation.id, home, 'food')!
    food.quantity = 50_000
    food.reserved = 0

    for (let i = 0; i < 25; i += 1) {
      createMarketOrder(state, {
        systemId: home,
        itemId: 'food',
        side: 'sell',
        quantity: 200,
        price: 1,
        tick: state.meta.tick
      })
      matchMarket(state)
      replenishNpcLiquidity(state)
    }

    const npcSell = state.orders.find(
      (o) =>
        o.marketId === market.id &&
        o.itemId === 'food' &&
        o.side === 'sell' &&
        o.ownerId === NPC_OWNER
    )
    const npcBuy = state.orders.find(
      (o) =>
        o.marketId === market.id &&
        o.itemId === 'food' &&
        o.side === 'buy' &&
        o.ownerId === NPC_OWNER
    )

    expect(npcSell?.remainingQuantity).toBeGreaterThan(0)
    expect(npcSell?.remainingQuantity).toBeLessThanOrEqual(NPC_ORDER_QUANTITY)
    expect(npcBuy?.remainingQuantity).toBeGreaterThan(0)
    expect(npcBuy?.remainingQuantity).toBeLessThanOrEqual(NPC_ORDER_QUANTITY)
  })

  it('applyTradesToLocalStockpiles adjusts stockpile for player trades', () => {
    const state = newGame()
    const marketId = helionMarketId()
    state.localStockpiles = [{ marketId, itemId: 'food', quantity: 300 }]

    applyTradesToLocalStockpiles(state, [
      {
        marketId,
        itemId: 'food',
        quantity: 20,
        price: 18,
        buyOrderId: 'b1',
        sellOrderId: 's1',
        playerSide: 'buy'
      }
    ])
    expect(
      state.localStockpiles.find((s) => s.marketId === marketId && s.itemId === 'food')!.quantity
    ).toBe(280)

    applyTradesToLocalStockpiles(state, [
      {
        marketId,
        itemId: 'food',
        quantity: 15,
        price: 16,
        buyOrderId: 'b2',
        sellOrderId: 's2',
        playerSide: 'sell'
      }
    ])
    expect(
      state.localStockpiles.find((s) => s.marketId === marketId && s.itemId === 'food')!.quantity
    ).toBe(295)
  })
})

describe('population-driven demand (perCapitaConsumptionPerDay)', () => {
  it('adds population x rate to consumedPerDay during aggregation', () => {
    const state = newGame()
    // Vanilla: helion_prime (pop 5,000,000) food rule has consumedPerDay 50 and
    // perCapitaConsumptionPerDay 0.00001 -> 50 + 5,000,000 x 0.00001 = 100.
    const planet = state.definitions.planets.find((p) => p.id === 'helion_prime')!
    const profile = state.definitions.economicProfiles.find(
      (p) => p.id === planet.economicProfileId
    )!
    const foodRuleDef = profile.items.find((r) => r.itemId === 'food')!
    expect(foodRuleDef.perCapitaConsumptionPerDay).toBeGreaterThan(0)

    const expected =
      foodRuleDef.consumedPerDay + planet.population * foodRuleDef.perCapitaConsumptionPerDay!
    const aggregated = aggregateMarketRules(state, 'sys_helion').find((r) => r.itemId === 'food')!
    expect(aggregated.consumedPerDay).toBe(expected)
  })

  it('adds nothing for a zero-population planet', () => {
    const state = newGame()
    const planet = state.definitions.planets.find((p) => p.id === 'helion_prime')!
    const profile = state.definitions.economicProfiles.find(
      (p) => p.id === planet.economicProfileId
    )!
    const foodRuleDef = profile.items.find((r) => r.itemId === 'food')!

    setPlanetPopulation(state, planet.id, 0)
    const aggregated = aggregateMarketRules(state, 'sys_helion').find((r) => r.itemId === 'food')!
    expect(aggregated.consumedPerDay).toBe(foodRuleDef.consumedPerDay)
  })
})

describe('economic profile validation', () => {
  it('rejects invalid economic profile JSON at load time', () => {
    const result = economicProfilesFileSchema.safeParse([
      {
        id: 'bad_profile',
        name: 'Bad',
        items: [
          {
            itemId: 'food',
            consumedPerDay: 1,
            producedPerDay: 0,
            targetStockpile: 100,
            minPriceMultiplier: 2.0,
            maxPriceMultiplier: 1.0
          }
        ]
      }
    ])
    expect(result.success).toBe(false)
  })

  it('rejects planet referencing unknown economic profile', () => {
    const mod: LoadedMod = {
      manifest: {
        id: 'test',
        name: 'Test',
        version: '1.0.0',
        author: 'test',
        gameVersion: '0.1.x',
        dependencies: [],
        loadAfter: [],
        description: ''
      },
      source: 'external',
      enabled: true,
      items: [{ id: 'food', name: 'Food', category: 'good', baseValue: 15, volume: 1 }],
      recipes: [],
      buildings: [],
      systems: [{ id: 'sys_a', name: 'A', x: 0, y: 0 }],
      planets: [
        {
          id: 'p1',
          name: 'P1',
          systemId: 'sys_a',
          planetType: 'rocky',
          habitability: 0.5,
          mineralRichness: 1,
          fertility: 1,
          energyPotential: 1,
          population: 1000,
          modifiers: {},
          economicProfileId: 'missing_profile'
        }
      ],
      factions: [],
      events: [],
      economicProfiles: [],
      ships: [],
      objectives: [],
      contractTemplates: [],
      economyConfig: {},
      campaignStartConfig: {}
    }

    expect(() => mergeMods([mod])).toThrow(ModValidationError)
  })
})
