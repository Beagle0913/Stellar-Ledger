import type { Explanation } from '../shared/explanations/types'
import { TICK_DIGEST_MAX } from '../shared/explanations/types'

/**
 * Explanation codes already rendered in dedicated Dashboard sections
 * (Market changes, Event log). Omit from the "Why today" digest.
 */
export function isDashboardSectionExplanation(code: string): boolean {
  return code.startsWith('market.') || code.startsWith('event.')
}

/** Filter tick digest for the Dashboard "Why today" panel (renderer-only). */
export function filterDashboardDigestForTickReport(explanations: Explanation[]): Explanation[] {
  return explanations
    .filter((ex) => !isDashboardSectionExplanation(ex.code))
    .slice(0, TICK_DIGEST_MAX)
}
