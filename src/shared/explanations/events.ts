import type { EventDefinition, GameState } from '../types.js'
import { buildExplanation } from './text.js'
import type { EventEligibilityResult, Explanation } from './types.js'

function objectiveTitle(state: GameState, objectiveId: string): string {
  return state.definitions.objectives.find((o) => o.id === objectiveId)?.title ?? objectiveId
}

function triggerSummary(event: EventDefinition): string {
  const t = event.trigger
  switch (t.type) {
    case 'tickInterval':
      return `fires every ${t.everyTicks} days`
    case 'lowStock':
      return `your ${t.itemId} stock drops below ${t.threshold}`
    case 'stockpileShortage':
      return `regional ${t.itemId} stockpile falls below ${t.threshold}`
    default:
      return 'trigger conditions are met'
  }
}

/** Explanation for an event that fired (from log + definition). */
export function explainEventFired(state: GameState, eventId: string, logMessage?: string): Explanation {
  const event = state.definitions.events.find((e) => e.id === eventId)
  const name = event?.name ?? eventId
  const summary = event ? triggerSummary(event) : 'conditions were met'
  const detail = logMessage ? `${summary}. ${logMessage}` : summary
  return buildExplanation(
    'event.fired.trigger_match',
    { eventName: name, rawMessage: detail },
    { relatedEventId: eventId }
  )
}

/** Build explanation from eligibility result (blocked events). */
export function explainEventBlockedFromResult(
  state: GameState,
  event: EventDefinition,
  tick: number,
  result: EventEligibilityResult
): Explanation | null {
  if (result.eligible || !result.blockedBy) return null

  const prereqId = event.requiresCompletedObjectiveId
  return buildExplanation(
    result.blockedBy,
    {
      eventName: event.name,
      minCampaignTick: event.minCampaignTick,
      tick,
      prerequisiteTitle: prereqId ? objectiveTitle(state, prereqId) : undefined,
      nextEligibleTick:
        typeof result.details?.nextEligibleTick === 'number'
          ? result.details.nextEligibleTick
          : undefined
    },
    { relatedEventId: event.id, details: result.details }
  )
}

/** Subline for a fired event log row. */
export function explainEventLogSubline(state: GameState, eventId: string): Explanation {
  const event = state.definitions.events.find((e) => e.id === eventId)
  if (!event) {
    return buildExplanation('event.fired.trigger_match', { rawMessage: 'Event occurred.' }, { relatedEventId: eventId })
  }
  return buildExplanation(
    'event.fired.trigger_match',
    { eventName: event.name, rawMessage: triggerSummary(event) },
    { relatedEventId: eventId }
  )
}
