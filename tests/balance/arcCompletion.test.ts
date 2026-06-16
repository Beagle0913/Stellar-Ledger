import { describe, expect, it } from 'vitest'
import { runBalanceSimulation } from '../../src/balance/harness.js'

describe('first-hour arc completion (arcPlay)', () => {
  it('completes obj_arc_fleet within 60 days under vanilla events', () => {
    const report = runBalanceSimulation({ strategyId: 'arcPlay', days: 60 })
    expect(report.summary.dayArcComplete).not.toBeNull()
    expect(report.summary.dayArcComplete!).toBeLessThanOrEqual(60)

    const arcGate = report.hardGates.find((g) => g.id === 'arc_completes')
    expect(arcGate?.passed).toBe(true)

    const punitive = report.hardGates.find((g) => g.id === 'no_punitive_events_early')
    expect(punitive?.passed).toBe(true)
  }, 120_000)
})
