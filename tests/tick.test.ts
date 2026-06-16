import { describe, expect, it } from 'vitest'
import { PRICE_HISTORY_RETENTION_TICKS, runTick, runTicks } from '../src/simulation/tick.js'
import { startProductionJob } from '../src/simulation/production.js'
import { findInventory } from '../src/simulation/economyMath.js'
import { getPlayerCorporation, newGame } from './helpers.js'

describe('simulation tick', () => {
  it('advances the day counter and completes a production job in one tick', () => {
    const state = newGame()
    const home = getPlayerCorporation(state).homeSystemId
    const powerPlant = state.buildings.find((b) => b.definitionId === 'power_plant')!
    startProductionJob(state, powerPlant.id, 'recipe_energy_generation', 1)

    const energyBefore = findInventory(state, getPlayerCorporation(state).id, home, 'energy')?.quantity ?? 0
    const result = runTick(state)

    expect(result.tick).toBe(1)
    expect(state.meta.tick).toBe(1)
    expect(result.completedProductionJobs).toBe(1)
    expect(state.meta.ticking).toBe(false)
    expect(Array.isArray(result.marketChanges)).toBe(true)

    const energyAfter = findInventory(state, getPlayerCorporation(state).id, home, 'energy')?.quantity ?? 0
    expect(energyAfter).toBeGreaterThan(energyBefore)
  })

  it('is deterministic across two consecutive ticks', () => {
    const state = newGame()
    runTick(state)
    runTick(state)
    expect(state.meta.tick).toBe(2)
  })

  it('guards against re-entrant ticks', () => {
    const state = newGame()
    // Simulate an in-progress tick; a second call must refuse.
    state.meta.ticking = true
    expect(() => runTick(state)).toThrow(/already in progress/)
  })

  it('prunes price history older than the retention window', () => {
    const state = newGame()
    const marketId = state.markets[0]!.id
    // Pretend the campaign is far along, with one ancient and one recent row.
    state.meta.tick = 500
    state.priceHistory.push({ marketId, itemId: 'ore', tick: 50, price: 9 })
    state.priceHistory.push({ marketId, itemId: 'ore', tick: 400, price: 12 })

    runTick(state)

    const cutoff = state.meta.tick - PRICE_HISTORY_RETENTION_TICKS
    expect(state.priceHistory.some((r) => r.tick === 50)).toBe(false)
    expect(state.priceHistory.some((r) => r.tick === 400)).toBe(true)
    expect(state.priceHistory.every((r) => r.tick > cutoff)).toBe(true)
  })
})

describe('runTicks batch advancement', () => {
  it('runTicks(5) produces a state identical to 5 sequential runTick calls', () => {
    const batched = newGame()
    const sequential = newGame()

    const batchResult = runTicks(batched, 5)
    let lastTick = 0
    let trades = 0
    for (let i = 0; i < 5; i += 1) {
      const r = runTick(sequential)
      lastTick = r.tick
      trades += r.trades
    }

    expect(batchResult.tick).toBe(lastTick)
    expect(batchResult.trades).toBe(trades)
    expect(batched.meta.tick).toBe(sequential.meta.tick)
    expect(getPlayerCorporation(batched).credits).toBe(getPlayerCorporation(sequential).credits)
    expect(batched.priceHistory.length).toBe(sequential.priceHistory.length)
    expect(batched.localStockpiles).toEqual(sequential.localStockpiles)
  })

  it('rejects out-of-range tick counts', () => {
    const state = newGame()
    expect(() => runTicks(state, 0)).toThrow(/between 1 and 365/)
    expect(() => runTicks(state, 366)).toThrow(/between 1 and 365/)
    expect(() => runTicks(state, 2.5)).toThrow(/between 1 and 365/)
  })
})
