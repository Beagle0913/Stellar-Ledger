import { describe, expect, it } from 'vitest'
import {
  cancelTransportJob,
  createTransportJob,
  processTransportJobs
} from '../src/simulation/logistics.js'
import { findInventory } from '../src/simulation/economyMath.js'
import { getPlayerCorporation, homeSystemId, newGame, otherSystemId, playerShip } from './helpers.js'

describe('logistics', () => {
  it('rejects transport when cargo exceeds ship capacity', () => {
    const state = newGame()
    const ship = playerShip(state)
    const dest = otherSystemId(state)

    expect(() =>
      createTransportJob(state, {
        shipId: ship.id,
        destinationSystemId: dest,
        itemId: 'machinery',
        quantity: 100
      })
    ).toThrow(/exceeds.*capacity/i)
  })

  it('rejects transport when origin has insufficient fuel', () => {
    const state = newGame()
    const ship = playerShip(state)
    const home = homeSystemId(state)
    const dest = otherSystemId(state)

    // Drain all fuel at the origin.
    const fuelRow = findInventory(state, getPlayerCorporation(state).id, home, 'fuel')!
    fuelRow.quantity = 0
    fuelRow.reserved = 0

    expect(() =>
      createTransportJob(state, {
        shipId: ship.id,
        destinationSystemId: dest,
        itemId: 'ore',
        quantity: 1
      })
    ).toThrow(/Not enough Fuel at origin: need \d+, have 0/)
  })

  it('rejects transport when origin has insufficient cargo', () => {
    const state = newGame()
    const ship = playerShip(state)
    const home = homeSystemId(state)
    const dest = otherSystemId(state)

    const oreRow = findInventory(state, getPlayerCorporation(state).id, home, 'ore')!
    oreRow.quantity = 0
    oreRow.reserved = 0

    expect(() =>
      createTransportJob(state, {
        shipId: ship.id,
        destinationSystemId: dest,
        itemId: 'ore',
        quantity: 5
      })
    ).toThrow(/Not enough Ore at origin: need 5, have 0/)
  })

  it('rejects transport to the same system', () => {
    const state = newGame()
    const ship = playerShip(state)

    expect(() =>
      createTransportJob(state, {
        shipId: ship.id,
        destinationSystemId: ship.currentSystemId,
        itemId: 'ore',
        quantity: 1
      })
    ).toThrow(/Origin and destination must differ/)
  })

  it('delivers reserved cargo to the destination when the job completes', () => {
    const state = newGame()
    const ship = playerShip(state)
    const home = homeSystemId(state)
    const dest = otherSystemId(state)

    createTransportJob(state, {
      shipId: ship.id,
      destinationSystemId: dest,
      itemId: 'ore',
      quantity: 10
    })

    const job = state.transportJobs[0]!
    // Advance until arrival.
    while (job.status === 'running') {
      processTransportJobs(state)
    }

    expect(job.status).toBe('completed')
    expect(ship.currentSystemId).toBe(dest)
    expect(findInventory(state, getPlayerCorporation(state).id, dest, 'ore')?.quantity).toBe(10)
    expect(findInventory(state, getPlayerCorporation(state).id, home, 'ore')?.quantity ?? 0).toBe(130)
  })

  it('cancelling a running job releases the cargo but does not refund fuel', () => {
    const state = newGame()
    const ship = playerShip(state)
    const home = homeSystemId(state)
    const dest = otherSystemId(state)
    const fuelBefore = findInventory(state, getPlayerCorporation(state).id, home, 'fuel')!.quantity

    const job = createTransportJob(state, {
      shipId: ship.id,
      destinationSystemId: dest,
      itemId: 'ore',
      quantity: 10
    })
    const ore = findInventory(state, getPlayerCorporation(state).id, home, 'ore')!
    expect(ore.reserved).toBe(10)
    const fuelAfterDispatch = findInventory(state, getPlayerCorporation(state).id, home, 'fuel')!.quantity
    expect(fuelAfterDispatch).toBeLessThan(fuelBefore)

    cancelTransportJob(state, job.id)

    expect(job.status).toBe('cancelled')
    // Cargo reservation released; goods stay at the origin.
    expect(ore.reserved).toBe(0)
    expect(ore.quantity).toBe(140)
    // Fuel is NOT refunded.
    expect(findInventory(state, getPlayerCorporation(state).id, home, 'fuel')!.quantity).toBe(
      fuelAfterDispatch
    )

    // A cancelled job never delivers, no matter how many ticks pass.
    for (let i = 0; i < 20; i += 1) processTransportJobs(state)
    expect(job.status).toBe('cancelled')
    expect(findInventory(state, getPlayerCorporation(state).id, dest, 'ore')?.quantity ?? 0).toBe(0)
    expect(ship.currentSystemId).toBe(home)
  })

  it('refuses to cancel a non-running job', () => {
    const state = newGame()
    const ship = playerShip(state)
    const dest = otherSystemId(state)

    const job = createTransportJob(state, {
      shipId: ship.id,
      destinationSystemId: dest,
      itemId: 'ore',
      quantity: 5
    })
    while (job.status === 'running') processTransportJobs(state)

    expect(() => cancelTransportJob(state, job.id)).toThrow(/Only running transport jobs/)
    expect(() => cancelTransportJob(state, 'no_such_job')).toThrow(/Unknown transport job/)
  })
})
