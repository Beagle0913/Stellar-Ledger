import { describe, expect, it } from 'vitest'
import { STARTING_CREDITS, STARTING_STOCK } from '../src/shared/balance.js'
import { STARTING_CREDITS as CONST_EXPORT } from '../src/shared/constants.js'
import { estimateInventoryValue } from '../src/simulation/economyMath.js'
import { executeMarketTrade } from '../src/simulation/marketTrade.js'
import {
  canStartProduction,
  maxAffordableRuns,
  repeatProductionJob,
  startProductionJob
} from '../src/simulation/production.js'
import { purchaseShip } from '../src/simulation/ships.js'
import { runTick } from '../src/simulation/tick.js'
import { buildObjectiveViews } from '../src/simulation/progression.js'
import { findInventory } from '../src/simulation/economyMath.js'
import { getPlayerCorporation, homeSystemId, newGame } from './helpers.js'

function refinery(state: ReturnType<typeof newGame>) {
  const b = state.buildings.find((x) => x.definitionId === 'refinery')
  if (!b) throw new Error('No refinery in test setup')
  return b
}

function refineryBusy(state: ReturnType<typeof newGame>, buildingId: string): boolean {
  return state.productionJobs.some(
    (j) => j.buildingId === buildingId && (j.status === 'running' || j.status === 'queued')
  )
}

function metalQty(state: ReturnType<typeof newGame>): number {
  return findInventory(state, getPlayerCorporation(state).id, homeSystemId(state), 'metal')?.quantity ?? 0
}

function netWorth(state: ReturnType<typeof newGame>): number {
  return Math.round(getPlayerCorporation(state).credits + estimateInventoryValue(state, getPlayerCorporation(state).id))
}

function playDayNormal(state: ReturnType<typeof newGame>): void {
  const home = homeSystemId(state)
  const b = refinery(state)
  if (!refineryBusy(state, b.id)) {
    const runs = Math.min(2, maxAffordableRuns(state, b.id, 'recipe_metal_smelting'))
    if (runs > 0 && canStartProduction(state, b.id, 'recipe_metal_smelting', runs).ok) {
      startProductionJob(state, b.id, 'recipe_metal_smelting', runs)
    }
  }
  if (metalQty(state) >= 4) {
    try {
      executeMarketTrade(state, { action: 'sell_max', systemId: home, itemId: 'metal' })
    } catch {
      // book may not cross; skip
    }
  }
  runTick(state)
}

function playDayOptimal(state: ReturnType<typeof newGame>): void {
  const home = homeSystemId(state)
  const b = refinery(state)
  if (!refineryBusy(state, b.id)) {
    const runs = maxAffordableRuns(state, b.id, 'recipe_metal_smelting')
    if (runs > 0) repeatProductionJob(state, b.id, 'recipe_metal_smelting', Math.min(runs, 5))
  }
  if (metalQty(state) >= 2) {
    try {
      executeMarketTrade(state, { action: 'sell_max', systemId: home, itemId: 'metal' })
    } catch {
      // skip
    }
  }
  runTick(state)
}

describe('early campaign balance (first 30 days)', () => {
  it('starts with tuned credits export', () => {
    expect(CONST_EXPORT).toBe(STARTING_CREDITS)
  })

  it('bad play (ticks only) does not create free wealth', () => {
    const state = newGame()
    const startCredits = getPlayerCorporation(state).credits
    for (let i = 0; i < 30; i += 1) runTick(state)
    expect(getPlayerCorporation(state).credits).toBeLessThanOrEqual(startCredits + 500)
    expect(netWorth(state)).toBeLessThan(130_000)
  })

  it('normal smelt-and-sell loop grows modestly without hitting net-worth objective', () => {
    const state = newGame()
    const startCredits = getPlayerCorporation(state).credits
    for (let i = 0; i < 30; i += 1) playDayNormal(state)
    expect(getPlayerCorporation(state).credits).toBeGreaterThan(startCredits * 0.85)
    expect(getPlayerCorporation(state).credits).toBeLessThan(startCredits * 1.35)
    const objectives = buildObjectiveViews(state)
    expect(objectives.find((o) => o.id === 'obj_net_worth')?.completed).toBe(false)
  })

  it('optimal play can afford Hauler II after several weeks but not on day one', () => {
    const state = newGame()
    const hauler2 = state.definitions.ships.find((s) => s.id === 'ship_hauler_2')!
    expect(getPlayerCorporation(state).credits).toBeLessThan(hauler2.purchaseCost)

    let affordableDay: number | null = null
    for (let day = 1; day <= 55; day += 1) {
      playDayOptimal(state)
      if (getPlayerCorporation(state).credits >= hauler2.purchaseCost && affordableDay === null) {
        affordableDay = day
      }
    }
    expect(affordableDay).not.toBeNull()
    expect(affordableDay!).toBeGreaterThanOrEqual(8)
    expect(affordableDay!).toBeLessThanOrEqual(50)

    purchaseShip(state, 'ship_hauler_2')
    expect(state.ships.length).toBe(2)
    expect(getPlayerCorporation(state).credits).toBeGreaterThanOrEqual(0)
  })

  it('starting energy supports several smelts then becomes a constraint', () => {
    const state = newGame()
    const home = homeSystemId(state)
    const b = refinery(state)
    let smeltStarts = 0
    for (let i = 0; i < 15; i += 1) {
      if (!refineryBusy(state, b.id) && canStartProduction(state, b.id, 'recipe_metal_smelting', 1).ok) {
        startProductionJob(state, b.id, 'recipe_metal_smelting', 1)
        smeltStarts += 1
      }
      runTick(state)
    }
    expect(smeltStarts).toBeGreaterThan(3)
    const energy = findInventory(state, getPlayerCorporation(state).id, home, 'energy')?.quantity ?? 0
    expect(energy).toBeLessThan(STARTING_STOCK.energy ?? 65)
  })
})
