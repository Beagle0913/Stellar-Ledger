import { GameError } from '../shared/errors.js'
import { newId } from '../shared/ids.js'
import type { BuildingInstance, GameState } from '../shared/types.js'
import { getPlayerCorporation } from './corporations.js'
import { explainAffordability, removeInventory } from './economyMath.js'
import { buildingDefById, planetById } from './stateIndex.js'

/** Construct a player-owned building on a planet after validating affordability. */
export function buildBuilding(
  state: GameState,
  planetId: string,
  buildingType: string
): BuildingInstance {
  const planet = planetById(state, planetId)
  if (!planet) throw new GameError('NOT_FOUND', `Unknown planet "${planetId}".`)
  const def = buildingDefById(state, buildingType)
  if (!def) throw new GameError('NOT_FOUND', `Unknown building type "${buildingType}".`)
  const corp = getPlayerCorporation(state)
  const affordError = explainAffordability(
    state,
    corp.id,
    planet.systemId,
    def.buildCost,
    def.buildMaterials
  )
  if (affordError) throw new GameError('VALIDATION', affordError)
  corp.credits -= def.buildCost
  for (const mat of def.buildMaterials) {
    removeInventory(state, corp.id, planet.systemId, mat.itemId, mat.quantity)
  }
  const instance: BuildingInstance = {
    id: newId('bld'),
    definitionId: def.id,
    planetId: planet.id,
    ownerId: corp.id
  }
  state.buildings.push(instance)
  return instance
}
