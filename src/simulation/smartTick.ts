import { GameError } from '../shared/errors.js'
import type { GameState, TickResult } from '../shared/types.js'
import { runTick, runTicks } from './tick.js'

/** Hard cap for smart tick advancement (days). */
export const SMART_TICK_MAX_DAYS = 30

export type SmartTickMode = 'production' | 'transport' | 'changes'

/** Days until the earliest running production job completes (0 if none). */
export function daysUntilNextProductionCompletion(state: GameState): number {
  let min = Infinity
  for (const job of state.productionJobs) {
    if (job.status !== 'running') continue
    const remaining = job.duration - job.progress
    if (remaining > 0 && remaining < min) min = remaining
  }
  return min === Infinity ? 0 : min
}

/** Days until the earliest running transport job arrives (0 if none). */
export function daysUntilNextTransportArrival(state: GameState): number {
  let min = Infinity
  for (const job of state.transportJobs) {
    if (job.status !== 'running') continue
    const ship = state.ships.find((s) => s.id === job.shipId)
    const step = ship?.speed ?? 1
    const remaining = job.distance - job.progress
    if (remaining <= 0) continue
    const days = Math.ceil(remaining / step)
    if (days < min) min = days
  }
  return min === Infinity ? 0 : min
}

function tickHasChanges(result: TickResult): boolean {
  return (
    result.trades > 0 ||
    result.completedProductionJobs > 0 ||
    result.completedTransportJobs > 0 ||
    result.newEvents > 0 ||
    result.regionalTrades > 0 ||
    result.marketChanges.length > 0
  )
}

function resolveSmartTickDays(state: GameState, mode: SmartTickMode, maxDays: number): number {
  if (maxDays <= 0) {
    throw new GameError('VALIDATION', 'maxDays must be positive.')
  }
  if (mode === 'production') {
    const days = daysUntilNextProductionCompletion(state)
    if (days <= 0) {
      throw new GameError('CONFLICT', 'No running production jobs to advance to.')
    }
    return Math.min(days, maxDays)
  }
  if (mode === 'transport') {
    const days = daysUntilNextTransportArrival(state)
    if (days <= 0) {
      throw new GameError('CONFLICT', 'No running transport jobs to advance to.')
    }
    return Math.min(days, maxDays)
  }
  // changes: at least one day, capped
  return maxDays
}

/**
 * Advance time intelligently. For `production` / `transport`, runs exactly the
 * days until the next completion (capped). For `changes`, runs day-by-day until
 * something changes or the cap is hit.
 */
export function runTicksSmart(
  state: GameState,
  mode: SmartTickMode,
  maxDays: number = SMART_TICK_MAX_DAYS
): TickResult {
  const cap = Math.min(maxDays, SMART_TICK_MAX_DAYS)
  if (mode === 'changes') {
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
    for (let i = 0; i < cap; i += 1) {
      const result = runTick(state)
      total.tick = result.tick
      total.trades += result.trades
      total.completedProductionJobs += result.completedProductionJobs
      total.completedTransportJobs += result.completedTransportJobs
      total.newEvents += result.newEvents
      total.regionalTrades += result.regionalTrades
      total.log.push(...result.log)
      total.marketChanges = result.marketChanges
      if (tickHasChanges(result)) return total
    }
    return total
  }

  const days = resolveSmartTickDays(state, mode, cap)
  return runTicks(state, days)
}
