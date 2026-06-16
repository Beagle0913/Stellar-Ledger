
export type StrategyId =
  | 'idle'
  | 'arcPlay'
  | 'smeltAndSell'
  | 'smeltAndSellOptimal'
  | 'logistics'
  | 'contracts'

export interface BalanceRunConfig {
  strategyId: StrategyId
  days: number
  campaignName?: string
  collectExplanationStats?: boolean
}

export interface ExplanationSeverityCounts {
  info: number
  warning: number
  critical: number
}

export interface DailySnapshot {
  day: number
  credits: number
  netWorth: number
  inventoryValue: number
  objectivesCompleted: string[]
  objectivesActive: string[]
  contractsCompleted: number
  activeContracts: number
  shipsOwned: number
  productionJobsRunning: number
  transportJobsRunning: number
  idleBuildings: number
  shipUtilization: number
  eventsFired: number
  eventIds: string[]
  marketChangesCount: number
  priceVolatility: Record<string, number>
  stockoutItems: string[]
  foodSecurityRatio: number
  playerFuel: number
  playerFood: number
  playerMachinery: number
  failedActions: number
  explanationCount: number
  explanationSeverity: ExplanationSeverityCounts
  negativeStockpiles: boolean
  startingCredits: number
}

export interface BalanceSummary {
  daySecondHauler1: number | null
  dayHauler2Affordable: number | null
  dayArcComplete: number | null
  dayNetWorthObjective: number | null
  maxNetWorth: number
  minNetWorth: number
  maxDailyNetWorthGain: number
  avgPriceVolatility: number
  stockoutDays: number
  punitiveEventCount: number
  explanationTotals: ExplanationSeverityCounts
  explanationActiveDays: number
  totalFailedActions: number
  totalEventsFired: number
  startingCredits: number
  endingCredits: number
  endingNetWorth: number
}

export type ThresholdTier = 'hard' | 'warning'

export interface ThresholdResult {
  id: string
  tier: ThresholdTier
  passed: boolean
  detail: string
}

export interface BalanceReportMeta {
  strategyId: StrategyId
  days: number
  generatedAt: string
}

export interface BalanceReport {
  meta: BalanceReportMeta
  summary: BalanceSummary
  hardGates: ThresholdResult[]
  warnings: ThresholdResult[]
  snapshots: DailySnapshot[]
}
