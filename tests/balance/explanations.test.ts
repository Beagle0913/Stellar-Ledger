import { describe, expect, it } from 'vitest'
import { runBalanceSimulation } from '../../src/balance/harness.js'

describe('balance explanation metrics', () => {
  it('aggregates TickResult explanation severities across a run', () => {
    const report = runBalanceSimulation({ strategyId: 'arcPlay', days: 20 })
    const totalFromSnapshots = report.snapshots.reduce(
      (acc, s) => {
        acc.info += s.explanationSeverity.info
        acc.warning += s.explanationSeverity.warning
        acc.critical += s.explanationSeverity.critical
        return acc
      },
      { info: 0, warning: 0, critical: 0 }
    )
    expect(report.summary.explanationTotals).toEqual(totalFromSnapshots)
    expect(report.summary.explanationActiveDays).toBeGreaterThan(0)
  }, 60_000)
})
