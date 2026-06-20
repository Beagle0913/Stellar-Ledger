import type { Corporation, GameState, ItemId, Ship, TransportJob } from '../shared/types.js'
import { availableQuantity, findInventory } from './economyMath.js'
import { createTransportJob } from './logistics.js'
import {
  npcLogisticsMaxQty,
  npcLogisticsMinShortage,
  npcLogisticsMinSurplus,
  npcLogisticsShortageFraction,
  npcLogisticsSurplusFraction,
  npcStockTarget,
  sortedNpcCorporations,
  systemsForCorp
} from './npc/shared.js'

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

/** Dispatch at most one inter-system haul per NPC corp when surplus/shortage pairs exist. */
export function processNpcLogisticsAI(state: GameState): number {
  let dispatched = 0
  const maxQty = npcLogisticsMaxQty(state)
  const minSurplus = npcLogisticsMinSurplus(state)
  const minShortage = npcLogisticsMinShortage(state)
  const surplusFraction = npcLogisticsSurplusFraction(state)
  const shortageFraction = npcLogisticsShortageFraction(state)

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
      const target = npcStockTarget(state, item.id)
      for (const fromSystemId of systems) {
        const surplus =
          localQty(state, corp.id, fromSystemId, item.id) -
          target * (1 + surplusFraction)
        if (surplus < minSurplus) continue
        if (ship.currentSystemId !== fromSystemId) continue

        for (const toSystemId of systems) {
          if (toSystemId === fromSystemId) continue
          const shortage =
            target * shortageFraction - localQty(state, corp.id, toSystemId, item.id)
          if (shortage < minShortage) continue
          const quantity = Math.min(
            Math.floor(Math.min(surplus, shortage)),
            maxQty,
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
