import type { EventLogEntry, GameState, MarketChangeEntry } from '../types.js'
import { explainEventLogSubline } from './events.js'
import { explainMarketChange } from './market.js'
import type { Explanation } from './types.js'
import { TICK_DIGEST_MAX } from './types.js'

export interface TickDigestInput {
  marketChanges: MarketChangeEntry[]
  newEvents: EventLogEntry[]
}

/** Compose a capped daily "why today" digest from tick outputs. */
export function buildTickDigest(state: GameState, input: TickDigestInput): Explanation[] {
  const out: Explanation[] = []

  for (const change of input.marketChanges) {
    if (out.length >= TICK_DIGEST_MAX) break
    out.push(explainMarketChange(change))
  }

  for (const evt of input.newEvents) {
    if (out.length >= TICK_DIGEST_MAX) break
    out.push(explainEventLogSubline(state, evt.eventId))
  }

  return out.slice(0, TICK_DIGEST_MAX)
}
