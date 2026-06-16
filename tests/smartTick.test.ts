import { describe, expect, it } from 'vitest'
import {
  daysUntilNextProductionCompletion,
  daysUntilNextTransportArrival,
  runTicksSmart
} from '../src/simulation/smartTick.js'
import { startProductionJob } from '../src/simulation/production.js'
import { createTransportJob } from '../src/simulation/logistics.js'
import { newGame, otherSystemId, playerShip } from './helpers.js'

describe('smart tick', () => {
  it('computes days until next production completion', () => {
    const state = newGame()
    const refinery = state.buildings.find((b) => b.definitionId === 'refinery')!
    startProductionJob(state, refinery.id, 'recipe_metal_smelting', 1)
    expect(daysUntilNextProductionCompletion(state)).toBe(2)
  })

  it('computes days until next transport arrival', () => {
    const state = newGame()
    const ship = playerShip(state)
    createTransportJob(state, {
      shipId: ship.id,
      destinationSystemId: otherSystemId(state),
      itemId: 'food',
      quantity: 5
    })
    expect(daysUntilNextTransportArrival(state)).toBeGreaterThan(0)
  })

  it('runTicksSmart production mode advances to completion capped at 30', () => {
    const state = newGame()
    const plant = state.buildings.find((b) => b.definitionId === 'power_plant')!
    startProductionJob(state, plant.id, 'recipe_energy_generation', 1)
    const before = state.meta.tick
    const result = runTicksSmart(state, 'production', 30)
    expect(result.completedProductionJobs).toBeGreaterThanOrEqual(1)
    expect(state.meta.tick - before).toBeLessThanOrEqual(30)
  })
})
