import { describe, expect, it } from 'vitest'
import { explainEventEligibility } from '../../src/simulation/eventRegistry.js'
import { explainEventBlockedFromResult, explainEventLogSubline } from '../../src/shared/explanations/events.js'
import { newGame } from '../helpers.js'

function completeObjective(state: ReturnType<typeof newGame>, objectiveId: string): void {
  const entry = state.progression.objectives.find((o) => o.objectiveId === objectiveId)
  if (entry) entry.completed = true
}

describe('explainEventEligibility', () => {
  it('blocks before minCampaignTick', () => {
    const state = newGame()
    const event = state.definitions.events.find((e) => e.id === 'evt_metal_buyer_rally')!
    const result = explainEventEligibility(state, event, 5)
    expect(result.eligible).toBe(false)
    expect(result.blockedBy).toBe('event.blocked.min_campaign_tick')
  })

  it('blocks on objective gate', () => {
    const state = newGame()
    const event = state.definitions.events.find((e) => e.id === 'evt_metal_buyer_rally')!
    const result = explainEventEligibility(state, event, 10)
    expect(result.blockedBy).toBe('event.blocked.objective_gate')
  })

  it('blocks on cooldown after firing', () => {
    const state = newGame()
    const event = state.definitions.events.find((e) => e.id === 'evt_food_relief_convoy')!
    completeObjective(state, 'obj_arc_produce')
    state.progression.eventLastFiredTick = { [event.id]: 15 }
    const result = explainEventEligibility(state, event, 16)
    expect(result.blockedBy).toBe('event.blocked.cooldown')
    expect(result.details?.nextEligibleTick).toBe(36)
  })
})

describe('explainEventBlockedFromResult', () => {
  it('builds cooldown explanation', () => {
    const state = newGame()
    const event = state.definitions.events.find((e) => e.id === 'evt_food_relief_convoy')!
    const blocked = explainEventBlockedFromResult(state, event, 16, {
      eligible: false,
      blockedBy: 'event.blocked.cooldown',
      details: { nextEligibleTick: 36, lastFiredTick: 15, cooldownTicks: 21, tick: 16 }
    })
    expect(blocked?.code).toBe('event.blocked.cooldown')
    expect(blocked?.message).toContain('36')
  })
})

describe('explainEventLogSubline', () => {
  it('describes tick interval trigger', () => {
    const state = newGame()
    const ex = explainEventLogSubline(state, 'evt_market_pulse')
    expect(ex.message).toContain('every 5 days')
  })
})
