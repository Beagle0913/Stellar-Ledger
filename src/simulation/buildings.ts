import { GameError } from '../shared/errors.js'
import { newId } from '../shared/ids.js'
import type { BuildingInstance, GameState } from '../shared/types.js'
import { explainAffordability, removeInventory } from './economyMath.js'

/** Construct a player-owned building on a planet after validating affordability. */
export function buildBuilding(
  state: GameState,
  planetId: string,
  buildingType: string
): BuildingInstance {
  const planet = state.definitions.planets.find((p) => p.id === planetId)
  if (!planet) throw new GameError('NOT_FOUND', `Unknown planet "${planetId}".`)
  const def = state.definitions.buildings.find((b) => b.id === buildingType)
  if (!def) throw new GameError('NOT_FOUND', `Unknown building type "${buildingType}".`)
  const affordError = explainAffordability(
    state,
    state.corporation.id,
    planet.systemId,
    def.buildCost,
    def.buildMaterials
  )
  if (affordError) throw new GameError('VALIDATION', affordError)
  state.corporation.credits -= def.buildCost
  for (const mat of def.buildMaterials) {
    removeInventory(state, state.corporation.id, planet.systemId, mat.itemId, mat.quantity)
  }
  const instance: BuildingInstance = {
    id: newId('bld'),
    definitionId: def.id,
    planetId: planet.id,
    ownerId: state.corporation.id
  }
  state.buildings.push(instance)
  return instance
}
