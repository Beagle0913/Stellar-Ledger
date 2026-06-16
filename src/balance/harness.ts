import type { GameDefinitions } from '../shared/types.js'
import { getPlayerCorporation } from '../simulation/corporations.js'
import { GameError } from '../shared/errors.js'
import { runTick } from '../simulation/tick.js'
import { createCampaignState, loadVanillaDefs } from './bootstrap.js'
import { buildBalanceReport, collectDailySnapshot } from './metrics.js'
import { getStrategy } from './strategies/index.js'
import type { BalanceReport, BalanceRunConfig } from './types.js'
import { evaluateHardGates } from './thresholds.js'

export interface RunBalanceOptions extends BalanceRunConfig {
  defs?: GameDefinitions
}

/** Run a headless balance simulation and return a structured report. */
export function runBalanceSimulation(options: RunBalanceOptions): BalanceReport {
  const defs = options.defs ?? loadVanillaDefs()
  const state = createCampaignState(defs, options.campaignName ?? 'Balance Run')
  const strategy = getStrategy(options.strategyId)
  const startingCredits = getPlayerCorporation(state).credits

  strategy.onStart?.(state)

  let failedActions = 0
  const snapshots = []
  let completedObjectives = new Set<string>()

  for (let day = 1; day <= options.days; day += 1) {
    try {
      strategy.playDay(state, day)
    } catch (err) {
      if (err instanceof GameError) {
        failedActions += 1
      } else {
        throw err
      }
    }

    const result = runTick(state)
    const collected = collectDailySnapshot(
      state,
      result,
      failedActions,
      completedObjectives,
      startingCredits
    )
    completedObjectives = collected.completedNow
    snapshots.push(collected.snapshot)
  }

  const report = buildBalanceReport(options, snapshots, state)
  report.hardGates = evaluateHardGates(report, state)
  return report
}

export { allHardGatesPassed } from './metrics.js'
