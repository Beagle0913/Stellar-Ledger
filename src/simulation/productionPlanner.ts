import type {
  BuildingTypeId,
  ItemId,
  RecipeDefinition
} from '../shared/types/definitions.js'
import type { GameState } from '../shared/types/state.js'
import { getPlayerCorporation, getPlayerCorporationId } from './corporations.js'
import { availableQuantity, findInventory } from './economyMath.js'
import { recipesForBuildingType } from './production.js'

export interface PlanSingleJobInput {
  buildingId: string
  recipeId: string
  quantity: number
}

export interface PlanChainInput {
  targetItemId: ItemId
  targetQty: number
  homeSystemId?: string
}

export interface RequiredInputLine {
  itemId: ItemId
  requiredQty: number
  availableQty: number
  missingQty: number
}

export interface RequiredBuildingLine {
  buildingTypeId: BuildingTypeId
  available: number
  required: number
}

export interface ProductionPlanResult {
  feasible: boolean
  targetItemId: ItemId
  targetQty: number
  estimatedDays: number
  requiredInputs: RequiredInputLine[]
  requiredBuildings: RequiredBuildingLine[]
  bottlenecks: string[]
  warnings: string[]
}

function playerSystemId(state: GameState, homeSystemId?: string): string {
  return homeSystemId ?? getPlayerCorporation(state).homeSystemId
}

function stock(state: GameState, systemId: string, itemId: ItemId): number {
  const corpId = getPlayerCorporationId(state)
  return availableQuantity(findInventory(state, corpId, systemId, itemId))
}

export function planSingleJob(state: GameState, input: PlanSingleJobInput): ProductionPlanResult {
  const building = state.buildings.find((b) => b.id === input.buildingId)
  const recipe = state.definitions.recipes.find((r) => r.id === input.recipeId)
  const systemId = building
    ? state.definitions.planets.find((p) => p.id === building.planetId)?.systemId ??
      getPlayerCorporation(state).homeSystemId
    : getPlayerCorporation(state).homeSystemId

  if (!building || !recipe) {
    return {
      feasible: false,
      targetItemId: recipe?.outputs[0]?.itemId ?? 'unknown',
      targetQty: input.quantity,
      estimatedDays: 0,
      requiredInputs: [],
      requiredBuildings: [],
      bottlenecks: [],
      warnings: [!building ? 'Unknown building.' : 'Unknown recipe.']
    }
  }

  const requiredInputs: RequiredInputLine[] = recipe.inputs.map((io) => {
    const requiredQty = io.quantity * input.quantity
    const availableQty = stock(state, systemId, io.itemId)
    return {
      itemId: io.itemId,
      requiredQty,
      availableQty,
      missingQty: Math.max(0, requiredQty - availableQty)
    }
  })

  const feasible = requiredInputs.every((l) => l.missingQty === 0)
  const outputItem = recipe.outputs[0]?.itemId ?? 'unknown'
  const outputQty = (recipe.outputs[0]?.quantity ?? 0) * input.quantity

  return {
    feasible,
    targetItemId: outputItem,
    targetQty: outputQty,
    estimatedDays: recipe.duration * input.quantity,
    requiredInputs,
    requiredBuildings: [
      {
        buildingTypeId: building.definitionId,
        available: 1,
        required: 1
      }
    ],
    bottlenecks: feasible ? [] : requiredInputs.filter((l) => l.missingQty > 0).map((l) => l.itemId),
    warnings: []
  }
}

function recipesProducingItem(state: GameState, itemId: ItemId): RecipeDefinition[] {
  return state.definitions.recipes
    .filter((r) => r.outputs.some((o) => o.itemId === itemId))
    .sort((a, b) => a.id.localeCompare(b.id))
}

function playerBuildingsOfType(state: GameState, buildingType: BuildingTypeId): number {
  const corpId = getPlayerCorporationId(state)
  return state.buildings.filter((b) => b.ownerId === corpId && b.definitionId === buildingType).length
}

/** Backwards recipe walk (heuristic). Does not mutate state. */
export function planChain(state: GameState, input: PlanChainInput): ProductionPlanResult {
  const systemId = playerSystemId(state, input.homeSystemId)
  const warnings: string[] = []
  const requiredInputsMap = new Map<ItemId, number>()
  const requiredBuildingsMap = new Map<BuildingTypeId, number>()
  const visiting = new Set<ItemId>()

  function need(itemId: ItemId, qty: number, depth: number): void {
    if (qty <= 0) return
    if (depth > 32) {
      warnings.push('Recipe depth limit reached — possible cycle.')
      return
    }
    if (visiting.has(itemId)) {
      warnings.push(`Cycle detected at item "${itemId}".`)
      return
    }

    const onHand = stock(state, systemId, itemId)
    if (onHand >= qty) return

    const remaining = qty - onHand
    const recipes = recipesProducingItem(state, itemId)
    if (recipes.length === 0) {
      requiredInputsMap.set(itemId, (requiredInputsMap.get(itemId) ?? 0) + remaining)
      return
    }
    if (recipes.length > 1) {
      warnings.push(`Multiple recipes produce "${itemId}"; using "${recipes[0]!.id}" (heuristic).`)
    }
    const recipe = recipes[0]!
    const outputPerRun = recipe.outputs.find((o) => o.itemId === itemId)?.quantity ?? 1
    const runs = Math.ceil(remaining / outputPerRun)

    requiredBuildingsMap.set(
      recipe.buildingType,
      (requiredBuildingsMap.get(recipe.buildingType) ?? 0) + runs
    )

    visiting.add(itemId)
    for (const io of recipe.inputs) {
      need(io.itemId, io.quantity * runs, depth + 1)
    }
    visiting.delete(itemId)
  }

  need(input.targetItemId, input.targetQty, 0)

  const requiredInputs: RequiredInputLine[] = [...requiredInputsMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([itemId, requiredQty]) => {
      const availableQty = stock(state, systemId, itemId)
      return {
        itemId,
        requiredQty,
        availableQty,
        missingQty: Math.max(0, requiredQty - availableQty)
      }
    })

  const requiredBuildings: RequiredBuildingLine[] = [...requiredBuildingsMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([buildingTypeId, required]) => ({
      buildingTypeId,
      available: playerBuildingsOfType(state, buildingTypeId),
      required
    }))

  const bottlenecks = [
    ...requiredInputs.filter((l) => l.missingQty > 0).map((l) => `missing:${l.itemId}`),
    ...requiredBuildings
      .filter((b) => b.available < b.required)
      .map((b) => `building:${b.buildingTypeId}`)
  ]

  const estimatedDays = [...requiredBuildingsMap.entries()].reduce((sum, [type, runs]) => {
    const recipe = recipesForBuildingType(state, type)[0]
    return sum + (recipe?.duration ?? 1) * runs
  }, 0)

  return {
    feasible: bottlenecks.length === 0,
    targetItemId: input.targetItemId,
    targetQty: input.targetQty,
    estimatedDays,
    requiredInputs,
    requiredBuildings,
    bottlenecks,
    warnings
  }
}

/** IPC-safe wrapper: returns plan without mutating state. */
export function buildProductionPlan(
  state: GameState,
  input: PlanChainInput
): ProductionPlanResult {
  return planChain(state, input)
}
