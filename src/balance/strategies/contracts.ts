import { executeMarketTrade } from '../../simulation/marketTrade.js'
import {
  acceptContract,
  completeContract
} from '../../simulation/progression.js'
import {
  canStartProduction,
  maxAffordableRuns,
  startProductionJob
} from '../../simulation/production.js'
import type { PlayerStrategy } from './types.js'
import { homeSystemId, metalQty, refinery, refineryBusy } from './helpers.js'

/** Accept and work toward the first viable board contract. */
export const contractsStrategy: PlayerStrategy = {
  id: 'contracts',
  playDay(state) {
    const home = homeSystemId(state)
    const b = refinery(state)

    const pending = state.progression.activeContracts.find((c) => !c.accepted)
    if (pending) {
      acceptContract(state, pending.id)
    }

    const active = state.progression.activeContracts.find((c) => c.accepted)
    if (active) {
      if (active.type === 'produce_item' && active.params.itemId === 'metal') {
        if (!refineryBusy(state, b.id)) {
          const runs = maxAffordableRuns(state, b.id, 'recipe_metal_smelting')
          if (runs > 0 && canStartProduction(state, b.id, 'recipe_metal_smelting', runs).ok) {
            startProductionJob(state, b.id, 'recipe_metal_smelting', Math.min(runs, 3))
          }
        }
      }
      if (active.type === 'sell_in_faction' && active.params.itemId) {
        const itemId = active.params.itemId
        const row = state.inventories.find(
          (i) =>
            i.ownerId === state.corporation.id && i.systemId === home && i.itemId === itemId
        )
        if ((row?.quantity ?? 0) >= (active.params.quantity ?? 1)) {
          executeMarketTrade(state, { action: 'sell_max', systemId: home, itemId })
        } else if (itemId === 'metal' && !refineryBusy(state, b.id)) {
          const runs = maxAffordableRuns(state, b.id, 'recipe_metal_smelting')
          if (runs > 0 && canStartProduction(state, b.id, 'recipe_metal_smelting', runs).ok) {
            startProductionJob(state, b.id, 'recipe_metal_smelting', Math.min(runs, 2))
          }
        }
      }

      const progress = active.progress ?? 0
      if (progress >= active.target) {
        completeContract(state, active.id)
      }
    } else if (!refineryBusy(state, b.id)) {
      const runs = Math.min(2, maxAffordableRuns(state, b.id, 'recipe_metal_smelting'))
      if (runs > 0 && canStartProduction(state, b.id, 'recipe_metal_smelting', runs).ok) {
        startProductionJob(state, b.id, 'recipe_metal_smelting', runs)
      }
      if (metalQty(state) >= 4) {
        executeMarketTrade(state, { action: 'sell_max', systemId: home, itemId: 'metal' })
      }
    }
  }
}
