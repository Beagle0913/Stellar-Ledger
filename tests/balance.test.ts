import { describe, expect, it } from 'vitest'
import {
  CONTRACT_TIER1_MAX_MARKET_MULTIPLIER,
  REPUTATION_BONUS_CAP,
  STARTING_CREDITS,
  contractCreditBonusMultiplier,
  effectiveContractCreditReward
} from '../src/shared/balance.js'

describe('balance tuning helpers', () => {
  it('contractCreditBonusMultiplier caps at REPUTATION_BONUS_CAP', () => {
    expect(contractCreditBonusMultiplier(0)).toBe(1)
    expect(contractCreditBonusMultiplier(10)).toBeCloseTo(1.05)
    expect(contractCreditBonusMultiplier(100)).toBeCloseTo(1 + REPUTATION_BONUS_CAP)
  })

  it('effectiveContractCreditReward rounds payout with reputation bonus', () => {
    expect(effectiveContractCreditReward(1000, 10)).toBe(1050)
  })

  it('STARTING_CREDITS is below old sandbox default', () => {
    expect(STARTING_CREDITS).toBeLessThan(100_000)
    expect(STARTING_CREDITS).toBeGreaterThan(25_000)
  })

  it('documents tier-1 contract market multiplier guard used in tests', () => {
    expect(CONTRACT_TIER1_MAX_MARKET_MULTIPLIER).toBeGreaterThan(1)
    expect(CONTRACT_TIER1_MAX_MARKET_MULTIPLIER).toBeLessThan(2)
  })
})
