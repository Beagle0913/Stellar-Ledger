import type { GameState } from '../shared/types.js'
import { availableQuantity, referencePrice } from './economyMath.js'
import { aggregateMarketRules, getRegionalStockpile } from './localEconomy.js'
import { maxAffordableRuns, recipesForBuildingType } from './production.js'
import { isObjectiveUnlocked } from './progressionRegistry.js'
import { buildingDefById, itemById, marketBySystemId, planetById, systemById } from './stateIndex.js'

/**
 * Title of the first non-optional, unlocked, incomplete objective — the single
 * main-path goal. Optional and locked objectives are never used here.
 */
function currentGoalHint(state: GameState): string | null {
  for (const def of state.definitions.objectives) {
    if (def.optional) continue
    const entry = state.progression.objectives.find((o) => o.objectiveId === def.id)
    if (!entry || entry.completed) continue
    if (!isObjectiveUnlocked(state, def)) continue
    return `Current goal: ${def.title}`
  }
  return null
}

/**
 * Non-automated dashboard hints derived from the current game state. Pure and
 * deterministic. Entirely data-driven — no hardcoded content ids — so hints keep
 * working for any mod's buildings, ships, recipes, systems and items.
 */
export function buildActionSuggestions(state: GameState): string[] {
  const suggestions: string[] = []
  const corpId = state.corporation.id
  const ownedBuildings = state.buildings.filter((b) => b.ownerId === corpId)

  const goal = currentGoalHint(state)
  if (goal) suggestions.push(goal)

  // Idle owned building (no running or queued job).
  const idleBuilding = ownedBuildings.find(
    (b) =>
      !state.productionJobs.some(
        (j) => j.buildingId === b.id && (j.status === 'running' || j.status === 'queued')
      )
  )
  if (idleBuilding) {
    const name = buildingDefById(state, idleBuilding.definitionId)?.name ?? idleBuilding.definitionId
    suggestions.push(`Your ${name} is idle.`)
  }

  // Most expensive ship the player can afford and does not already own.
  const ownedDefs = new Set(
    state.ships.filter((s) => s.ownerId === corpId && s.definitionId).map((s) => s.definitionId)
  )
  const affordableShip = state.definitions.ships
    .filter(
      (s) =>
        s.purchaseCost > 0 &&
        state.corporation.credits >= s.purchaseCost &&
        !ownedDefs.has(s.id)
    )
    .sort((a, b) => b.purchaseCost - a.purchaseCost)[0]
  if (affordableShip) {
    suggestions.push(`You have enough credits to buy ${affordableShip.name}.`)
  }

  // Best production opportunity: the owned building + recipe with the most
  // affordable runs from inputs on hand.
  let bestRuns = 0
  let bestRecipeName: string | null = null
  for (const building of ownedBuildings) {
    for (const recipe of recipesForBuildingType(state, building.definitionId)) {
      const runs = maxAffordableRuns(state, building.id, recipe.id)
      if (runs > bestRuns) {
        bestRuns = runs
        bestRecipeName = recipe.name
      }
    }
  }
  if (bestRecipeName && bestRuns >= 2) {
    suggestions.push(`You have enough inputs to run ${bestRuns} ${bestRecipeName} jobs.`)
  }

  // Cross-market arbitrage on something the player is holding.
  const heldItemIds = new Set(
    state.inventories
      .filter((r) => r.ownerId === corpId && availableQuantity(r) > 0)
      .map((r) => r.itemId)
  )
  for (const itemId of heldItemIds) {
    const item = itemById(state, itemId)
    if (!item) continue
    let bestSystem: string | null = null
    let bestPrice = 0
    let worstSystem: string | null = null
    let worstPrice = Infinity
    for (const market of state.markets) {
      const price = referencePrice(state, market.id, itemId)
      const system = systemById(state, market.systemId)
      if (!system || price <= 0) continue
      if (price > bestPrice) {
        bestPrice = price
        bestSystem = system.name
      }
      if (price < worstPrice) {
        worstPrice = price
        worstSystem = system.name
      }
    }
    if (bestSystem && worstSystem && bestSystem !== worstSystem && worstPrice > 0 && bestPrice > worstPrice) {
      const pct = Math.round(((bestPrice - worstPrice) / worstPrice) * 100)
      if (pct >= 3) {
        suggestions.push(`${item.name} sells for ${pct}% more in ${bestSystem} than ${worstSystem}.`)
        break
      }
    }
  }

  // Idle ship (not currently on a transport run).
  for (const ship of state.ships) {
    if (ship.ownerId !== corpId) continue
    const inTransit = state.transportJobs.some(
      (j) => j.shipId === ship.id && j.status === 'running'
    )
    if (!inTransit) {
      const systemName = systemById(state, ship.currentSystemId)?.name ?? ship.currentSystemId
      suggestions.push(`A ship is idle in ${systemName}.`)
      break
    }
  }

  // Regional shortage in a system the player operates in (buildings or ships).
  const playerSystems = new Set<string>()
  for (const b of ownedBuildings) {
    const planet = planetById(state, b.planetId)
    if (planet) playerSystems.add(planet.systemId)
  }
  for (const ship of state.ships) {
    if (ship.ownerId === corpId) playerSystems.add(ship.currentSystemId)
  }
  shortageScan: for (const systemId of playerSystems) {
    const market = marketBySystemId(state, systemId)
    if (!market) continue
    for (const rule of aggregateMarketRules(state, systemId)) {
      if (rule.targetStockpile <= 0) continue
      const stock = getRegionalStockpile(state, market.id, rule.itemId, rule.targetStockpile)
      if (stock < rule.targetStockpile * 0.25) {
        const itemName = itemById(state, rule.itemId)?.name ?? rule.itemId
        const systemName = systemById(state, systemId)?.name ?? systemId
        suggestions.push(`${itemName} shortage detected in ${systemName}.`)
        break shortageScan
      }
    }
  }

  return suggestions.slice(0, 6)
}
