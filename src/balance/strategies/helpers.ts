import type { GameState } from '../../shared/types.js'
import { getPlayerCorporation } from '../../simulation/corporations.js'
import { findInventory } from '../../simulation/economyMath.js'
import { buildObjectiveViews } from '../../simulation/progression.js'

export function homeSystemId(state: GameState): string {
  return getPlayerCorporation(state).homeSystemId
}

export function otherSystemId(state: GameState): string {
  const home = homeSystemId(state)
  const other = state.definitions.systems.find((s) => s.id !== home)
  if (!other) throw new Error('Balance strategy: no second system in definitions.')
  return other.id
}

export function refinery(state: GameState) {
  const b = state.buildings.find((x) => x.definitionId === 'refinery')
  if (!b) throw new Error('Balance strategy: no refinery in campaign setup.')
  return b
}

export function refineryBusy(state: GameState, buildingId: string): boolean {
  return state.productionJobs.some(
    (j) => j.buildingId === buildingId && (j.status === 'running' || j.status === 'queued')
  )
}

export function metalQty(state: GameState): number {
  return findInventory(state, getPlayerCorporation(state).id, homeSystemId(state), 'metal')?.quantity ?? 0
}

export function playerShip(state: GameState) {
  const ship = state.ships.find((s) => s.ownerId === getPlayerCorporation(state).id)
  if (!ship) throw new Error('Balance strategy: no player ship.')
  return ship
}

export function shipHasRunningTransport(state: GameState, shipId: string): boolean {
  return state.transportJobs.some((j) => j.shipId === shipId && j.status === 'running')
}

export function objectiveStatus(state: GameState, objectiveId: string) {
  return buildObjectiveViews(state).find((o) => o.id === objectiveId)?.status
}

export function objectiveCompleted(state: GameState, objectiveId: string): boolean {
  return buildObjectiveViews(state).find((o) => o.id === objectiveId)?.completed ?? false
}

export function itemQtyAcrossSystems(state: GameState, itemId: string): number {
  let total = 0
  for (const row of state.inventories) {
    if (row.ownerId === getPlayerCorporation(state).id && row.itemId === itemId) {
      total += row.quantity
    }
  }
  return total
}
