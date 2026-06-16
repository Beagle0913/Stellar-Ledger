import { describe, expect, it } from 'vitest'
import {
  buildObjectiveViews,
  completeContract,
  initCampaignProgression,
  notePlayerSellProceeds,
  noteProductionOutput
} from '../src/simulation/progression.js'
import { getPlayerCorporation, newGame } from './helpers.js'

describe('objectives and contracts', () => {
  it('tracks metal production objectives and unlocks the next step', () => {
    const state = newGame()
    state.progression = initCampaignProgression(state)
    noteProductionOutput(state, 'metal', 4)
    let views = buildObjectiveViews(state)
    expect(views.find((o) => o.id === 'obj_arc_first_metal')?.completed).toBe(true)
    // The next produce step is now unlocked but not yet complete.
    const produce = views.find((o) => o.id === 'obj_arc_produce')
    expect(produce?.completed).toBe(false)
    expect(produce?.isUnlocked).toBe(true)

    noteProductionOutput(state, 'metal', 12)
    views = buildObjectiveViews(state)
    expect(views.find((o) => o.id === 'obj_arc_produce')?.completed).toBe(true)
  })

  it('does not progress a locked objective; it snaps complete on unlock', () => {
    const state = newGame()
    state.progression = initCampaignProgression(state)

    // Revenue is locked behind the production chain: proceeds accumulate but the
    // objective must not progress or complete while locked.
    notePlayerSellProceeds(state, 5_000)
    let views = buildObjectiveViews(state)
    const revenueLocked = views.find((o) => o.id === 'obj_arc_revenue')
    expect(revenueLocked?.isUnlocked).toBe(false)
    expect(revenueLocked?.completed).toBe(false)
    expect(revenueLocked?.current).toBe(0)

    // Completing the production chain unlocks revenue, which then snaps to the
    // cumulative proceeds already earned.
    noteProductionOutput(state, 'metal', 16)
    views = buildObjectiveViews(state)
    expect(views.find((o) => o.id === 'obj_arc_revenue')?.completed).toBe(true)
  })

  it('tracks the optional complete_contracts objective once unlocked', () => {
    const state = newGame()
    state.progression = initCampaignProgression(state)

    state.progression.completedContractIds.push('contract_done')
    // Still locked behind obj_arc_produce, so it must not complete yet.
    let views = buildObjectiveViews(state)
    const contractObj = views.find((o) => o.id === 'obj_arc_contract')
    expect(contractObj?.optional).toBe(true)
    expect(contractObj?.completed).toBe(false)

    noteProductionOutput(state, 'metal', 16)
    views = buildObjectiveViews(state)
    expect(views.find((o) => o.id === 'obj_arc_contract')?.completed).toBe(true)
  })

  it('accept and complete a net-worth contract grants credits and reputation', () => {
    const state = newGame()
    state.progression = initCampaignProgression(state)
    state.progression.activeContracts = [
      {
        id: 'contract_test',
        templateId: 'tpl_net_worth',
        type: 'reach_net_worth',
        title: 'Reach net worth',
        description: 'Test',
        factionId: 'faction_consortium',
        tier: 1,
        creditReward: 500,
        reputationReward: 2,
        expiresAtTick: state.meta.tick + 30,
        accepted: true,
        progress: 0,
        target: 1000,
        params: { netWorthTarget: 1000, target: 1000 }
      }
    ]
    getPlayerCorporation(state).credits = 5000

    const creditsBefore = getPlayerCorporation(state).credits
    const repBefore = state.progression.factionReputation.faction_consortium ?? 0

    completeContract(state, 'contract_test')
    expect(getPlayerCorporation(state).credits).toBe(creditsBefore + 500)
    expect(state.progression.factionReputation.faction_consortium).toBe(repBefore + 2)
  })

  it('applies reputation bonus to contract credit payout', () => {
    const state = newGame()
    state.progression = initCampaignProgression(state)
    state.progression.factionReputation.faction_consortium = 10
    state.progression.activeContracts = [
      {
        id: 'contract_bonus',
        templateId: 'tpl_net_worth',
        type: 'reach_net_worth',
        title: 'Reach net worth',
        description: 'Test',
        factionId: 'faction_consortium',
        tier: 1,
        creditReward: 1000,
        reputationReward: 1,
        expiresAtTick: state.meta.tick + 30,
        accepted: true,
        progress: 0,
        target: 1000,
        params: { netWorthTarget: 1000, target: 1000 }
      }
    ]
    getPlayerCorporation(state).credits = 5000
    const before = getPlayerCorporation(state).credits
    completeContract(state, 'contract_bonus')
    expect(getPlayerCorporation(state).credits).toBe(before + 1050)
  })
})
