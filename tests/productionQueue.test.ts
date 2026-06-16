import { describe, expect, it } from 'vitest'
import {
  cancelProductionJob,
  maxAffordableRuns,
  processProductionJobs,
  runProductionUntilExhausted,
  startProductionJob,
  tryPromoteQueuedJob
} from '../src/simulation/production.js'
import { findInventory } from '../src/simulation/economyMath.js'
import { getPlayerCorporation, newGame } from './helpers.js'

describe('production queue', () => {
  it('queues a second job without consuming inputs until the first completes', () => {
    const state = newGame()
    const refinery = state.buildings.find((b) => b.definitionId === 'refinery')!
    const home = getPlayerCorporation(state).homeSystemId
    const oreBefore = findInventory(state, getPlayerCorporation(state).id, home, 'ore')!.quantity

    startProductionJob(state, refinery.id, 'recipe_metal_smelting', 1)
    startProductionJob(state, refinery.id, 'recipe_metal_smelting', 1)

    const oreAfterQueue = findInventory(state, getPlayerCorporation(state).id, home, 'ore')!.quantity
    expect(oreAfterQueue).toBe(oreBefore - 4)
    expect(state.productionJobs.filter((j) => j.status === 'running')).toHaveLength(1)
    expect(state.productionJobs.filter((j) => j.status === 'queued')).toHaveLength(1)
  })

  it('promotes queued job and consumes inputs when running job completes', () => {
    const state = newGame()
    const refinery = state.buildings.find((b) => b.definitionId === 'refinery')!
    const home = getPlayerCorporation(state).homeSystemId

    startProductionJob(state, refinery.id, 'recipe_metal_smelting', 1)
    startProductionJob(state, refinery.id, 'recipe_metal_smelting', 1)

    processProductionJobs(state)
    expect(state.productionJobs.some((j) => j.status === 'running')).toBe(true)

    processProductionJobs(state)
    const ore = findInventory(state, getPlayerCorporation(state).id, home, 'ore')!.quantity
    expect(ore).toBeLessThan(200 - 4)
    expect(state.productionJobs.filter((j) => j.status === 'completed')).toHaveLength(1)
  })

  it('cancel queued job without input loss; cancel running without refund', () => {
    const state = newGame()
    const refinery = state.buildings.find((b) => b.definitionId === 'refinery')!
    const home = getPlayerCorporation(state).homeSystemId
    const oreBefore = findInventory(state, getPlayerCorporation(state).id, home, 'ore')!.quantity

    const running = startProductionJob(state, refinery.id, 'recipe_metal_smelting', 1)
    const queued = startProductionJob(state, refinery.id, 'recipe_metal_smelting', 1)

    cancelProductionJob(state, queued.id)
    expect(findInventory(state, getPlayerCorporation(state).id, home, 'ore')!.quantity).toBe(oreBefore - 4)

    cancelProductionJob(state, running.id)
    expect(findInventory(state, getPlayerCorporation(state).id, home, 'ore')!.quantity).toBe(oreBefore - 4)
  })

  it('runProductionUntilExhausted queues affordable runs', () => {
    const state = newGame()
    const refinery = state.buildings.find((b) => b.definitionId === 'refinery')!
    const count = runProductionUntilExhausted(state, refinery.id, 'recipe_metal_smelting')
    expect(count).toBeGreaterThan(1)
    expect(state.productionJobs.filter((j) => j.status === 'running' || j.status === 'queued').length).toBe(
      count
    )
  })

  it('tryPromoteQueuedJob leaves job queued when inputs are insufficient', () => {
    const state = newGame()
    const refinery = state.buildings.find((b) => b.definitionId === 'refinery')!
    const home = getPlayerCorporation(state).homeSystemId
    const ore = findInventory(state, getPlayerCorporation(state).id, home, 'ore')!
    ore.quantity = 3

    state.productionJobs.push({
      id: 'job_queued_only',
      buildingId: refinery.id,
      recipeId: 'recipe_metal_smelting',
      quantity: 1,
      progress: 0,
      duration: 2,
      status: 'queued'
    })

    expect(tryPromoteQueuedJob(state, refinery.id)).toBe(false)
    expect(maxAffordableRuns(state, refinery.id, 'recipe_metal_smelting')).toBe(0)
  })
})
