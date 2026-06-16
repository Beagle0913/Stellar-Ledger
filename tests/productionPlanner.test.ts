import { describe, expect, it } from 'vitest'
import { planChain, planSingleJob } from '../src/simulation/productionPlanner.js'
import { newGame } from './helpers.js'

describe('productionPlanner', () => {
  it('single job feasible when stock covers inputs', () => {
    const state = newGame()
    const refinery = state.buildings.find((b) => b.definitionId === 'refinery')!
    const plan = planSingleJob(state, {
      buildingId: refinery.id,
      recipeId: 'recipe_metal_smelting',
      quantity: 1
    })
    expect(plan.feasible).toBe(true)
    expect(plan.estimatedDays).toBeGreaterThan(0)
  })

  it('single job reports missing inputs', () => {
    const state = newGame()
    const refinery = state.buildings.find((b) => b.definitionId === 'refinery')!
    state.inventories = state.inventories.filter((i) => i.itemId !== 'ore')
    const plan = planSingleJob(state, {
      buildingId: refinery.id,
      recipeId: 'recipe_metal_smelting',
      quantity: 5
    })
    expect(plan.feasible).toBe(false)
    expect(plan.requiredInputs.some((l) => l.missingQty > 0)).toBe(true)
  })

  it('chain plan for metal does not mutate state', () => {
    const state = newGame()
    const before = structuredClone(state.inventories)
    planChain(state, { targetItemId: 'metal', targetQty: 5 })
    expect(state.inventories).toEqual(before)
  })

  it('detects recipe cycles without infinite loop', () => {
    const state = newGame()
    state.inventories = state.inventories.filter((i) => i.itemId !== 'metal')
    state.definitions.items.push({
      id: 'cycle_item',
      name: 'Cycle Item',
      category: 'refined',
      baseValue: 1,
      volume: 1
    })
    state.definitions.recipes.push({
      id: 'recipe_cycle_a',
      name: 'Cycle A',
      buildingType: 'refinery',
      duration: 1,
      inputs: [{ itemId: 'cycle_item', quantity: 1 }],
      outputs: [{ itemId: 'cycle_item', quantity: 1 }]
    })
    const plan = planChain(state, { targetItemId: 'cycle_item', targetQty: 1 })
    expect(plan.warnings.some((w) => w.includes('Cycle'))).toBe(true)
  })
})
