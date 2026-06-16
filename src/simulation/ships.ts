import { GameError } from '../shared/errors.js'
import { newId } from '../shared/ids.js'
import type { GameState, Ship } from '../shared/types.js'

import { getPlayerCorporation } from './corporations.js'

/** Purchase a ship from merged definitions; spawns at the corporation home system. */
export function purchaseShip(
  state: GameState,
  shipDefinitionId: string,
  customName?: string
): Ship {
  const def = state.definitions.ships.find((s) => s.id === shipDefinitionId)
  if (!def) throw new GameError('NOT_FOUND', `Unknown ship type "${shipDefinitionId}".`)
  const corp = getPlayerCorporation(state)
  if (corp.credits < def.purchaseCost) {
    throw new GameError(
      'VALIDATION',
      `Not enough credits: need ${def.purchaseCost}, have ${Math.round(corp.credits)}.`
    )
  }
  corp.credits -= def.purchaseCost
  const ship: Ship = {
    id: newId('ship'),
    name: (customName?.trim() || def.name).slice(0, 64),
    definitionId: def.id,
    cargoCapacity: def.cargoCapacity,
    fuelUsePerDistance: def.fuelUsePerDistance,
    speed: def.speed,
    currentSystemId: corp.homeSystemId,
    ownerId: corp.id
  }
  state.ships.push(ship)
  return ship
}

/** Whether the corporation can afford a ship definition. */
export function canAffordShip(state: GameState, shipDefinitionId: string): boolean {
  const def = state.definitions.ships.find((s) => s.id === shipDefinitionId)
  if (!def) return false
  return getPlayerCorporation(state).credits >= def.purchaseCost
}
