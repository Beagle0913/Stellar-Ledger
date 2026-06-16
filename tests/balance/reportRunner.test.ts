import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { formatConsoleSummary } from '../../src/balance/report/console.js'
import { formatDailyCsv, formatVolatilityCsv } from '../../src/balance/report/csv.js'
import { formatJsonReport } from '../../src/balance/report/json.js'
import { formatMarkdownReport } from '../../src/balance/report/markdown.js'
import { allHardGatesPassed, runBalanceSimulation } from '../../src/balance/harness.js'
import { allStrategyIds } from '../../src/balance/strategies/index.js'

const WRITE_REPORTS = process.env.BALANCE_WRITE_REPORTS === '1'
const REPORT_DIR = join(process.cwd(), 'reports', 'balance')

describe('balance report runner', () => {
  for (const strategyId of allStrategyIds()) {
    it(`generates report for ${strategyId}`, () => {
      const days = strategyId === 'arcPlay' ? 60 : strategyId === 'smeltAndSellOptimal' ? 55 : 30
      const report = runBalanceSimulation({ strategyId, days })
      const summary = formatConsoleSummary(report)
      expect(summary).toContain(strategyId)

      if (WRITE_REPORTS) {
        mkdirSync(REPORT_DIR, { recursive: true })
        const stamp = new Date().toISOString().replace(/[:.]/g, '-')
        const base = join(REPORT_DIR, `${strategyId}-${stamp}`)
        writeFileSync(`${base}.json`, formatJsonReport(report))
        writeFileSync(`${base}.summary.json`, formatJsonReport(report, { includeSnapshots: false }))
        writeFileSync(`${base}.md`, formatMarkdownReport(report))
        writeFileSync(`${base}-daily.csv`, formatDailyCsv(report))
        writeFileSync(`${base}-volatility.csv`, formatVolatilityCsv(report))
      }

      if (strategyId === 'idle' || strategyId === 'arcPlay' || strategyId === 'smeltAndSell') {
        expect(allHardGatesPassed(report.hardGates)).toBe(true)
      }
    }, 120_000)
  }
})
