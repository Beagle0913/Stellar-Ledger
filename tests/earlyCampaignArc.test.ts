import { describe, expect, it } from 'vitest'
import {
  buildObjectiveViews,
  noteInterSystemDelivery,
  notePlayerSellProceeds,
  noteProductionOutput
} from '../src/simulation/progression.js'
import { purchaseShip } from '../src/simulation/ships.js'
import { runTick } from '../src/simulation/tick.js'
import { getPlayerCorporation, newGame } from './helpers.js'

function objective(state: ReturnType<typeof newGame>, id: string) {
  return buildObjectiveViews(state).find((o) => o.id === id)
}

describe('first-hour campaign arc', () => {
  it('starts with only the first objective active and the rest locked', () => {
    const state = newGame()
    const views = buildObjectiveViews(state)
    expect(views.find((o) => o.id === 'obj_arc_first_metal')?.status).toBe('active')
    expect(views.find((o) => o.id === 'obj_arc_produce')?.status).toBe('locked')
    expect(views.find((o) => o.id === 'obj_arc_revenue')?.status).toBe('locked')
    expect(views.find((o) => o.id === 'obj_arc_convoy')?.status).toBe('locked')
    expect(views.find((o) => o.id === 'obj_arc_fleet')?.status).toBe('locked')
    expect(views.find((o) => o.id === 'obj_net_worth')?.status).toBe('locked')
  })

  it('walks the critical path: smelt, sell, deliver, then buy a second Hauler I', () => {
    const state = newGame()
    const hauler1 = state.definitions.ships.find((s) => s.id === 'ship_hauler_1')!
    const hauler2 = state.definitions.ships.find((s) => s.id === 'ship_hauler_2')!

    // A major upgrade is unaffordable on day one; the starter Hauler I is not.
    expect(getPlayerCorporation(state).credits).toBeLessThan(hauler2.purchaseCost)
    expect(getPlayerCorporation(state).credits).toBeGreaterThanOrEqual(hauler1.purchaseCost)

    // Step 1: first metal.
    noteProductionOutput(state, 'metal', 4)
    expect(objective(state, 'obj_arc_first_metal')?.completed).toBe(true)
    expect(objective(state, 'obj_arc_produce')?.status).toBe('active')

    // Step 2: scale production.
    noteProductionOutput(state, 'metal', 12)
    expect(objective(state, 'obj_arc_produce')?.completed).toBe(true)
    expect(objective(state, 'obj_arc_revenue')?.status).toBe('active')

    // Step 3: revenue from sales.
    notePlayerSellProceeds(state, 2_500)
    expect(objective(state, 'obj_arc_revenue')?.completed).toBe(true)
    expect(objective(state, 'obj_arc_convoy')?.status).toBe('active')

    // Step 4: first inter-system convoy.
    noteInterSystemDelivery(state)
    expect(objective(state, 'obj_arc_convoy')?.completed).toBe(true)
    expect(objective(state, 'obj_arc_fleet')?.status).toBe('active')

    // Step 5: expand the fleet with an affordable second Hauler I.
    purchaseShip(state, 'ship_hauler_1')
    expect(state.ships.filter((s) => s.ownerId === getPlayerCorporation(state).id)).toHaveLength(2)
    expect(objective(state, 'obj_arc_fleet')?.completed).toBe(true)
    expect(objective(state, 'obj_net_worth')?.status).toBe('active')
  })

  it('keeps the convoy step independent of the optional contract side quest', () => {
    const state = newGame()
    // Reach the point where both the optional contract and convoy are unlocked.
    noteProductionOutput(state, 'metal', 16)
    notePlayerSellProceeds(state, 2_500)

    const views = buildObjectiveViews(state)
    expect(views.find((o) => o.id === 'obj_arc_contract')?.status).toBe('active')
    expect(views.find((o) => o.id === 'obj_arc_contract')?.optional).toBe(true)

    // The convoy completes without ever touching a contract.
    noteInterSystemDelivery(state)
    expect(objective(state, 'obj_arc_convoy')?.completed).toBe(true)
    // The optional contract remains incomplete and does not block the main path.
    expect(objective(state, 'obj_arc_contract')?.completed).toBe(false)
  })

  it('completes the early arc with vanilla events enabled and no early punitive fires', () => {
    const state = newGame()
    expect(state.definitions.events.some((e) => e.id === 'evt_logistics_fuel_pressure')).toBe(true)

    // Advance a few days — only harmless pulse-style events may appear.
    for (let i = 0; i < 5; i += 1) runTick(state)
    const earlyPunitive = state.eventsLog.filter(
      (e) =>
        e.eventId === 'evt_logistics_fuel_pressure' ||
        e.eventId === 'evt_machinery_squeeze' ||
        e.eventId === 'evt_food_security_warning'
    )
    expect(earlyPunitive).toHaveLength(0)

    // Locked steps stay locked until the chain unlocks them.
    expect(objective(state, 'obj_arc_revenue')?.status).toBe('locked')

    noteProductionOutput(state, 'metal', 4)
    expect(objective(state, 'obj_arc_first_metal')?.completed).toBe(true)
    expect(objective(state, 'obj_arc_convoy')?.status).toBe('locked')

    noteProductionOutput(state, 'metal', 12)
    expect(objective(state, 'obj_arc_produce')?.completed).toBe(true)

    notePlayerSellProceeds(state, 2_500)
    expect(objective(state, 'obj_arc_revenue')?.completed).toBe(true)
    expect(objective(state, 'obj_arc_convoy')?.status).toBe('active')

    // Events must not complete locked objectives indirectly.
    expect(objective(state, 'obj_arc_fleet')?.completed).toBe(false)
    expect(objective(state, 'obj_net_worth')?.completed).toBe(false)
  })
})
