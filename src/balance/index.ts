export { createCampaignState, loadVanillaDefs, VANILLA_DIR } from './bootstrap.js'
export { runBalanceSimulation, allHardGatesPassed } from './harness.js'
export type { RunBalanceOptions } from './harness.js'
export { formatConsoleSummary } from './report/console.js'
export { formatJsonReport, formatJsonReportSummary } from './report/json.js'
export type { JsonReportOptions } from './report/json.js'
export { formatMarkdownReport } from './report/markdown.js'
export { formatDailyCsv, formatVolatilityCsv } from './report/csv.js'
export { getStrategy, allStrategyIds } from './strategies/index.js'
export type {
  BalanceReport,
  BalanceRunConfig,
  BalanceSummary,
  DailySnapshot,
  StrategyId,
  ThresholdResult
} from './types.js'
