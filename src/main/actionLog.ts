import { recordPlayerAction } from '../shared/gameLog.js'
import type { GameLogCategory, GameState } from '../shared/types.js'
import { logAction } from './log.js'

/** Record a player action in the activity log and mirror to console when GE_DEBUG=1. */
export function logPlayerAction(state: GameState, category: GameLogCategory, message: string): void {
  const entry = recordPlayerAction(state, category, message)
  logAction(entry)
}
