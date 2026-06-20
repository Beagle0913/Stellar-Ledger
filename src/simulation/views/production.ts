import { explainIdleBuilding, explainQueuedJobBlock } from '../../shared/explanations/index.js'
import type { GameState, ProductionPlanArgs, ProductionPlanView, ProductionView } from '../../shared/types.js'
import { getPlayerCorporation } from '../corporations.js'
import { canStartProduction, recipesForBuildingType } from '../production.js'
import { planChain } from '../productionPlanner.js'
import {
  resolveBuildingName,
  resolveBuildingNameForInstance,
  resolveItemName,
  resolvePlanetName,
  resolveRecipeName
} from '../resolveNames.js'

export function buildProductionView(state: GameState): ProductionView {
  const corpId = getPlayerCorporation(state).id
  const buildings = state.buildings.map((b) => {
    const busy = state.productionJobs.some(
      (j) =>
        j.buildingId === b.id && (j.status === 'running' || j.status === 'queued')
    )
    const explanation =
      b.ownerId === corpId && !busy
        ? explainIdleBuilding(resolveBuildingName(state, b.definitionId))
        : undefined
    return {
      id: b.id,
      definitionId: b.definitionId,
      definitionName: resolveBuildingName(state, b.definitionId),
      planetId: b.planetId,
      planetName: resolvePlanetName(state, b.planetId),
      availableRecipes: recipesForBuildingType(state, b.definitionId),
      explanation
    }
  })
  const jobs = state.productionJobs.map((j) => {
    let explanation
    if (j.status === 'queued') {
      const check = canStartProduction(state, j.buildingId, j.recipeId, j.quantity)
      if (!check.ok) explanation = explainQueuedJobBlock(check.reason)
    }
    return {
      ...j,
      recipeName: resolveRecipeName(state, j.recipeId),
      buildingName: resolveBuildingNameForInstance(state, j.buildingId),
      explanation
    }
  })
  return { buildings, jobs }
}

export function buildProductionPlanView(state: GameState, args: ProductionPlanArgs): ProductionPlanView {
  const plan = planChain(state, args)
  return {
    feasible: plan.feasible,
    targetItemId: plan.targetItemId,
    targetQty: plan.targetQty,
    estimatedDays: plan.estimatedDays,
    requiredInputs: plan.requiredInputs.map((l) => ({
      ...l,
      itemName: resolveItemName(state, l.itemId)
    })),
    requiredBuildings: plan.requiredBuildings.map((b) => ({
      ...b,
      buildingName: resolveBuildingName(state, b.buildingTypeId)
    })),
    bottlenecks: plan.bottlenecks,
    warnings: plan.warnings
  }
}
