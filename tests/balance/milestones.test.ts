import { describe, expect, it } from 'vitest'
import { runBalanceSimulation } from '../../src/balance/harness.js'

describe('balance milestones', () => {
  it('smeltAndSellOptimal reaches Hauler II affordability in expected window', () => {
    const report = runBalanceSimulation({ strategyId: 'smeltAndSellOptimal', days: 55 })
    expect(report.summary.dayHauler2Affordable).not.toBeNull()
    expect(report.summary.dayHauler2Affordable!).toBeGreaterThanOrEqual(8)
    expect(report.summary.dayHauler2Affordable!).toBeLessThanOrEqual(50)
    expect(report.summary.dayHauler2Affordable!).toBeGreaterThan(1)
  }, 120_000)
})
