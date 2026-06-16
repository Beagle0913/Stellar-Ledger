import { describe, expect, it } from 'vitest'
import type { EventDefinition } from '../src/shared/types.js'
import { NPC_OWNER } from '../src/shared/types.js'
import { eventEligible, processEvents } from '../src/simulation/events.js'
import { getPlayerCorporation, loadVanillaDefs, newGame } from './helpers.js'

// Tests for the event trigger/effect unions, focusing on the v0.1.3 additions:
// stockpileShortage trigger, stockpileShock and creditBonus effects.

function eventDef(
  partial: Pick<EventDefinition, 'trigger' | 'effect'> & Partial<EventDefinition>
): EventDefinition {
  return {
    id: 'evt_test',
    name: 'Test Event',
    description: 'test',
    ...partial
  }
}

function completeObjective(state: ReturnType<typeof newGame>, objectiveId: string): void {
  const entry = state.progression.objectives.find((o) => o.objectiveId === objectiveId)
  if (entry) entry.completed = true
}

describe('eventEligible gating', () => {
  it('blocks events before minCampaignTick', () => {
    const state = newGame()
    const event = eventDef({
      minCampaignTick: 10,
      trigger: { type: 'tickInterval', everyTicks: 1 },
      effect: { type: 'message' }
    })
    expect(eventEligible(state, event, 9)).toBe(false)
    expect(eventEligible(state, event, 10)).toBe(true)
  })

  it('blocks events until requiresCompletedObjectiveId is complete', () => {
    const state = newGame()
    const event = eventDef({
      requiresCompletedObjectiveId: 'obj_arc_convoy',
      trigger: { type: 'tickInterval', everyTicks: 1 },
      effect: { type: 'message' }
    })
    expect(eventEligible(state, event, 5)).toBe(false)
    completeObjective(state, 'obj_arc_convoy')
    expect(eventEligible(state, event, 5)).toBe(true)
  })

  it('enforces cooldownTicks via eventLastFiredTick', () => {
    const state = newGame()
    const event = eventDef({
      cooldownTicks: 5,
      trigger: { type: 'tickInterval', everyTicks: 1 },
      effect: { type: 'message' }
    })
    state.progression.eventLastFiredTick = { evt_test: 10 }
    expect(eventEligible(state, event, 14)).toBe(false)
    expect(eventEligible(state, event, 15)).toBe(true)
  })
})

describe('processEvents cooldown and eventLastFiredTick', () => {
  it('does not fire persistent triggers every tick when cooldown is set', () => {
    const state = newGame()
    state.definitions.events = [
      eventDef({
        cooldownTicks: 5,
        trigger: { type: 'lowStock', itemId: 'fuel', threshold: 100 },
        effect: { type: 'message' }
      })
    ]
    state.inventories = state.inventories.filter((r) => r.itemId !== 'fuel')

    processEvents(state, 1)
    processEvents(state, 2)
    processEvents(state, 3)

    expect(state.eventsLog).toHaveLength(1)
    expect(state.progression.eventLastFiredTick?.evt_test).toBe(1)
  })
})

describe('vanilla economic-drama events', () => {
  const defs = loadVanillaDefs()

  it('loads gated drama events from vanilla data', () => {
    const fuel = defs.events.find((e) => e.id === 'evt_logistics_fuel_pressure')
    expect(fuel?.requiresCompletedObjectiveId).toBe('obj_arc_convoy')
    expect(defs.events.find((e) => e.id === 'evt_fuel_shortage')).toBeUndefined()
  })

  it('evt_metal_buyer_rally raises NPC metal prices when eligible', () => {
    const state = newGame()
    const rally = defs.events.find((e) => e.id === 'evt_metal_buyer_rally')!
    state.definitions.events = [rally]
    completeObjective(state, 'obj_arc_revenue')

    const before = state.orders.find(
      (o) => o.ownerId === NPC_OWNER && o.itemId === 'metal' && o.side === 'sell'
    )!.price

    processEvents(state, 14)
    const after = state.orders.find(
      (o) => o.ownerId === NPC_OWNER && o.itemId === 'metal' && o.side === 'sell'
    )!.price
    expect(after).toBeGreaterThan(before)
  })

  it('evt_logistics_fuel_pressure does not fire before convoy objective completes', () => {
    const state = newGame()
    const fuelEvent = defs.events.find((e) => e.id === 'evt_logistics_fuel_pressure')!
    state.definitions.events = [fuelEvent]
    state.inventories = state.inventories.filter((r) => r.itemId !== 'fuel')

    processEvents(state, 15)
    expect(state.eventsLog).toHaveLength(0)
  })

  it('evt_logistics_fuel_pressure fires once after convoy with low fuel and respects cooldown', () => {
    const state = newGame()
    const fuelEvent = defs.events.find((e) => e.id === 'evt_logistics_fuel_pressure')!
    state.definitions.events = [fuelEvent]
    completeObjective(state, 'obj_arc_convoy')
    state.inventories = state.inventories.filter((r) => r.itemId !== 'fuel')

    processEvents(state, 15)
    processEvents(state, 16)
    processEvents(state, 17)

    expect(state.eventsLog).toHaveLength(1)
    expect(state.eventsLog[0]!.eventId).toBe('evt_logistics_fuel_pressure')
    expect(state.progression.eventLastFiredTick?.evt_logistics_fuel_pressure).toBe(15)
  })

  it('evt_food_security_warning logs a message when eligible and shortage exists', () => {
    const state = newGame()
    const warning = defs.events.find((e) => e.id === 'evt_food_security_warning')!
    state.definitions.events = [warning]
    completeObjective(state, 'obj_arc_revenue')
    state.localStockpiles = [{ marketId: 'market_sys_helion', itemId: 'food', quantity: 150 }]

    processEvents(state, 15)
    expect(state.eventsLog).toHaveLength(1)
    expect(state.eventsLog[0]!.message).toContain('Food Security Warning')
  })

  it('evt_food_relief_convoy replenishes stockpiles when eligible', () => {
    const state = newGame()
    const relief = defs.events.find((e) => e.id === 'evt_food_relief_convoy')!
    state.definitions.events = [relief]
    completeObjective(state, 'obj_arc_produce')
    state.localStockpiles = [{ marketId: 'market_sys_helion', itemId: 'food', quantity: 50 }]

    processEvents(state, 15)
    expect(state.localStockpiles[0]!.quantity).toBe(200)
  })

  it('evt_food_relief_convoy cooldown prevents repeated relief on consecutive ticks', () => {
    const state = newGame()
    const relief = defs.events.find((e) => e.id === 'evt_food_relief_convoy')!
    state.definitions.events = [relief]
    completeObjective(state, 'obj_arc_produce')
    state.localStockpiles = [{ marketId: 'market_sys_helion', itemId: 'food', quantity: 50 }]

    processEvents(state, 15)
    processEvents(state, 16)
    processEvents(state, 17)

    expect(state.eventsLog).toHaveLength(1)
    expect(state.localStockpiles[0]!.quantity).toBe(200)
  })

  it('evt_machinery_squeeze is blocked before fleet objective completes', () => {
    const state = newGame()
    const squeeze = defs.events.find((e) => e.id === 'evt_machinery_squeeze')!
    state.definitions.events = [squeeze]
    state.localStockpiles = [{ marketId: 'market_sys_helion', itemId: 'machinery', quantity: 50 }]

    processEvents(state, 25)
    expect(state.eventsLog).toHaveLength(0)
  })
})

describe('stockpileShortage trigger', () => {
  it('fires when ANY market stockpile of the item is below the threshold', () => {
    const state = newGame()
    state.definitions.events = [
      eventDef({
        trigger: { type: 'stockpileShortage', itemId: 'food', threshold: 100 },
        effect: { type: 'message' }
      })
    ]
    state.localStockpiles = [
      { marketId: 'market_sys_helion', itemId: 'food', quantity: 40 },
      { marketId: 'market_sys_quill', itemId: 'food', quantity: 900 }
    ]

    processEvents(state, 1)
    expect(state.eventsLog).toHaveLength(1)
  })

  it('does not fire when all stockpiles are at or above the threshold', () => {
    const state = newGame()
    state.definitions.events = [
      eventDef({
        trigger: { type: 'stockpileShortage', itemId: 'food', threshold: 100 },
        effect: { type: 'message' }
      })
    ]
    state.localStockpiles = [
      { marketId: 'market_sys_helion', itemId: 'food', quantity: 100 },
      // A different item below threshold must not trigger a food shortage.
      { marketId: 'market_sys_helion', itemId: 'ore', quantity: 1 }
    ]

    processEvents(state, 1)
    expect(state.eventsLog).toHaveLength(0)
  })
})

describe('stockpileShock effect', () => {
  it('adds delta to every market stockpile of the item, clamped at 0', () => {
    const state = newGame()
    state.definitions.events = [
      eventDef({
        trigger: { type: 'tickInterval', everyTicks: 1 },
        effect: { type: 'stockpileShock', itemId: 'food', delta: -60 }
      })
    ]
    state.localStockpiles = [
      { marketId: 'market_sys_helion', itemId: 'food', quantity: 200 },
      { marketId: 'market_sys_quill', itemId: 'food', quantity: 30 },
      { marketId: 'market_sys_helion', itemId: 'ore', quantity: 10 }
    ]

    processEvents(state, 1)

    expect(state.localStockpiles[0]!.quantity).toBe(140)
    expect(state.localStockpiles[1]!.quantity).toBe(0) // clamped, not -30
    expect(state.localStockpiles[2]!.quantity).toBe(10) // other items untouched
    expect(state.eventsLog).toHaveLength(1)
  })

  it('positive delta replenishes stockpiles', () => {
    const state = newGame()
    state.definitions.events = [
      eventDef({
        trigger: { type: 'tickInterval', everyTicks: 1 },
        effect: { type: 'stockpileShock', itemId: 'food', delta: 150 }
      })
    ]
    state.localStockpiles = [{ marketId: 'market_sys_helion', itemId: 'food', quantity: 25 }]

    processEvents(state, 1)
    expect(state.localStockpiles[0]!.quantity).toBe(175)
  })
})

describe('creditBonus effect', () => {
  it('adds the amount to corporation credits', () => {
    const state = newGame()
    state.definitions.events = [
      eventDef({
        trigger: { type: 'tickInterval', everyTicks: 1 },
        effect: { type: 'creditBonus', amount: 2500 }
      })
    ]
    const before = getPlayerCorporation(state).credits

    processEvents(state, 1)
    expect(getPlayerCorporation(state).credits).toBe(before + 2500)
    expect(state.eventsLog[0]!.message).toMatch(/received 2,500 cr/)
  })

  it('negative amount is a fine; credits clamp at 0', () => {
    const state = newGame()
    state.definitions.events = [
      eventDef({
        trigger: { type: 'tickInterval', everyTicks: 1 },
        effect: { type: 'creditBonus', amount: -999_999_999 }
      })
    ]

    processEvents(state, 1)
    expect(getPlayerCorporation(state).credits).toBe(0)
    expect(state.eventsLog[0]!.message).toMatch(/paid/)
  })
})
