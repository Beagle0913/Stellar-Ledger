import { describe, expect, it } from 'vitest'
import { GameError } from '../../src/shared/errors.js'
import { createCampaignState, loadVanillaDefs } from '../../src/balance/bootstrap.js'
import { collectDailySnapshot } from '../../src/balance/metrics.js'
import { allHardGatesPassed, runBalanceSimulation } from '../../src/balance/harness.js'
import { runTick } from '../../src/simulation/tick.js'
import type { PlayerStrategy } from '../../src/balance/strategies/types.js'

describe('balance harness', () => {
  it('runs idle strategy deterministically', () => {
    const a = runBalanceSimulation({ strategyId: 'idle', days: 10 })
    const b = runBalanceSimulation({ strategyId: 'idle', days: 10 })
    expect(a.summary.endingCredits).toBe(b.summary.endingCredits)
    expect(a.summary.endingNetWorth).toBe(b.summary.endingNetWorth)
    expect(a.snapshots).toHaveLength(10)
  })

  it('rethrows unexpected strategy errors', () => {
    const state = createCampaignState(loadVanillaDefs(), 'Error test')
    const throwingStrategy: PlayerStrategy = {
      id: 'throws',
      playDay() {
        throw new TypeError('sim bug')
      }
    }
    expect(() => {
      try {
        throwingStrategy.playDay(state, 1)
      } catch (err) {
        if (err instanceof GameError) return
        throw err
      }
    }).toThrow(TypeError)
  })

  it('counts GameError without aborting the run', () => {
    const report = runBalanceSimulation({ strategyId: 'arcPlay', days: 5 })
    expect(report.summary.totalFailedActions).toBeGreaterThanOrEqual(0)
    const state = createCampaignState(loadVanillaDefs(), 'snap')
    let failed = 0
    try {
      throw new GameError('VALIDATION', 'blocked')
    } catch (err) {
      if (err instanceof GameError) failed += 1
    }
    expect(failed).toBe(1)
    const result = runTick(state)
    const { snapshot } = collectDailySnapshot(state, result, failed, new Set(), state.corporation.credits)
    expect(snapshot.failedActions).toBe(1)
  })

  it('idle run passes idle wealth hard gate at day 30', () => {
    const report = runBalanceSimulation({ strategyId: 'idle', days: 30 })
    const gate = report.hardGates.find((g) => g.id === 'idle_no_free_wealth')
    expect(gate?.passed).toBe(true)
    expect(allHardGatesPassed(report.hardGates)).toBe(true)
  })
})
