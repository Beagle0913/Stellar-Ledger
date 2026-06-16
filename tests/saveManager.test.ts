import { describe, expect, it } from 'vitest'
import { openDatabase } from '../src/database/db.js'
import { createCampaign, loadCampaign, saveState } from '../src/database/saveManager.js'
import { createMarketOrder } from '../src/simulation/market.js'
import { startProductionJob } from '../src/simulation/production.js'
import { runTick } from '../src/simulation/tick.js'
import { loadVanillaDefs, standardScenario } from './helpers.js'

// End-to-end SQLite round-trip using an in-memory database. Also verifies the
// native better-sqlite3 binary loads under plain Node.
describe('save manager (sqlite round-trip)', () => {
  it('creates a campaign, persists a tick, and reloads identical state', () => {
    const db = openDatabase(':memory:')
    const defs = loadVanillaDefs()

    const state = createCampaign(db, defs, 'Roundtrip', standardScenario(defs))
    expect(state.corporation.credits).toBe(38_000)
    expect(state.buildings.length).toBeGreaterThan(0)

    const powerPlant = state.buildings.find((b) => b.definitionId === 'power_plant')!
    startProductionJob(state, powerPlant.id, 'recipe_energy_generation', 1)
    runTick(state)
    saveState(db, state)

    const reloaded = loadCampaign(db)
    expect(reloaded.meta.tick).toBe(1)
    expect(reloaded.corporation.credits).toBe(state.corporation.credits)
    // Frozen definitions survive the round-trip.
    expect(reloaded.definitions.items.length).toBe(defs.items.length)
    expect(reloaded.definitions.recipes.length).toBe(defs.recipes.length)
    expect(reloaded.productionJobs.length).toBe(state.productionJobs.length)
    // The energy produced by the completed job persisted.
    const energy = reloaded.inventories.find(
      (r) => r.itemId === 'energy' && r.systemId === reloaded.corporation.homeSystemId
    )
    expect(energy && energy.quantity).toBeGreaterThan(50)

    db.close()
  })

  it('persists state consistently after multiple ticks with production and market activity', () => {
    const db = openDatabase(':memory:')
    const defs = loadVanillaDefs()
    const state = createCampaign(db, defs, 'Multi-tick', standardScenario(defs))

    const home = state.corporation.homeSystemId
    const refinery = state.buildings.find((b) => b.definitionId === 'refinery')!
    startProductionJob(state, refinery.id, 'recipe_metal_smelting', 1)

    runTick(state) // day 1: job still running (duration 2)
    runTick(state) // day 2: job completes

    createMarketOrder(state, {
      systemId: home,
      itemId: 'metal',
      side: 'sell',
      quantity: 2,
      price: 1,
      tick: state.meta.tick
    })
    runTick(state) // day 3: market match

    saveState(db, state)
    const reloaded = loadCampaign(db)

    expect(reloaded.meta.tick).toBe(3)
    expect(reloaded.productionJobs.some((j) => j.status === 'completed')).toBe(true)
    expect(reloaded.priceHistory.length).toBeGreaterThan(0)
    expect(reloaded.corporation.credits).toBe(state.corporation.credits)
    expect(reloaded.inventories.length).toBe(state.inventories.length)

    db.close()
  })
})
