import { executeMarketTrade } from '../../simulation/marketTrade.js'
import {
  canStartProduction,
  maxAffordableRuns,
  repeatProductionJob,
  startProductionJob
} from '../../simulation/production.js'
import type { PlayerStrategy } from './types.js'
import { homeSystemId, metalQty, refinery, refineryBusy } from './helpers.js'

function smeltAndSellDay(
  state: Parameters<PlayerStrategy['playDay']>[0],
  maxRuns: number,
  sellThreshold: number,
  useRepeat: boolean
): void {
  const home = homeSystemId(state)
  const b = refinery(state)
  if (!refineryBusy(state, b.id)) {
    const runs = maxAffordableRuns(state, b.id, 'recipe_metal_smelting')
    if (runs > 0) {
      const batch = Math.min(runs, maxRuns)
      if (useRepeat) {
        repeatProductionJob(state, b.id, 'recipe_metal_smelting', batch)
      } else if (canStartProduction(state, b.id, 'recipe_metal_smelting', batch).ok) {
        startProductionJob(state, b.id, 'recipe_metal_smelting', batch)
      }
    }
  }
  if (metalQty(state) >= sellThreshold) {
    executeMarketTrade(state, { action: 'sell_max', systemId: home, itemId: 'metal' })
  }
}

/** Modest smelt-and-sell loop (≤2 runs per day). */
export const smeltAndSellStrategy: PlayerStrategy = {
  id: 'smeltAndSell',
  playDay(state) {
    smeltAndSellDay(state, 2, 4, false)
  }
}

/** Aggressive smelt-and-sell for milestone / Hauler II pacing tests. */
export const smeltAndSellOptimalStrategy: PlayerStrategy = {
  id: 'smeltAndSellOptimal',
  playDay(state) {
    smeltAndSellDay(state, 5, 2, true)
  }
}
