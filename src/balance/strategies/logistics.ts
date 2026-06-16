import { executeMarketTrade } from '../../simulation/marketTrade.js'
import { createTransportJob } from '../../simulation/logistics.js'
import {
  canStartProduction,
  maxAffordableRuns,
  startProductionJob
} from '../../simulation/production.js'
import type { PlayerStrategy } from './types.js'
import {
  homeSystemId,
  itemQtyAcrossSystems,
  metalQty,
  otherSystemId,
  playerShip,
  refinery,
  refineryBusy,
  shipHasRunningTransport
} from './helpers.js'

/** Haul goods between systems; minimal smelting to stay solvent. */
export const logisticsStrategy: PlayerStrategy = {
  id: 'logistics',
  playDay(state) {
    const home = homeSystemId(state)
    const b = refinery(state)

    if (!refineryBusy(state, b.id)) {
      const runs = Math.min(1, maxAffordableRuns(state, b.id, 'recipe_metal_smelting'))
      if (runs > 0 && canStartProduction(state, b.id, 'recipe_metal_smelting', runs).ok) {
        startProductionJob(state, b.id, 'recipe_metal_smelting', runs)
      }
    }

    if (metalQty(state) >= 6) {
      executeMarketTrade(state, { action: 'sell_max', systemId: home, itemId: 'metal' })
    }

    const ship = playerShip(state)
    if (!shipHasRunningTransport(state, ship.id)) {
      const dest = otherSystemId(state)
      const candidates: Array<{ itemId: string; qty: number }> = [
        { itemId: 'food', qty: 10 },
        { itemId: 'fuel', qty: 10 },
        { itemId: 'metal', qty: 5 }
      ]
      for (const { itemId, qty } of candidates) {
        const have = itemQtyAcrossSystems(state, itemId)
        if (have >= qty) {
          createTransportJob(state, {
            shipId: ship.id,
            destinationSystemId: dest,
            itemId,
            quantity: qty
          })
          break
        }
      }
    }
  }
}
