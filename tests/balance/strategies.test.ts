import { describe, expect, it } from 'vitest'
import { allStrategyIds } from '../../src/balance/strategies/index.js'
import { runBalanceSimulation } from '../../src/balance/harness.js'

describe('balance strategies smoke', () => {
  for (const strategyId of allStrategyIds()) {
    it(`${strategyId} runs 15 days without unexpected throw`, () => {
      const report = runBalanceSimulation({ strategyId, days: 15 })
      expect(report.snapshots).toHaveLength(15)
      expect(report.hardGates.find((g) => g.id === 'no_negative_stockpiles')?.passed).toBe(true)
    }, 60_000)
  }
})
