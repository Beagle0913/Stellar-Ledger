import { newId } from './ids.js'
import type { GameLogCategory, GameLogEntry, GameState } from './types.js'

/** Max persisted activity-log rows per campaign (oldest dropped). */
export const ACTIVITY_LOG_MAX = 500

/** Max persisted event-log rows per campaign (oldest dropped). Keeps long
 * campaigns from growing the events_log without bound. */
export const EVENTS_LOG_MAX = 500

/** Trim the campaign event log in place to the most recent EVENTS_LOG_MAX rows. */
export function trimEventsLog(state: GameState): void {
  if (state.eventsLog.length > EVENTS_LOG_MAX) {
    state.eventsLog = state.eventsLog.slice(-EVENTS_LOG_MAX)
  }
}

export function createLogEntry(
  tick: number,
  category: GameLogCategory,
  message: string
): GameLogEntry {
  return {
    id: newId('log'),
    tick,
    category,
    message,
    at: Date.now()
  }
}

/** Append entries to the campaign activity log, trimming to ACTIVITY_LOG_MAX. */
export function appendActivityLog(state: GameState, entries: GameLogEntry[]): void {
  if (entries.length === 0) return
  state.activityLog.push(...entries)
  if (state.activityLog.length > ACTIVITY_LOG_MAX) {
    state.activityLog = state.activityLog.slice(-ACTIVITY_LOG_MAX)
  }
}

/** Record a player-initiated action at the current tick (in-memory until next save). */
export function recordPlayerAction(
  state: GameState,
  category: GameLogCategory,
  message: string
): GameLogEntry {
  const entry = createLogEntry(state.meta.tick, category, message)
  appendActivityLog(state, [entry])
  return entry
}

/** Short labels for UI tags and console output. */
export const LOG_CATEGORY_LABELS: Record<GameLogCategory, string> = {
  system: 'System',
  tick: 'Tick',
  production: 'Production',
  transport: 'Transport',
  market: 'Market',
  trade: 'Trade',
  economy: 'Economy',
  regional: 'Regional',
  population: 'Population',
  event: 'Event',
  player: 'Player',
  contract: 'Contract',
  mod: 'Mod'
}

export function formatLogLine(entry: GameLogEntry): string {
  const label = LOG_CATEGORY_LABELS[entry.category] ?? entry.category
  return `[Day ${entry.tick}] [${label}] ${entry.message}`
}
