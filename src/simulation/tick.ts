import { GameError } from '../shared/errors.js'
import { appendActivityLog, trimEventsLog } from '../shared/gameLog.js'
import { collectMarketChangesForTick } from '../shared/economyDiagnostics.js'
import { buildTickDigest } from '../shared/explanations/digest.js'
import type { GameState, ProductionJob, TickResult, TransportJob } from '../shared/types.js'
import { processEvents } from './events.js'
import { processNpcLogisticsAI } from './npcLogisticsAI.js'
import { processNpcMarketAI } from './npcMarketAI.js'
import { processNpcProductionAI } from './npcProductionAI.js'
import { processTransportJobs } from './logistics.js'
import { applyTradesToLocalStockpiles, processLocalEconomy } from './localEconomy.js'
import { matchMarket, recordPriceHistory, replenishNpcLiquidity } from './market.js'
import { syncNpcLiquidityToStockpiles } from './npcLiquidity.js'
import { processNpcRegionalTrade } from './npcRegionalTrade.js'
import { processPopulationDynamics } from './populationDynamics.js'
import { applyTradesToProgression, processContractsEndOfTick, refreshObjectiveProgress } from './progression.js'
import { processProductionJobs } from './production.js'
import { buildTickLog } from './tickLog.js'
// The deterministic daily tick. One call == one in-game day. The renderer's
// "Run 1 Day Tick" button maps to exactly one runTick().

export type { TickResult }

/** Price-history retention: rows older than this many ticks are pruned each tick. */
export const PRICE_HISTORY_RETENTION_TICKS = 365

/**
 * Advance the simulation by one day. Steps (in order, matching ECONOMY.md):
 *   1) process production jobs
 *   2) process transport jobs
 *   3) NPC production AI queues new jobs
 *   4) NPC market AI refreshes corp buy/sell orders
 *   5) NPC logistics AI dispatches corp convoys
 *   6) process local economy (daily flows + demand/supply price pressure)
 *   7) process population dynamics (food security → growth/decline)
 *   8) NPC regional trade (convoys between stockpiles / arbitrage)
 *   9) sync NPC order depth to regional stockpiles
 *  10) match market orders
 *  11) apply player trades to regional stockpiles
 *  12) replenish NPC order depth
 *  13) record trade price history (overrides economy rows for traded items)
 *  14) trigger events
 * Afterwards price history older than PRICE_HISTORY_RETENTION_TICKS is pruned
 * (latest rows are never dropped, so the reference-price index stays correct).
 * Persistence is handled by the caller / save manager, not by the tick itself.
 *
 * A `ticking` guard on the campaign meta protects against accidental re-entry
 * (e.g. a double-clicked button). The tick number increments atomically.
 */
export function runTick(state: GameState): TickResult {
  if (state.meta.ticking) {
    throw new GameError('CONFLICT', 'A tick is already in progress.')
  }
  state.meta.ticking = true
  try {
    const nextTick = state.meta.tick + 1

    const productionSnapshot = snapshotJobStatuses(state.productionJobs)
    processProductionJobs(state)
    const completedProductionJobs = countNewlyCompleted(
      productionSnapshot,
      state.productionJobs
    )
    const completedProduction = findNewlyCompletedJobs(
      productionSnapshot,
      state.productionJobs
    ) as ProductionJob[]

    const transportSnapshot = snapshotJobStatuses(state.transportJobs)
    processTransportJobs(state)
    const completedTransportJobs = countNewlyCompleted(
      transportSnapshot,
      state.transportJobs
    )
    const completedTransport = findNewlyCompletedJobs(
      transportSnapshot,
      state.transportJobs
    ) as TransportJob[]

    processNpcProductionAI(state)
    processNpcMarketAI(state)
    processNpcLogisticsAI(state)

    processLocalEconomy(state, nextTick)
    const populationChanges = processPopulationDynamics(state)
    const regionalTradeList = processNpcRegionalTrade(state)
    syncNpcLiquidityToStockpiles(state)

    const eventsBefore = state.eventsLog.length
    const trades = matchMarket(state)
    applyTradesToLocalStockpiles(state, trades)
    applyTradesToProgression(state, trades)
    replenishNpcLiquidity(state)
    recordPriceHistory(state, trades, nextTick)

    processEvents(state, nextTick)
    const newEvents = state.eventsLog.slice(eventsBefore)
    const newEventsCount = newEvents.length
    // Bound the persisted event log so long campaigns don't grow it without end.
    trimEventsLog(state)

    // Cap price history: drop rows older than the retention window. The most
    // recent row per (market, item) is by definition inside the window, so the
    // latest-price index built by economyMath stays valid.
    const cutoff = nextTick - PRICE_HISTORY_RETENTION_TICKS
    if (cutoff > 0) {
      let dropThrough = 0
      while (
        dropThrough < state.priceHistory.length &&
        state.priceHistory[dropThrough]!.tick <= cutoff
      ) {
        dropThrough += 1
      }
      if (dropThrough > 0) {
        state.priceHistory.splice(0, dropThrough)
      }
    }

    state.meta.tick = nextTick

    processContractsEndOfTick(state)
    refreshObjectiveProgress(state)

    const marketChanges = collectMarketChangesForTick(state, nextTick)
    const explanations = buildTickDigest(state, { marketChanges, newEvents })
    const log = buildTickLog(state, nextTick, {
      trades,
      regionalTrades: regionalTradeList,
      completedProduction,
      completedTransport,
      populationChanges,
      newEvents,
      marketChanges
    })
    appendActivityLog(state, log)

    return {
      tick: nextTick,
      trades: trades.length,
      completedProductionJobs,
      completedTransportJobs,
      newEvents: newEventsCount,
      regionalTrades: regionalTradeList.length,
      regionalTradeList,
      log,
      marketChanges,
      explanations
    }
  } finally {
    // Always clear the guard, even if a step throws.
    state.meta.ticking = false
  }
}

/** Smallest/largest batch size accepted by runTicks (one day to one year). */
export const MIN_BATCH_TICKS = 1
export const MAX_BATCH_TICKS = 365

/**
 * Advance the simulation by `n` consecutive days. Exactly equivalent to calling
 * runTick() n times; the returned TickResult aggregates the batch (summed
 * trades/jobs/events, final tick number).
 */
export function runTicks(state: GameState, n: number): TickResult {
  if (!Number.isInteger(n) || n < MIN_BATCH_TICKS || n > MAX_BATCH_TICKS) {
    throw new GameError(
      'VALIDATION',
      `Tick count must be an integer between ${MIN_BATCH_TICKS} and ${MAX_BATCH_TICKS}.`
    )
  }
  const total: TickResult = {
    tick: state.meta.tick,
    trades: 0,
    completedProductionJobs: 0,
    completedTransportJobs: 0,
    newEvents: 0,
    regionalTrades: 0,
    log: [],
    marketChanges: []
  }
  for (let i = 0; i < n; i += 1) {
    const result = runTick(state)
    total.tick = result.tick
    total.trades += result.trades
    total.completedProductionJobs += result.completedProductionJobs
    total.completedTransportJobs += result.completedTransportJobs
    total.newEvents += result.newEvents
    total.regionalTrades += result.regionalTrades
    total.regionalTradeList = result.regionalTradeList
    total.log = result.log
    total.marketChanges = result.marketChanges
    total.explanations = result.explanations
  }
  return total
}

function snapshotJobStatuses(jobs: Array<{ id: string; status: string }>): Map<string, string> {
  return new Map(jobs.map((j) => [j.id, j.status]))
}

function countNewlyCompleted(
  before: Map<string, string>,
  jobs: Array<{ id: string; status: string }>
): number {
  let n = 0
  for (const job of jobs) {
    if (before.get(job.id) !== 'completed' && job.status === 'completed') n += 1
  }
  return n
}

function findNewlyCompletedJobs(
  before: Map<string, string>,
  jobs: Array<{ id: string; status: string }>
): Array<{ id: string; status: string }> {
  return jobs.filter((j) => before.get(j.id) !== 'completed' && j.status === 'completed')
}
