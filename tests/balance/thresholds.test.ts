import { describe, expect, it } from 'vitest'
import { evaluateHardGates, evaluateWarnings } from '../../src/balance/thresholds.js'
import type { BalanceReport } from '../../src/balance/types.js'
import { runBalanceSimulation } from '../../src/balance/harness.js'

function minimalReport(overrides: Partial<BalanceReport['summary']> = {}): BalanceReport {
  return {
    meta: { strategyId: 'idle', days: 30, generatedAt: '2020-01-01' },
    summary: {
      daySecondHauler1: null,
      dayHauler2Affordable: null,
      dayArcComplete: null,
      dayNetWorthObjective: null,
      maxNetWorth: 50_000,
      minNetWorth: 40_000,
      maxDailyNetWorthGain: 1000,
      avgPriceVolatility: 2,
      stockoutDays: 0,
      punitiveEventCount: 0,
      explanationTotals: { info: 1, warning: 0, critical: 0 },
      explanationActiveDays: 1,
      totalFailedActions: 0,
      totalEventsFired: 0,
      startingCredits: 38_000,
      endingCredits: 38_000,
      endingNetWorth: 50_000,
      ...overrides
    },
    hardGates: [],
    warnings: [],
    snapshots: [
      {
        day: 30,
        credits: 38_000,
        netWorth: 50_000,
        inventoryValue: 12_000,
        objectivesCompleted: [],
        objectivesActive: [],
        contractsCompleted: 0,
        activeContracts: 2,
        shipsOwned: 1,
        productionJobsRunning: 0,
        transportJobsRunning: 0,
        idleBuildings: 5,
        shipUtilization: 0,
        eventsFired: 0,
        eventIds: [],
        marketChangesCount: 0,
        priceVolatility: {},
        stockoutItems: [],
        foodSecurityRatio: 1,
        playerFuel: 80,
        playerFood: 80,
        playerMachinery: 25,
        failedActions: 0,
        explanationCount: 0,
        explanationSeverity: { info: 0, warning: 0, critical: 0 },
        negativeStockpiles: false,
        startingCredits: 38_000
      }
    ]
  }
}

describe('hard gates', () => {
  it('fails no_hauler2_day1 when affordable on day 1', () => {
    const report = minimalReport({ dayHauler2Affordable: 1 })
    const gates = evaluateHardGates(report)
    expect(gates.find((g) => g.id === 'no_hauler2_day1')?.passed).toBe(false)
  })

  it('passes no_hauler2_day1 when not affordable early', () => {
    const report = minimalReport({ dayHauler2Affordable: 20 })
    const gates = evaluateHardGates(report)
    expect(gates.find((g) => g.id === 'no_hauler2_day1')?.passed).toBe(true)
  })

  it('arc_completes gate applies only to arcPlay', () => {
    const fail = minimalReport({ dayArcComplete: null })
    fail.meta.strategyId = 'arcPlay'
    expect(evaluateHardGates(fail).find((g) => g.id === 'arc_completes')?.passed).toBe(false)

    const pass = minimalReport({ dayArcComplete: 18 })
    pass.meta.strategyId = 'arcPlay'
    expect(evaluateHardGates(pass).find((g) => g.id === 'arc_completes')?.passed).toBe(true)
  })
})

describe('diagnostic warnings', () => {
  it('evaluates warnings without failing CI semantics', () => {
    const report = minimalReport({ avgPriceVolatility: 0 })
    const warnings = evaluateWarnings(report)
    expect(warnings.length).toBeGreaterThan(0)
    expect(warnings.some((w) => w.id === 'avgPriceVolatility')).toBe(true)
  })
})

describe('integrated thresholds', () => {
  it('smeltAndSell optimal run hits hauler2 window gate', () => {
    const report = runBalanceSimulation({ strategyId: 'smeltAndSellOptimal', days: 55 })
    const gate = report.hardGates.find((g) => g.id === 'hauler2_window_optimal')
    expect(gate?.passed).toBe(true)
  }, 120_000)

  it('smeltAndSell normal run passes modest growth gate', () => {
    const report = runBalanceSimulation({ strategyId: 'smeltAndSell', days: 30 })
    const gate = report.hardGates.find((g) => g.id === 'normal_modest_growth')
    expect(gate?.passed).toBe(true)
  }, 60_000)
})
