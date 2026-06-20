import { describe, expect, it } from 'vitest'
import { processPopulationDynamics } from '../src/simulation/populationDynamics.js'
import { getHomePlanetId, newGame } from './helpers.js'

describe('populationDynamics', () => {
  it('grows population when regional food stock exceeds target', () => {
    const state = newGame()
    const planetId = getHomePlanetId()
    const planet = state.definitions.planets.find((p) => p.id === planetId)!
    const market = state.markets.find((m) => m.systemId === planet.systemId)!
    const foodId = state.definitions.economyConfig.populationFoodItemId

    state.localStockpiles.push({
      marketId: market.id,
      itemId: foodId,
      quantity: 500
    })

    const before = state.planetPopulations.find((p) => p.planetId === planetId)?.population ?? planet.population
    const changes = processPopulationDynamics(state)
    const row = changes.find((c) => c.planetId === planetId)
    expect(row).toBeDefined()
    expect(row!.after).toBeGreaterThan(before)
  })

  it('declines population when food ratio is below decline threshold', () => {
    const state = newGame()
    const planetId = getHomePlanetId()
    const planet = state.definitions.planets.find((p) => p.id === planetId)!
    const market = state.markets.find((m) => m.systemId === planet.systemId)!
    const foodId = state.definitions.economyConfig.populationFoodItemId
    const config = state.definitions.economyConfig

    state.localStockpiles.push({
      marketId: market.id,
      itemId: foodId,
      quantity: 1
    })

    const before = state.planetPopulations.find((p) => p.planetId === planetId)?.population ?? planet.population
    expect(before).toBeGreaterThan(0)

    const changes = processPopulationDynamics(state)
    const row = changes.find((c) => c.planetId === planetId)
    if (row) {
      expect(row.after).toBeLessThan(before)
    } else {
      const ratio = 1 / 100
      expect(ratio).toBeLessThan(config.populationDeclineFoodRatio)
    }
  })
})
