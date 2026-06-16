import type { GameState, PlanetId } from '../shared/types.js'
import { marketIdForSystem } from '../shared/ids.js'
import { getRegionalStockpile } from './localEconomy.js'
import { planetPopulation, setPlanetPopulation } from './planetPopulation.js'

export interface PopulationChange {
  planetId: PlanetId
  planetName: string
  before: number
  after: number
}

/** * Planets grow when regional food stockpiles are healthy and shrink during shortages.
 * Demand in aggregateMarketRules uses live counts via planetPopulation().
 */
export function processPopulationDynamics(state: GameState): PopulationChange[] {
  const config = state.definitions.economyConfig
  const foodItemId = config.populationFoodItemId
  const changes: PopulationChange[] = []

  // Resolve the food target once rather than flattening every profile per planet.
  let foodTarget = 100
  for (const profile of state.definitions.economicProfiles) {
    const rule = profile.items.find((r) => r.itemId === foodItemId)
    if (rule) {
      foodTarget = rule.targetStockpile
      break
    }
  }

  for (const planet of state.definitions.planets) {
    const before = planetPopulation(state, planet.id)
    if (before <= 0) continue

    const marketId = marketIdForSystem(planet.systemId)
    const target = foodTarget
    const foodStock = getRegionalStockpile(state, marketId, foodItemId, target)
    const ratio = target > 0 ? foodStock / target : 1

    if (ratio >= 1) {
      const growth = before * config.populationGrowthRatePerDay
      if (growth >= 0.5) {
        setPlanetPopulation(state, planet.id, before + growth)
        const after = planetPopulation(state, planet.id)
        if (after !== before) {
          changes.push({ planetId: planet.id, planetName: planet.name, before, after })
        }
      }
    } else if (ratio < config.populationDeclineFoodRatio) {
      const decline = before * config.populationGrowthRatePerDay * 1.5
      if (decline >= 0.5) {
        setPlanetPopulation(state, planet.id, before - decline)
        const after = planetPopulation(state, planet.id)
        if (after !== before) {
          changes.push({ planetId: planet.id, planetName: planet.name, before, after })
        }
      }
    }
  }

  return changes
}
