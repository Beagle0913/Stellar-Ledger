import { executeMarketTrade } from '../../simulation/marketTrade.js'
import { createTransportJob } from '../../simulation/logistics.js'
import {
  canStartProduction,
  maxAffordableRuns,
  repeatProductionJob,
  startProductionJob
} from '../../simulation/production.js'
import { purchaseShip } from '../../simulation/ships.js'
import type { PlayerStrategy } from './types.js'
import {
  homeSystemId,
  metalQty,
  objectiveCompleted,
  objectiveStatus,
  otherSystemId,
  playerShip,
  refinery,
  refineryBusy,
  shipHasRunningTransport
} from './helpers.js'

function buildingBusy(state: Parameters<typeof refineryBusy>[0], buildingId: string): boolean {
  return state.productionJobs.some(
    (j) => j.buildingId === buildingId && (j.status === 'running' || j.status === 'queued')
  )
}

function availableAtHome(state: Parameters<typeof homeSystemId>[0], itemId: string): number {
  const home = homeSystemId(state)
  const row = state.inventories.find(
    (i) => i.ownerId === state.corporation.id && i.systemId === home && i.itemId === itemId
  )
  return (row?.quantity ?? 0) - (row?.reserved ?? 0)
}

/** First-hour arc via real smelt, sell, convoy, and fleet expansion. */
export const arcPlayStrategy: PlayerStrategy = {
  id: 'arcPlay',
  playDay(state) {
    const home = homeSystemId(state)
    const b = refinery(state)
    const revenueActive = objectiveStatus(state, 'obj_arc_revenue') === 'active'
    const convoyPrereqsMet =
      objectiveCompleted(state, 'obj_arc_produce') &&
      (state.progression.totalSellProceeds ?? 0) >= 2000
    const convoyPending =
      (objectiveStatus(state, 'obj_arc_convoy') === 'active' || convoyPrereqsMet) &&
      !state.progression.firstInterSystemDelivery

    const plant = state.buildings.find((x) => x.definitionId === 'power_plant')
    if (plant && !buildingBusy(state, plant.id)) {
      const energy = availableAtHome(state, 'energy')
      if (energy < 30) {
        const can = canStartProduction(state, plant.id, 'recipe_energy_generation', 1)
        if (can.ok) startProductionJob(state, plant.id, 'recipe_energy_generation', 1)
      }
    }

    const mine = state.buildings.find((x) => x.definitionId === 'mine')
    if (mine && !buildingBusy(state, mine.id) && availableAtHome(state, 'ore') < 20) {
      const can = canStartProduction(state, mine.id, 'recipe_ore_mining', 1)
      if (can.ok) startProductionJob(state, mine.id, 'recipe_ore_mining', 1)
    }

    if (!refineryBusy(state, b.id)) {
      const runs = maxAffordableRuns(state, b.id, 'recipe_metal_smelting')
      if (runs > 0) {
        repeatProductionJob(state, b.id, 'recipe_metal_smelting', Math.min(runs, 5))
      }
    }

    const metalReserve = convoyPending ? 8 : 0
    const sellThreshold = revenueActive ? 2 : 4
    if (metalQty(state) > metalReserve + sellThreshold - 1) {
      executeMarketTrade(state, { action: 'sell_max', systemId: home, itemId: 'metal' })
    }

    if (revenueActive && (state.progression.totalSellProceeds ?? 0) < 2000 && metalQty(state) > metalReserve + 1) {
      executeMarketTrade(state, { action: 'sell_max', systemId: home, itemId: 'metal' })
    }

    const fleetActive =
      objectiveStatus(state, 'obj_arc_fleet') === 'active' ||
      state.progression.firstInterSystemDelivery
    const ship = playerShip(state)

    if (convoyPending && !shipHasRunningTransport(state, ship.id)) {
      const dest = otherSystemId(state)
      const metalAvailable = availableAtHome(state, 'metal')
      if (metalAvailable >= 4) {
        createTransportJob(state, {
          shipId: ship.id,
          destinationSystemId: dest,
          itemId: 'metal',
          quantity: Math.min(8, metalAvailable)
        })
      } else {
        const farm = state.buildings.find((x) => x.definitionId === 'farm')
        if (farm && !buildingBusy(state, farm.id)) {
          const can = canStartProduction(state, farm.id, 'recipe_food_production', 1)
          if (can.ok) startProductionJob(state, farm.id, 'recipe_food_production', 1)
        }
        const foodAvailable = availableAtHome(state, 'food')
        if (foodAvailable >= 4) {
          createTransportJob(state, {
            shipId: ship.id,
            destinationSystemId: dest,
            itemId: 'food',
            quantity: Math.min(8, foodAvailable)
          })
        }
      }
    }

    if (fleetActive) {
      const hauler1 = state.definitions.ships.find((s) => s.id === 'ship_hauler_1')
      const playerShips = state.ships.filter((s) => s.ownerId === state.corporation.id)
      if (hauler1 && playerShips.length < 2 && state.corporation.credits >= hauler1.purchaseCost) {
        purchaseShip(state, 'ship_hauler_1')
      }
    }
  }
}
