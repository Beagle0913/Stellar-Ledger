import type { TransportJob } from '../types.js'
import { buildExplanation } from './text.js'
import type { Explanation, LogisticsExplanationCode } from './types.js'

const MESSAGE_PATTERNS: Array<{ pattern: RegExp; code: LogisticsExplanationCode }> = [
  { pattern: /exceeds.*capacity/i, code: 'logistics.blocked.no_capacity' },
  { pattern: /not enough fuel/i, code: 'logistics.blocked.insufficient_fuel' },
  { pattern: /not enough/i, code: 'logistics.blocked.insufficient_cargo' },
  { pattern: /origin and destination must differ/i, code: 'logistics.blocked.same_system' }
]

/** Map a thrown logistics validation message to an explanation (known patterns only). */
export function explainTransportBlockFromMessage(message: string): Explanation {
  for (const { pattern, code } of MESSAGE_PATTERNS) {
    if (pattern.test(message)) {
      return buildExplanation(code, { rawMessage: message })
    }
  }
  return buildExplanation('logistics.blocked.insufficient_cargo', { rawMessage: message })
}

/** Explain in-transit ETA from job progress. */
export function explainTransportInTransit(
  job: TransportJob,
  originName: string,
  destName: string
): Explanation {
  const totalDays = job.distance
  const daysRemaining = Math.max(0, totalDays - job.progress)
  return buildExplanation(
    'logistics.in_transit.days_remaining',
    {
      originName,
      destName,
      daysRemaining,
      totalDays,
      rawMessage: `In transit: ${daysRemaining}/${totalDays} days remaining (${originName} → ${destName}).`
    },
    { details: { progress: job.progress, distance: job.distance } }
  )
}
