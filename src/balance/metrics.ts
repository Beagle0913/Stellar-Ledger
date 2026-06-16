import { computePriceDelta } from '../shared/economyDiagnostics.js'
import { marketIdForSystem } from '../shared/ids.js'
import type { GameState, TickResult } from '../shared/types.js'
import { estimateInventoryValue, referencePrice } from '../simulation/economyMath.js'
import { aggregateMarketRules, factionPriceBias, getRegionalStockpile } from '../simulation/localEconomy.js'
import { buildObjectiveViews } from '../simulation/progression.js'
import type {
  BalanceReport,
  BalanceRunConfig,
  BalanceSummary,
  DailySnapshot,
  ExplanationSeverityCounts,
  ThresholdResult
} from './types.js'
import { computeMilestones } from './milestones.js'
import { evaluateHardGates, evaluateWarnings } from './thresholds.js'

const PUNITIVE_EVENT_IDS = new Set([
  'evt_logistics_fuel_pressure',
  'evt_machinery_squeeze',
  'evt_food_security_warning'
])

function emptySeverity(): ExplanationSeverityCounts {
  return { info: 0, warning: 0, critical: 0 }
}

function countSeverity(explanations: TickResult['explanations']): ExplanationSeverityCounts {
  const counts = emptySeverity()
  for (const ex of explanations ?? []) {
    counts[ex.severity] += 1
  }
  return counts
}

function playerItemTotal(state: GameState, itemId: string): number {
  let total = 0
  for (const row of state.inventories) {
    if (row.ownerId === state.corporation.id && row.itemId === itemId) {
      total += row.quantity
    }
  }
  return total
}

function collectStockouts(state: GameState, homeMarketId: string): string[] {
  const config = state.definitions.economyConfig
  const threshold = config.regionalTradeMinShortageFraction
  const out: string[] = []
  for (const rule of aggregateMarketRules(state, state.corporation.homeSystemId)) {
    const stock = getRegionalStockpile(state, homeMarketId, rule.itemId, rule.targetStockpile)
    if (stock < rule.targetStockpile * threshold) {
      out.push(rule.itemId)
    }
  }
  return out
}

function collectHomeVolatility(state: GameState, tick: number): Record<string, number> {
  const homeMarket = marketIdForSystem(state.corporation.homeSystemId)
  const out: Record<string, number> = {}
  for (const rule of aggregateMarketRules(state, state.corporation.homeSystemId)) {
    const rows = state.priceHistory.filter(
      (r) => r.marketId === homeMarket && r.itemId === rule.itemId && r.tick <= tick
    )
    if (rows.length < 2) continue
    const sorted = [...rows].sort((a, b) => a.tick - b.tick)
    const latest = sorted[sorted.length - 1]!
    const prev = sorted[sorted.length - 2]!
    const { percentChange } = computePriceDelta(latest.price, prev.price)
    if (percentChange !== null) {
      out[rule.itemId] = Math.abs(percentChange)
    }
  }
  return out
}

function foodSecurityRatio(state: GameState): number {
  const config = state.definitions.economyConfig
  const foodItemId = config.populationFoodItemId
  const homeMarket = marketIdForSystem(state.corporation.homeSystemId)
  let foodTarget = 100
  for (const profile of state.definitions.economicProfiles) {
    const rule = profile.items.find((r) => r.itemId === foodItemId)
    if (rule) {
      foodTarget = rule.targetStockpile
      break
    }
  }
  const stock = getRegionalStockpile(state, homeMarket, foodItemId, foodTarget)
  return foodTarget > 0 ? stock / foodTarget : 1
}

export function collectDailySnapshot(
  state: GameState,
  result: TickResult,
  failedActions: number,
  priorCompletedObjectives: Set<string>,
  startingCredits: number
): { snapshot: DailySnapshot; completedNow: Set<string> } {
  const views = buildObjectiveViews(state)
  const completedNow = new Set(views.filter((o) => o.completed).map((o) => o.id))
  const objectivesCompleted = [...completedNow].filter((id) => !priorCompletedObjectives.has(id))
  const objectivesActive = views.filter((o) => o.status === 'active').map((o) => o.id)

  const playerShips = state.ships.filter((s) => s.ownerId === state.corporation.id)
  const productionJobsRunning = state.productionJobs.filter(
    (j) => j.status === 'running' || j.status === 'queued'
  ).length
  const transportJobsRunning = state.transportJobs.filter((j) => j.status === 'running').length
  const busyBuildingIds = new Set(
    state.productionJobs
      .filter((j) => j.status === 'running' || j.status === 'queued')
      .map((j) => j.buildingId)
  )
  const idleBuildings = state.buildings.filter((b) => !busyBuildingIds.has(b.id)).length

  const inventoryValue = estimateInventoryValue(state, state.corporation.id)
  const netWorth = Math.round(state.corporation.credits + inventoryValue)

  const eventIds = state.eventsLog
    .filter((e) => e.tick === result.tick)
    .map((e) => e.eventId)

  const snapshot: DailySnapshot = {
    day: result.tick,
    credits: state.corporation.credits,
    netWorth,
    inventoryValue,
    objectivesCompleted,
    objectivesActive,
    contractsCompleted: 0,
    activeContracts: state.progression.activeContracts.length,
    shipsOwned: playerShips.length,
    productionJobsRunning,
    transportJobsRunning,
    idleBuildings,
    shipUtilization: transportJobsRunning / Math.max(1, playerShips.length),
    eventsFired: result.newEvents,
    eventIds,
    marketChangesCount: result.marketChanges.length,
    priceVolatility: collectHomeVolatility(state, result.tick),
    stockoutItems: collectStockouts(state, marketIdForSystem(state.corporation.homeSystemId)),
    foodSecurityRatio: foodSecurityRatio(state),
    playerFuel: playerItemTotal(state, state.definitions.economyConfig.fuelItemId),
    playerFood: playerItemTotal(state, configFoodId(state)),
    playerMachinery: playerItemTotal(state, 'machinery'),
    failedActions,
    explanationCount: result.explanations?.length ?? 0,
    explanationSeverity: countSeverity(result.explanations),
    negativeStockpiles: state.localStockpiles.some((s) => s.quantity < 0),
    startingCredits
  }

  return { snapshot, completedNow }
}

function configFoodId(state: GameState): string {
  return state.definitions.economyConfig.populationFoodItemId
}

function buildSummary(snapshots: DailySnapshot[], state: GameState): BalanceSummary {
  const milestones = computeMilestones(snapshots, state)
  let maxDailyNetWorthGain = 0
  for (let i = 1; i < snapshots.length; i += 1) {
    const gain = snapshots[i]!.netWorth - snapshots[i - 1]!.netWorth
    if (gain > maxDailyNetWorthGain) maxDailyNetWorthGain = gain
  }

  let volatilitySum = 0
  let volatilityCount = 0
  for (const snap of snapshots) {
    for (const v of Object.values(snap.priceVolatility)) {
      volatilitySum += v
      volatilityCount += 1
    }
  }

  const explanationTotals = emptySeverity()
  let explanationActiveDays = 0
  for (const snap of snapshots) {
    explanationTotals.info += snap.explanationSeverity.info
    explanationTotals.warning += snap.explanationSeverity.warning
    explanationTotals.critical += snap.explanationSeverity.critical
    if (snap.explanationCount > 0) explanationActiveDays += 1
  }

  let punitiveEventCount = 0
  const arcCompleteDay = milestones.dayArcComplete
  for (const snap of snapshots) {
    if (arcCompleteDay !== null && snap.day > arcCompleteDay) continue
    for (const id of snap.eventIds) {
      if (PUNITIVE_EVENT_IDS.has(id)) punitiveEventCount += 1
    }
  }

  const netWorths = snapshots.map((s) => s.netWorth)
  const last = snapshots[snapshots.length - 1]

  return {
    ...milestones,
    maxNetWorth: netWorths.length ? Math.max(...netWorths) : 0,
    minNetWorth: netWorths.length ? Math.min(...netWorths) : 0,
    maxDailyNetWorthGain,
    avgPriceVolatility: volatilityCount > 0 ? volatilitySum / volatilityCount : 0,
    stockoutDays: snapshots.filter((s) => s.stockoutItems.length > 0).length,
    punitiveEventCount,
    explanationTotals,
    explanationActiveDays,
    totalFailedActions: snapshots.length ? snapshots[snapshots.length - 1]!.failedActions : 0,
    totalEventsFired: snapshots.reduce((n, s) => n + s.eventsFired, 0),
    startingCredits: snapshots[0]?.startingCredits ?? state.corporation.credits,
    endingCredits: last?.credits ?? state.corporation.credits,
    endingNetWorth: last?.netWorth ?? 0
  }
}

export function buildBalanceReport(
  config: BalanceRunConfig,
  snapshots: DailySnapshot[],
  state: GameState
): BalanceReport {
  const summary = buildSummary(snapshots, state)
  const report: BalanceReport = {
    meta: {
      strategyId: config.strategyId,
      days: config.days,
      generatedAt: new Date().toISOString()
    },
    summary,
    hardGates: [],
    warnings: [],
    snapshots
  }
  report.hardGates = evaluateHardGates(report, state)
  report.warnings = evaluateWarnings(report)
  return report
}

export function allHardGatesPassed(hardGates: ThresholdResult[]): boolean {
  return hardGates.every((g) => g.passed)
}

/** Sample profile-bound prices at end of run (for soak-style gates). */
export function sampleProfilePrices(state: GameState): Array<{
  marketId: string
  itemId: string
  price: number
  minPrice: number
  maxPrice: number
}> {
  const out: Array<{
    marketId: string
    itemId: string
    price: number
    minPrice: number
    maxPrice: number
  }> = []
  for (const market of state.markets) {
    for (const rule of aggregateMarketRules(state, market.systemId)) {
      const baseValue = state.definitions.items.find((i) => i.id === rule.itemId)!.baseValue
      const bias = factionPriceBias(state, market.systemId)
      const minPrice = Math.max(1, Math.round(baseValue * rule.minPriceMultiplier * bias))
      const maxPrice = Math.max(minPrice, Math.round(baseValue * rule.maxPriceMultiplier * bias))
      out.push({
        marketId: market.id,
        itemId: rule.itemId,
        price: referencePrice(state, market.id, rule.itemId),
        minPrice,
        maxPrice
      })
    }
  }
  return out
}
