import { buildExplanation } from './text.js'
import type { Explanation, ProductionExplanationCode } from './types.js'

function productionCodeFromReason(reason: string): ProductionExplanationCode {
  if (/cannot run that recipe/i.test(reason)) return 'production.blocked.wrong_building'
  if (/quantity must be positive/i.test(reason)) return 'production.blocked.invalid_quantity'
  if (/not enough/i.test(reason)) return 'production.blocked.missing_inputs'
  return 'production.blocked.missing_inputs'
}

/** Explain why production cannot start (wraps canStartProduction reason string). */
export function explainProductionBlock(reason: string): Explanation {
  const code = productionCodeFromReason(reason)
  return buildExplanation(code, { rawMessage: reason })
}

/** Explain an idle owned building with no jobs. */
export function explainIdleBuilding(buildingName: string): Explanation {
  return buildExplanation('production.idle.no_job', { buildingName })
}

/** Explain why a queued job has not promoted (read-only — pass canStartProduction reason). */
export function explainQueuedJobBlock(reason: string): Explanation {
  return buildExplanation('production.queued.waiting_for_inputs', { rawMessage: reason })
}
