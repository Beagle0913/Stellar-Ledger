import { explainEventLogSubline } from '../../shared/explanations/index.js'
import type { EventLogView, GameState } from '../../shared/types.js'

export function buildEventLogViews(state: GameState): EventLogView[] {
  return state.eventsLog.map((entry) => ({
    ...entry,
    explanation: explainEventLogSubline(state, entry.eventId)
  }))
}
