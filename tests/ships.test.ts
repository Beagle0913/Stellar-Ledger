import { describe, expect, it } from 'vitest'
import { cancelProductionJob, startProductionJob } from '../src/simulation/production.js'
import { findInventory } from '../src/simulation/economyMath.js'
import { purchaseShip } from '../src/simulation/ships.js'
import { createTransportJob } from '../src/simulation/logistics.js'
import { openDatabase } from '../src/database/db.js'
import { createCampaign, loadCampaign, saveState } from '../src/database/saveManager.js'
import { getPlayerCorporation, loadVanillaDefs, newGame, otherSystemId, playerShips, standardScenario } from './helpers.js'

describe('ships', () => {
  it('purchaseShip adds a second ship at the home system', () => {
    const state = newGame()
    expect(playerShips(state)).toHaveLength(1)
    getPlayerCorporation(state).credits = 50_000
    purchaseShip(state, 'ship_hauler_2')
    expect(playerShips(state)).toHaveLength(2)
    expect(playerShips(state)[1]!.cargoCapacity).toBe(200)
    expect(playerShips(state)[1]!.currentSystemId).toBe(getPlayerCorporation(state).homeSystemId)
  })

  it('two ships can run concurrent transport jobs', () => {
    const state = newGame()
    getPlayerCorporation(state).credits = 50_000
    purchaseShip(state, 'ship_hauler_2')
    const [shipA, shipB] = playerShips(state)
    const dest = otherSystemId(state)

    createTransportJob(state, {
      shipId: shipA!.id,
      destinationSystemId: dest,
      itemId: 'ore',
      quantity: 5
    })
    createTransportJob(state, {
      shipId: shipB!.id,
      destinationSystemId: dest,
      itemId: 'food',
      quantity: 5
    })

    expect(state.transportJobs.filter((j) => j.status === 'running')).toHaveLength(2)
  })

  it('ships round-trip through save/load', () => {
    const defs = loadVanillaDefs()
    const db = openDatabase(':memory:')
    const created = createCampaign(db, defs, 'Fleet Save', standardScenario(defs))
    getPlayerCorporation(created).credits = 50_000
    purchaseShip(created, 'ship_hauler_2')
    saveState(db, created)
    const loaded = loadCampaign(db)
    expect(playerShips(loaded)).toHaveLength(2)
  })
})

describe('production cancel', () => {
  it('cancelProductionJob marks running job cancelled without refunding inputs', () => {
    const state = newGame()
    const refinery = state.buildings.find((b) => b.definitionId === 'refinery')!
    const home = getPlayerCorporation(state).homeSystemId
    const oreBefore = findInventory(state, getPlayerCorporation(state).id, home, 'ore')!.quantity

    const job = startProductionJob(state, refinery.id, 'recipe_metal_smelting', 1)
    const oreAfterStart = findInventory(state, getPlayerCorporation(state).id, home, 'ore')!.quantity
    expect(oreBefore - oreAfterStart).toBe(4)

    cancelProductionJob(state, job.id)
    expect(job.status).toBe('cancelled')
    expect(findInventory(state, getPlayerCorporation(state).id, home, 'ore')!.quantity).toBe(oreAfterStart)
  })
})
