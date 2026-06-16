import { GameError } from '../shared/errors.js'
import { newId } from '../shared/ids.js'
import type { GameState, Ship, TransportJob } from '../shared/types.js'
import {
  addInventory,
  availableQuantity,
  consumeReserved,
  findInventory,
  itemLabel,
  releaseReservation,
  removeInventory,
  reserveInventory,
  systemDistance
} from './economyMath.js'
import { isPlayerCorporation } from './corporations.js'
import { noteInterSystemDelivery } from './progression.js'
import { itemById } from './stateIndex.js'

// Logistics: ships move goods between systems. A transport job reserves the
// goods at the origin and burns fuel up front; on completion the goods are
// delivered into the destination system's inventory.

function shipOrThrow(state: GameState, shipId: string): Ship {
  const ship = state.ships.find((s) => s.id === shipId)
  if (!ship) throw new GameError('NOT_FOUND', `Unknown ship "${shipId}".`)
  return ship
}

/**
 * Create a transport job. Reserves the cargo at the origin and consumes the
 * computed fuel cost from the origin system. Validates capacity and fuel.
 */
export function createTransportJob(
  state: GameState,
  args: { shipId: string; destinationSystemId: string; itemId: string; quantity: number }
): TransportJob {
  const { shipId, destinationSystemId, itemId, quantity } = args
  if (quantity <= 0) throw new GameError('VALIDATION', 'Quantity must be positive.')
  const ship = shipOrThrow(state, shipId)
  const originSystemId = ship.currentSystemId
  if (originSystemId === destinationSystemId) {
    throw new GameError('VALIDATION', 'Origin and destination must differ.')
  }

  const item = itemById(state, itemId)
  if (!item) throw new GameError('NOT_FOUND', `Unknown item "${itemId}".`)
  const cargoVolume = quantity * item.volume
  if (cargoVolume > ship.cargoCapacity) {
    throw new GameError(
      'VALIDATION',
      `Cargo exceeds ${ship.name}'s capacity: ${cargoVolume} volume needed, ${ship.cargoCapacity} available.`
    )
  }

  const distance = systemDistance(state, originSystemId, destinationSystemId)
  const fuelCost = Math.ceil(distance * ship.fuelUsePerDistance)
  const fuelItemId = state.definitions.economyConfig.fuelItemId

  // Need fuel available at the origin (separate from the cargo being moved).
  const fuelRow = findInventory(state, ship.ownerId, originSystemId, fuelItemId)
  const fuelHave = availableQuantity(fuelRow)
  if (fuelHave < fuelCost) {
    throw new GameError(
      'VALIDATION',
      `Not enough ${itemLabel(state, fuelItemId)} at origin: need ${fuelCost}, have ${fuelHave}.`
    )
  }
  // Reserve the cargo so it can't be double-spent while in transit.
  const cargoHave = availableQuantity(findInventory(state, ship.ownerId, originSystemId, itemId))
  if (!reserveInventory(state, ship.ownerId, originSystemId, itemId, quantity)) {
    throw new GameError(
      'VALIDATION',
      `Not enough ${itemLabel(state, itemId)} at origin: need ${quantity}, have ${cargoHave} available.`
    )
  }
  // Burn fuel immediately.
  removeInventory(state, ship.ownerId, originSystemId, fuelItemId, fuelCost)

  const job: TransportJob = {
    id: newId('transport'),
    shipId,
    originSystemId,
    destinationSystemId,
    itemId,
    quantity,
    progress: 0,
    distance,
    fuelCost,
    status: 'running',
    ownerId: ship.ownerId
  }
  state.transportJobs.push(job)
  return job
}

/**
 * Cancel a running transport job. The reserved cargo is released back to the
 * origin system's free inventory and the job is marked 'cancelled' (so it never
 * delivers). The fuel burned at dispatch is NOT refunded — fuel is consumed the
 * moment the ship departs, exactly like the real cost of a scrubbed voyage
 * (documented in ECONOMY.md).
 */
export function cancelTransportJob(state: GameState, jobId: string): TransportJob {
  const job = state.transportJobs.find((j) => j.id === jobId)
  if (!job) throw new GameError('NOT_FOUND', `Unknown transport job "${jobId}".`)
  if (job.status !== 'running') {
    throw new GameError(
      'CONFLICT',
      `Only running transport jobs can be cancelled (job is "${job.status}").`
    )
  }
  releaseReservation(state, job.ownerId, job.originSystemId, job.itemId, job.quantity)
  job.status = 'cancelled'
  return job
}

/**
 * Advance transport jobs by each ship's speed. On arrival the reserved cargo is
 * removed from the origin and added to the destination, and the ship relocates.
 */
export function processTransportJobs(state: GameState): void {
  const shipById = new Map(state.ships.map((s) => [s.id, s]))
  for (const job of state.transportJobs) {
    if (job.status !== 'running') continue
    const ship = shipById.get(job.shipId)
    const step = ship ? ship.speed : 1
    job.progress += step
    if (job.progress < job.distance) continue

    job.status = 'completed'
    consumeReserved(state, job.ownerId, job.originSystemId, job.itemId, job.quantity)
    addInventory(state, job.ownerId, job.destinationSystemId, job.itemId, job.quantity)
    if (job.originSystemId !== job.destinationSystemId && isPlayerCorporation(state, job.ownerId)) {
      noteInterSystemDelivery(state)
    }
    if (ship) ship.currentSystemId = job.destinationSystemId
  }
}
