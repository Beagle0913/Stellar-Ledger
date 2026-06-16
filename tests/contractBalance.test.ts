import { describe, expect, it } from 'vitest'
import { CONTRACT_TIER1_MAX_MARKET_MULTIPLIER, CONTRACT_TIER2_MIN_DAY } from '../src/shared/balance.js'
import {
  eligibleContractTemplates,
  ensureContractBoard,
  generateContractOffer
} from '../src/simulation/progression.js'
import { newGame } from './helpers.js'

// Expose pickTier logic via generateContractOffer tier outcomes at different ticks.

describe('contract economy balance', () => {
  it('tier-1 sell contracts stay within market-value multiplier guard', () => {
    const state = newGame()
    state.meta.tick = 0
    for (const template of state.definitions.contractTemplates) {
      if (template.type !== 'sell_in_faction') continue
      const offer = generateContractOffer(state, template)
      if (offer.tier !== 1) continue
      if (!offer.params.itemId || !offer.params.quantity) continue
      const baseValue =
        state.definitions.items.find((i) => i.id === offer.params.itemId)?.baseValue ?? 0
      const naiveMarket = baseValue * offer.params.quantity
      if (naiveMarket <= 0) continue
      expect(offer.creditReward).toBeLessThanOrEqual(
        Math.round(naiveMarket * CONTRACT_TIER1_MAX_MARKET_MULTIPLIER)
      )
    }
  })

  it('tier-2 contracts are not offered before CONTRACT_TIER2_MIN_DAY', () => {
    const state = newGame()
    state.meta.tick = 5
    state.progression.factionReputation.faction_consortium = 20
    const deliver = state.definitions.contractTemplates.find((t) => t.id === 'tpl_deliver')!
    const offer = generateContractOffer(state, deliver)
    expect(offer.tier).toBe(1)
  })

  it('tier-2 unlocks after enough days and reputation', () => {
    const state = newGame()
    state.meta.tick = CONTRACT_TIER2_MIN_DAY
    state.progression.factionReputation.faction_consortium = 20
    const deliver = state.definitions.contractTemplates.find((t) => t.id === 'tpl_deliver')!
    const offer = generateContractOffer(state, deliver)
    expect(offer.tier).toBe(2)
  })

  it('gates contract templates by minCampaignTick at the board level', () => {
    const state = newGame()
    state.meta.tick = 0
    const eligible = eligibleContractTemplates(state).map((t) => t.id)
    // Only tick-0 templates are offered on day one.
    expect(eligible).toContain('tpl_sell_faction')
    expect(eligible).toContain('tpl_produce')
    expect(eligible).not.toContain('tpl_own_asset')
    expect(eligible).not.toContain('tpl_net_worth')

    ensureContractBoard(state)
    const boardTemplates = new Set(state.progression.activeContracts.map((c) => c.templateId))
    expect(boardTemplates.has('tpl_own_asset')).toBe(false)
    expect(boardTemplates.has('tpl_net_worth')).toBe(false)

    // Later in the campaign the gated templates become eligible.
    state.meta.tick = 30
    expect(eligibleContractTemplates(state).map((t) => t.id)).toContain('tpl_own_asset')
  })

  it('does not loop forever when no templates are eligible', () => {
    const state = newGame()
    state.meta.tick = 0
    state.progression.activeContracts = []
    // Push every template far into the future so none are eligible.
    state.definitions.contractTemplates = state.definitions.contractTemplates.map((t) => ({
      ...t,
      minCampaignTick: 9_999
    }))
    ensureContractBoard(state)
    expect(state.progression.activeContracts).toHaveLength(0)
  })
})
