import type { BuildingInstance, Corporation, GameState, RecipeDefinition } from '../shared/types.js'
import { availableQuantity, findInventory } from './economyMath.js'
import {
  npcBalancedOreItemId,
  npcBalancedOreThreshold,
  npcMaxProductionRunsPerBuilding,
  sortedNpcCorporations
} from './npc/shared.js'
import { planetById } from './stateIndex.js'
import {
  canStartProduction,
  maxAffordableRuns,
  recipesForBuildingType,
  startProductionJob
} from './production.js'

function buildingBusy(state: GameState, buildingId: string): boolean {
  return state.productionJobs.some(
    (j) => j.buildingId === buildingId && (j.status === 'running' || j.status === 'queued')
  )
}

function sortedCorpBuildings(state: GameState, corpId: string): BuildingInstance[] {
  return state.buildings
    .filter((b) => b.ownerId === corpId)
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
}

function sortedRecipes(recipes: RecipeDefinition[]): RecipeDefinition[] {
  return recipes.slice().sort((a, b) => a.id.localeCompare(b.id))
}

function localItemQty(state: GameState, ownerId: string, systemId: string, itemId: string): number {
  return availableQuantity(findInventory(state, ownerId, systemId, itemId))
}

function pickRecipeForProfile(
  state: GameState,
  corp: Corporation,
  building: BuildingInstance,
  recipes: RecipeDefinition[]
): RecipeDefinition | undefined {
  const profile = corp.aiProfile ?? 'balanced'
  const systemId = planetById(state, building.planetId)?.systemId
  if (!systemId) return undefined

  const sorted = sortedRecipes(recipes)

  if (profile === 'trader') return undefined

  if (profile === 'extractor') {
    return sorted.find((r) => r.extraction && maxAffordableRuns(state, building.id, r.id) > 0)
  }

  if (profile === 'refiner') {
    return sorted.find((r) => !r.extraction && maxAffordableRuns(state, building.id, r.id) > 0)
  }

  const oreItemId = npcBalancedOreItemId(state)
  const oreQty = localItemQty(state, corp.id, systemId, oreItemId)
  const refine = sorted.find((r) => !r.extraction && maxAffordableRuns(state, building.id, r.id) > 0)
  if (oreQty >= npcBalancedOreThreshold(state) && refine) return refine
  return sorted.find((r) => maxAffordableRuns(state, building.id, r.id) > 0)
}

/** Queue at most one new production job per idle NPC building (deterministic). */
export function processNpcProductionAI(state: GameState): number {
  let queued = 0
  const maxRuns = npcMaxProductionRunsPerBuilding(state)

  for (const corp of sortedNpcCorporations(state)) {
    for (const building of sortedCorpBuildings(state, corp.id)) {
      if (buildingBusy(state, building.id)) continue

      const recipes = sortedRecipes(recipesForBuildingType(state, building.definitionId))
      const recipe = pickRecipeForProfile(state, corp, building, recipes)
      if (!recipe) continue

      const runs = Math.min(maxAffordableRuns(state, building.id, recipe.id), maxRuns)
      if (runs <= 0) continue
      const check = canStartProduction(state, building.id, recipe.id, runs)
      if (!check.ok) continue

      startProductionJob(state, building.id, recipe.id, runs)
      queued += 1
    }
  }

  return queued
}
