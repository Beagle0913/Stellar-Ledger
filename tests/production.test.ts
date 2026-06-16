import { describe, expect, it } from 'vitest'
import {
  canStartProduction,
  processProductionJobs,
  startProductionJob
} from '../src/simulation/production.js'
import { findInventory } from '../src/simulation/economyMath.js'
import { newGame } from './helpers.js'

describe('production', () => {
  it('runs a power plant job: consumes inputs on start, yields outputs on completion', () => {
    const state = newGame()
    const powerPlant = state.buildings.find((b) => b.definitionId === 'power_plant')
    expect(powerPlant).toBeDefined()

    const homeSystem = state.corporation.homeSystemId
    const energyBefore = findInventory(state, state.corporation.id, homeSystem, 'energy')?.quantity ?? 0

    const job = startProductionJob(state, powerPlant!.id, 'recipe_energy_generation', 1)
    expect(job.status).toBe('running')

    // Energy generation has no inputs and a duration of 1 day.
    processProductionJobs(state)
    expect(state.productionJobs[0]!.status).toBe('completed')

    const energyAfter = findInventory(state, state.corporation.id, homeSystem, 'energy')?.quantity ?? 0
    expect(energyAfter).toBeGreaterThan(energyBefore)
  })

  it('consumes inputs immediately when a job with inputs starts', () => {
    const state = newGame()
    const home = state.corporation.homeSystemId
    // Ensure there is a refinery + enough ore/energy to smelt metal.
    const refinery = state.buildings.find((b) => b.definitionId === 'refinery')
    expect(refinery).toBeDefined()
    const oreBefore = findInventory(state, state.corporation.id, home, 'ore')!.quantity

    startProductionJob(state, refinery!.id, 'recipe_metal_smelting', 2)
    const oreAfter = findInventory(state, state.corporation.id, home, 'ore')!.quantity
    // recipe consumes 4 ore per run * 2 runs = 8.
    expect(oreBefore - oreAfter).toBe(8)
  })

  it('refuses to start a job without enough inputs', () => {
    const state = newGame()
    const refinery = state.buildings.find((b) => b.definitionId === 'refinery')!
    const check = canStartProduction(state, refinery.id, 'recipe_metal_smelting', 10_000)
    expect(check.ok).toBe(false)
    if (!check.ok) {
      expect(check.reason).toMatch(/Not enough Ore here: need \d+, have \d+/)
    }
  })

  it('rejects unknown building, recipe, and invalid quantity with clear errors', () => {
    const state = newGame()
    const refinery = state.buildings.find((b) => b.definitionId === 'refinery')!

    expect(canStartProduction(state, 'missing', 'recipe_metal_smelting', 1).ok).toBe(false)
    expect(canStartProduction(state, refinery.id, 'missing_recipe', 1).ok).toBe(false)
    expect(canStartProduction(state, refinery.id, 'recipe_metal_smelting', 0).ok).toBe(false)

    const mine = state.buildings.find((b) => b.definitionId === 'mine')!
    const wrongBuilding = canStartProduction(state, mine.id, 'recipe_metal_smelting', 1)
    expect(wrongBuilding.ok).toBe(false)
    if (!wrongBuilding.ok) expect(wrongBuilding.reason).toMatch(/cannot run that recipe/i)

    expect(() => startProductionJob(state, refinery.id, 'recipe_metal_smelting', 0)).toThrow(
      /Quantity must be positive/
    )
  })

  it('skips output for completed jobs on orphan buildings without aborting the tick', () => {
    const state = newGame()
    const refinery = state.buildings.find((b) => b.definitionId === 'refinery')!
    startProductionJob(state, refinery.id, 'recipe_metal_smelting', 1)
    // Simulate corrupt save: building removed but job still running.
    state.buildings = state.buildings.filter((b) => b.id !== refinery.id)
    processProductionJobs(state)
    processProductionJobs(state) // duration 2 — completes on second day
    expect(state.productionJobs[0]!.status).toBe('completed')
  })
})
