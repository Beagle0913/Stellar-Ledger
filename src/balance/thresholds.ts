import {
  CONTRACT_TIER1_MAX_MARKET_MULTIPLIER
} from '../shared/balance.js'
import type { GameState } from '../shared/types.js'
import { getNpcCorporations, getPlayerCorporation } from '../simulation/corporations.js'
import { marketIdForSystem } from '../shared/ids.js'
import { countOpenNpcCorpOrders } from '../simulation/npcMarketAI.js'
import { generateContractOffer } from '../simulation/progression.js'
import { sampleProfilePrices } from './metrics.js'
import type { BalanceReport, ThresholdResult } from './types.js'

const MAX_DAILY_NET_WORTH_GAIN = 25_000
const ARC_HORIZON_DAYS = 60
const SECOND_HAULER1_ARC_MIN = 5
const SECOND_HAULER1_ARC_MAX = 45
const HAULER2_OPTIMAL_MIN = 8
const HAULER2_OPTIMAL_MAX = 50
const IDLE_WEALTH_CREDIT_BUFFER = 500
const IDLE_NET_WORTH_CAP = 130_000
const NORMAL_GROWTH_MIN = 0.85
const NORMAL_GROWTH_MAX = 1.35
const VOLATILITY_WARNING_MIN = 0.05
const VOLATILITY_WARNING_MAX = 35
const IDLE_BUILDINGS_WARNING = 4
const SHIP_UTIL_WARNING = 0.15
const STOCKOUT_CONSECUTIVE_WARNING = 14

const PUNITIVE_BEFORE_REVENUE = new Set([
  'evt_logistics_fuel_pressure',
  'evt_machinery_squeeze',
  'evt_food_security_warning'
])

function gate(id: string, passed: boolean, detail: string): ThresholdResult {
  return { id, tier: 'hard', passed, detail }
}

function warn(id: string, passed: boolean, detail: string): ThresholdResult {
  return { id, tier: 'warning', passed, detail }
}

function snapshotAtDay(report: BalanceReport, day: number) {
  return report.snapshots.find((s) => s.day === day)
}

function revenueCompleteDay(report: BalanceReport): number | null {
  for (const snap of report.snapshots) {
    if (snap.objectivesCompleted.includes('obj_arc_revenue')) return snap.day
  }
  return null
}

function maxConsecutiveStockoutDays(report: BalanceReport): number {
  let max = 0
  let cur = 0
  for (const snap of report.snapshots) {
    if (snap.stockoutItems.length > 0) {
      cur += 1
      max = Math.max(max, cur)
    } else {
      cur = 0
    }
  }
  return max
}

function collectEventCooldownViolations(report: BalanceReport, state: GameState): string[] {
  const violations: string[] = []
  const lastFire = new Map<string, number>()
  for (const snap of report.snapshots) {
    for (const eventId of snap.eventIds) {
      const def = state.definitions.events.find((e) => e.id === eventId)
      const cooldown = def?.cooldownTicks ?? 0
      const prev = lastFire.get(eventId)
      if (prev != null && cooldown > 0 && snap.day - prev < cooldown) {
        violations.push(`${eventId}:${prev}->${snap.day}`)
      }
      lastFire.set(eventId, snap.day)
    }
  }
  return violations
}

export function evaluateHardGates(report: BalanceReport, state?: GameState): ThresholdResult[] {
  const { summary, meta, snapshots } = report
  const gates: ThresholdResult[] = []

  gates.push(
    gate(
      'no_hauler2_day1',
      summary.dayHauler2Affordable === null || summary.dayHauler2Affordable > 1,
      summary.dayHauler2Affordable === null
        ? 'Hauler II not affordable within horizon'
        : `Hauler II affordable day ${summary.dayHauler2Affordable}`
    )
  )

  if (meta.strategyId === 'arcPlay') {
    gates.push(
      gate(
        'arc_completes',
        summary.dayArcComplete !== null && summary.dayArcComplete <= ARC_HORIZON_DAYS,
        summary.dayArcComplete === null
          ? 'First-hour arc did not complete'
          : `Arc complete day ${summary.dayArcComplete}`
      )
    )

    const revDay = revenueCompleteDay(report)
    let punitiveBeforeRevenue = 0
    if (revDay !== null) {
      for (const snap of snapshots) {
        if (snap.day >= revDay) break
        for (const id of snap.eventIds) {
          if (PUNITIVE_BEFORE_REVENUE.has(id)) punitiveBeforeRevenue += 1
        }
      }
    }
    gates.push(
      gate(
        'no_punitive_events_early',
        punitiveBeforeRevenue === 0,
        punitiveBeforeRevenue === 0
          ? 'No punitive events before revenue objective'
          : `${punitiveBeforeRevenue} punitive events before obj_arc_revenue`
      )
    )
  }

  gates.push(
    gate(
      'no_negative_stockpiles',
      !snapshots.some((s) => s.negativeStockpiles),
      snapshots.some((s) => s.negativeStockpiles)
        ? 'Negative regional stockpile detected'
        : 'All stockpiles non-negative'
    )
  )

  if (state) {
    const cooldownViolations = collectEventCooldownViolations(report, state)
    gates.push(
      gate(
        'event_cooldown_respected',
        cooldownViolations.length === 0,
        cooldownViolations.length === 0
          ? 'Event cooldowns respected'
          : cooldownViolations.join(', ')
      )
    )

    gates.push(
      gate(
        'no_event_every_tick',
        cooldownViolations.length === 0,
        cooldownViolations.length === 0 ? 'No cooldown spam' : cooldownViolations.join(', ')
      )
    )
  }

  if (meta.strategyId === 'smeltAndSellOptimal') {
    gates.push(
      gate(
        'hauler2_window_optimal',
        summary.dayHauler2Affordable !== null &&
          summary.dayHauler2Affordable >= HAULER2_OPTIMAL_MIN &&
          summary.dayHauler2Affordable <= HAULER2_OPTIMAL_MAX,
        `Hauler II day ${summary.dayHauler2Affordable ?? 'never'}`
      )
    )
  }

  if (meta.strategyId === 'idle') {
    const day30 = snapshotAtDay(report, 30)
    gates.push(
      gate(
        'idle_no_free_wealth',
        day30 !== undefined &&
          day30.credits <= day30.startingCredits + IDLE_WEALTH_CREDIT_BUFFER &&
          day30.netWorth < IDLE_NET_WORTH_CAP,
        day30
          ? `Day 30 credits ${day30.credits}, net worth ${day30.netWorth}`
          : 'No day-30 snapshot'
      )
    )
  }

  if (meta.strategyId === 'smeltAndSell') {
    const day30 = snapshotAtDay(report, 30)
    const start = day30?.startingCredits ?? summary.startingCredits
    gates.push(
      gate(
        'normal_modest_growth',
        day30 !== undefined &&
          day30.credits >= start * NORMAL_GROWTH_MIN &&
          day30.credits <= start * NORMAL_GROWTH_MAX,
        day30 ? `Day 30 credits ${day30.credits} (start ${start})` : 'No day-30 snapshot'
      )
    )
  }

  if (meta.strategyId !== 'idle' && state) {
    gates.push(
      gate(
        'no_infinite_arbitrage',
        summary.maxDailyNetWorthGain < MAX_DAILY_NET_WORTH_GAIN,
        `Peak daily net worth gain ${summary.maxDailyNetWorthGain}`
      )
    )

    const prices = sampleProfilePrices(state)
    const outOfBounds = prices.filter((p) => p.price < p.minPrice || p.price > p.maxPrice)
    gates.push(
      gate(
        'prices_in_profile_bounds',
        outOfBounds.length === 0,
        outOfBounds.length === 0
          ? 'All profiled prices in bounds'
          : `${outOfBounds.length} out-of-bound prices`
      )
    )
  }

  if (state && meta.strategyId === 'contracts') {
    let violations = 0
    for (const template of state.definitions.contractTemplates) {
      if (template.type !== 'sell_in_faction') continue
      const offer = generateContractOffer(state, template)
      if (offer.tier !== 1 || !offer.params.itemId || !offer.params.quantity) continue
      const baseValue =
        state.definitions.items.find((i) => i.id === offer.params.itemId)?.baseValue ?? 0
      const naive = baseValue * offer.params.quantity
      if (naive > 0 && offer.creditReward > naive * CONTRACT_TIER1_MAX_MARKET_MULTIPLIER) {
        violations += 1
      }
    }
    gates.push(
      gate(
        'contract_tier1_not_op',
        violations === 0,
        violations === 0 ? 'Tier-1 sell contracts within cap' : `${violations} over cap`
      )
    )
  }

  if (state && report.meta.days >= 30) {
    const day30 = snapshotAtDay(report, 30)
    const homeMarket = marketIdForSystem(getPlayerCorporation(state).homeSystemId)
    const homeOpenOrders = state.orders.filter(
      (o) => o.marketId === homeMarket && o.remainingQuantity > 0
    ).length
    gates.push(
      gate(
        'market_not_empty_day_30',
        day30 !== undefined &&
          (day30.marketChangesCount > 0 || homeOpenOrders >= state.definitions.items.length),
        day30
          ? `Day 30 market changes ${day30.marketChangesCount}, open orders ${homeOpenOrders}`
          : 'No day-30 snapshot'
      )
    )

    const npcCorps = getNpcCorporations(state)
    const maxCorpOrders =
      npcCorps.length * state.markets.length * state.definitions.items.length * 2
    const openCorpOrders = countOpenNpcCorpOrders(state)
    gates.push(
      gate(
        'npc_orders_bounded',
        openCorpOrders <= maxCorpOrders,
        `${openCorpOrders} open corp orders (max ${maxCorpOrders})`
      )
    )

    const npcIds = new Set(npcCorps.map((c) => c.id))
    const badInv = state.inventories.some(
      (r) => npcIds.has(r.ownerId) && (r.quantity < 0 || r.reserved > r.quantity)
    )
    gates.push(
      gate(
        'no_npc_inventory_negative',
        !badInv,
        badInv ? 'NPC inventory/reservation invalid' : 'NPC inventories valid'
      )
    )
  }

  if (state && report.meta.days >= 100) {
    const day100 = snapshotAtDay(report, 100)
    const maxVol = day100
      ? Math.max(0, ...Object.values(day100.priceVolatility))
      : 0
    gates.push(
      gate(
        'no_price_explosion_day_100',
        maxVol <= 50,
        day100 ? `Day 100 max home volatility ${maxVol.toFixed(1)}%` : 'No day-100 snapshot'
      )
    )
  }

  return gates
}

export function evaluateWarnings(report: BalanceReport): ThresholdResult[] {
  const { summary, meta, snapshots } = report
  const warnings: ThresholdResult[] = []

  warnings.push(
    warn(
      'avgPriceVolatility',
      summary.avgPriceVolatility >= VOLATILITY_WARNING_MIN &&
        summary.avgPriceVolatility <= VOLATILITY_WARNING_MAX,
      `Average daily volatility ${summary.avgPriceVolatility.toFixed(2)}%`
    )
  )

  const highIdleDays = snapshots.filter((s) => s.idleBuildings >= IDLE_BUILDINGS_WARNING).length
  warnings.push(
    warn(
      'idleBuildings',
      highIdleDays <= snapshots.length * 0.6,
      `${highIdleDays} days with ≥${IDLE_BUILDINGS_WARNING} idle buildings`
    )
  )

  const avgUtil =
    snapshots.length > 0
      ? snapshots.reduce((n, s) => n + s.shipUtilization, 0) / snapshots.length
      : 0
  warnings.push(
    warn(
      'shipUtilization',
      avgUtil >= SHIP_UTIL_WARNING || meta.strategyId === 'idle',
      `Average ship utilization ${avgUtil.toFixed(2)}`
    )
  )

  const totalExplanations =
    summary.explanationTotals.info +
    summary.explanationTotals.warning +
    summary.explanationTotals.critical
  warnings.push(
    warn(
      'explanationTotals',
      totalExplanations > 0,
      `${totalExplanations} digest lines (info ${summary.explanationTotals.info}, warning ${summary.explanationTotals.warning}, critical ${summary.explanationTotals.critical})`
    )
  )

  warnings.push(
    warn(
      'stockoutDays',
      summary.stockoutDays <= Math.max(5, snapshots.length * 0.25),
      `${summary.stockoutDays} stockout days`
    )
  )

  if (meta.strategyId === 'arcPlay' && summary.daySecondHauler1 !== null) {
    warnings.push(
      warn(
        'second_hauler1_window_arc',
        summary.daySecondHauler1 >= SECOND_HAULER1_ARC_MIN &&
          summary.daySecondHauler1 <= SECOND_HAULER1_ARC_MAX,
        `Second Hauler I day ${summary.daySecondHauler1}`
      )
    )
  }

  warnings.push(
    warn(
      'no_permanent_critical_shortage',
      maxConsecutiveStockoutDays(report) < STOCKOUT_CONSECUTIVE_WARNING,
      `Max consecutive stockout days ${maxConsecutiveStockoutDays(report)}`
    )
  )

  const activeDays = snapshots.filter(
    (s) => s.marketChangesCount > 0 || s.eventsFired > 0
  ).length
  const explainedActiveDays = snapshots.filter(
    (s) => (s.marketChangesCount > 0 || s.eventsFired > 0) && s.explanationCount > 0
  ).length
  warnings.push(
    warn(
      'explanations_present_on_activity',
      activeDays === 0 || explainedActiveDays / activeDays >= 0.5,
      `${explainedActiveDays}/${activeDays} active days had digest lines`
    )
  )

  return warnings
}
