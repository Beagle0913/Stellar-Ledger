import { describe, expect, it } from 'vitest'
import { effectiveOutput, extractionMultiplier } from '../src/simulation/extraction.js'
import type { PlanetDefinition, RecipeDefinition } from '../src/shared/types.js'

const planet: PlanetDefinition = {
  id: 'p1',
  name: 'Test',
  systemId: 's1',
  planetType: 'terran',
  habitability: 0.8,
  mineralRichness: 0.6,
  fertility: 0.4,
  energyPotential: 0.5,
  population: 1000,
  modifiers: {}
}

const extractionRecipe: RecipeDefinition = {
  id: 'r_mine',
  name: 'Mine',
  buildingType: 'mine',
  duration: 1,
  extraction: true,
  yieldStat: 'mineralRichness',
  inputs: [],
  outputs: [{ itemId: 'ore', quantity: 10 }]
}

describe('extraction', () => {
  it('returns 1 for non-extraction recipes', () => {
    const refine: RecipeDefinition = { ...extractionRecipe, extraction: false, yieldStat: undefined }
    expect(extractionMultiplier(planet, refine)).toBe(1)
  })

  it('scales output by yield stat with a floor', () => {
    expect(extractionMultiplier(planet, extractionRecipe)).toBe(0.6)
    expect(effectiveOutput(planet, extractionRecipe, 10)).toBe(6)
  })

  it('never drops below MIN_YIELD multiplier', () => {
    const poor = { ...planet, mineralRichness: 0.05 }
    expect(extractionMultiplier(poor, extractionRecipe)).toBe(0.25)
    expect(effectiveOutput(poor, extractionRecipe, 10)).toBe(2)
  })
})
