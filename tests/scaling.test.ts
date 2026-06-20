import { describe, expect, it } from 'vitest'

import { buildInitialState } from '../src/database/saveManager.js'

import { runTicks } from '../src/simulation/tick.js'

import type { GameDefinitions, GameState, PlanetDefinition, SystemDefinition } from '../src/shared/types.js'

import { loadVanillaDefs } from './helpers.js'



// Scaling guard: the daily tick must stay roughly linear in galaxy size so the

// game can host thousands of systems. Before the simulation was index-backed,

// per-tick work was ~O(systems^2 x items) (aggregateMarketRules rescanned every

// planet for every market, matchMarket re-filtered the whole order book per

// market x item, etc.) and a galaxy this size would take minutes per batch.



const GENERATED_SYSTEMS = 600

const GENERATED_SYSTEMS_2K = 2000



/** Clone the vanilla galaxy up to `systemCount` systems, reusing the first

 *  economic profile so every generated market is a live, profiled economy. */

function buildLargeGalaxy(systemCount: number): GameDefinitions {

  const defs = loadVanillaDefs()

  const profileId = defs.economicProfiles[0]?.id

  expect(profileId).toBeTruthy()



  const startCount = defs.systems.length

  for (let i = startCount; i < systemCount; i += 1) {

    const systemId = `sys_gen_${i}`

    const system: SystemDefinition = {

      id: systemId,

      name: `Generated ${i}`,

      x: (i % 40) * 25,

      y: Math.floor(i / 40) * 25,

      economicProfileId: profileId

    }

    defs.systems.push(system)



    const planet: PlanetDefinition = {

      id: `planet_gen_${i}`,

      name: `Generated ${i} I`,

      systemId,

      planetType: 'rocky',

      habitability: 0.6,

      mineralRichness: 1,

      fertility: 1,

      energyPotential: 1,

      population: 100_000,

      modifiers: {},

      economicProfileId: profileId

    }

    defs.planets.push(planet)

  }

  return defs

}



function assertHealthy(state: GameState): void {

  for (const row of state.localStockpiles) {

    expect(row.quantity).toBeGreaterThanOrEqual(0)

    expect(Number.isFinite(row.quantity)).toBe(true)

  }

  for (const order of state.orders) {

    expect(Number.isFinite(order.price)).toBe(true)

    expect(order.price).toBeGreaterThanOrEqual(1)

  }

  for (const row of state.priceHistory) {

    expect(Number.isFinite(row.price)).toBe(true)

  }

}



function runScalingCase(systemCount: number, maxMs: number): void {

  const defs = buildLargeGalaxy(systemCount)

  expect(defs.systems.length).toBe(systemCount)



  const state = buildInitialState(defs, 'Scaling Campaign')

  expect(state.markets.length).toBe(systemCount)



  const days = 30

  const start = performance.now()

  const result = runTicks(state, days)

  const elapsed = performance.now() - start



  expect(result.tick).toBe(days)

  assertHealthy(state)

  expect(elapsed).toBeLessThan(maxMs)

}



describe('large-galaxy scaling', () => {
  it('runs 100-system vanilla galaxy × 30 days within budget', () => {
    const defs = loadVanillaDefs()
    expect(defs.systems.length).toBe(100)
    const state = buildInitialState(defs, 'Vanilla Scaling')
    const days = 30
    const start = performance.now()
    const result = runTicks(state, days)
    const elapsed = performance.now() - start
    expect(result.tick).toBe(days)
    assertHealthy(state)
    expect(elapsed).toBeLessThan(15_000)
  })

  it('runs a multi-day batch over hundreds of systems quickly and stays consistent', () => {

    runScalingCase(GENERATED_SYSTEMS, 12_000)

  })



  it('runs 2000 systems × 30 days within scaling budget', () => {

    runScalingCase(GENERATED_SYSTEMS_2K, 30_000)

  })

})

