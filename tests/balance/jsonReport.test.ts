import { describe, expect, it } from 'vitest'
import {
  formatJsonReport,
  formatJsonReportSummary
} from '../../src/balance/report/json.js'
import type { BalanceReport } from '../../src/balance/types.js'

const minimalReport: BalanceReport = {
  meta: { strategyId: 'idle', days: 2, generatedAt: '2020-01-01T00:00:00.000Z' },
  summary: {
    daySecondHauler1: null,
    dayHauler2Affordable: null,
    dayArcComplete: null,
    dayNetWorthObjective: null,
    maxNetWorth: 50_000,
    minNetWorth: 48_000,
    maxDailyNetWorthGain: 500,
    avgPriceVolatility: 1.2,
    stockoutDays: 0,
    punitiveEventCount: 0,
    explanationTotals: { info: 2, warning: 0, critical: 0 },
    explanationActiveDays: 1,
    totalFailedActions: 0,
    totalEventsFired: 0,
    startingCredits: 38_000,
    endingCredits: 38_000,
    endingNetWorth: 50_000
  },
  hardGates: [{ id: 'no_hauler2_day1', tier: 'hard', passed: true, detail: 'ok' }],
  warnings: [],
  snapshots: [
    {
      day: 1,
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

describe('JSON report formatters', () => {
  it('full JSON includes snapshots by default', () => {
    const parsed = JSON.parse(formatJsonReport(minimalReport)) as Record<string, unknown>
    expect(parsed.snapshots).toBeDefined()
    expect(Array.isArray(parsed.snapshots)).toBe(true)
  })

  it('slim JSON omits snapshots', () => {
    const parsed = JSON.parse(formatJsonReportSummary(minimalReport)) as Record<string, unknown>
    expect(parsed.snapshots).toBeUndefined()
    expect(parsed.summary).toBeDefined()
    expect(parsed.hardGates).toBeDefined()
  })

  it('includeSnapshots: false matches summary helper', () => {
    expect(formatJsonReport(minimalReport, { includeSnapshots: false })).toBe(
      formatJsonReportSummary(minimalReport)
    )
  })
})
