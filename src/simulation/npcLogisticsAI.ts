import type { Corporation, GameState, ItemId, Ship, TransportJob } from '../shared/types.js'
import { getNpcCorporations } from './corporations.js'
import { availableQuantity, findInventory } from './economyMath.js'
import { createTransportJob } from './logistics.js'

const MAX_LOGISTICS_QTY = 60
const MIN_SURPLUS = 10
const MIN_SHORTAGE = 10
const SURPLUS_FRACTION = 0.3
const SHORTAGE_FRACTION = 0.5

const DEFAULT_TARGETS: Record<string, number> = {
  ore: 80,
  metal: 30,
  machinery: 4,
  energy: 40,
  fuel: 30
}

function itemTarget(itemId: ItemId): number {
  return DEFAULT_TARGETS[itemId] ?? 20
}

function sortedNpcCorporations(state: GameState): Corporation[] {
  return getNpcCorporations(state).slice().sort((a, b) => a.id.localeCompare(b.id))
}

function corpRunningTransport(state: GameState, corpId: string): TransportJob | undefined {
  return state.transportJobs.find((j) => j.ownerId === corpId && j.status === 'running')
}

function idleShipForCorp(state: GameState, corpId: string): Ship | undefined {
  const busy = new Set(
    state.transportJobs.filter((j) => j.status === 'running').map((j) => j.shipId)
  )
  return state.ships
    .filter((s) => s.ownerId === corpId && !busy.has(s.id))
    .sort((a, b) => a.id.localeCompare(b.id))[0]
}

function localQty(state: GameState, corpId: string, systemId: string, itemId: ItemId): number {
  return availableQuantity(findInventory(state, corpId, systemId, itemId))
}

function systemsForCorp(state: GameState, corp: Corporation): string[] {
  const systems = new Set<string>([corp.homeSystemId])
  for (const row of state.inventories) {
    if (row.ownerId === corp.id) systems.add(row.systemId)
  }
  return [...systems].sort((a, b) => a.localeCompare(b))
}

/** Dispatch at most one inter-system haul per NPC corp when surplus/shortage pairs exist. */
export function processNpcLogisticsAI(state: GameState): number {
  let dispatched = 0

  for (const corp of sortedNpcCorporations(state)) {
    if (corpRunningTransport(state, corp.id)) continue
    const ship = idleShipForCorp(state, corp.id)
    if (!ship) continue

    const systems = systemsForCorp(state, corp)
    const items = state.definitions.items.slice().sort((a, b) => a.id.localeCompare(b.id))

    let best:
      | { itemId: ItemId; fromSystemId: string; toSystemId: string; quantity: number }
      | undefined

    for (const item of items) {
      const target = itemTarget(item.id)
      for (const fromSystemId of systems) {
        const surplus =
          localQty(state, corp.id, fromSystemId, item.id) -
          target * (1 + SURPLUS_FRACTION)
        if (surplus < MIN_SURPLUS) continue
        if (ship.currentSystemId !== fromSystemId) continue

        for (const toSystemId of systems) {
          if (toSystemId === fromSystemId) continue
          const shortage =
            target * SHORTAGE_FRACTION - localQty(state, corp.id, toSystemId, item.id)
          if (shortage < MIN_SHORTAGE) continue
          const quantity = Math.min(
            Math.floor(Math.min(surplus, shortage)),
            MAX_LOGISTICS_QTY,
            Math.floor(ship.cargoCapacity / (item.volume || 1))
          )
          if (quantity <= 0) continue
          if (
            !best ||
            quantity > best.quantity ||
            (quantity === best.quantity && fromSystemId.localeCompare(best.fromSystemId) < 0)
          ) {
            best = { itemId: item.id, fromSystemId, toSystemId, quantity }
          }
        }
      }
    }

    if (!best) continue
    try {
      createTransportJob(state, {
        shipId: ship.id,
        destinationSystemId: best.toSystemId,
        itemId: best.itemId,
        quantity: best.quantity
      })
      dispatched += 1
    } catch {
      // Insufficient fuel or cargo — skip this corp this tick.
    }
  }

  return dispatched
}
