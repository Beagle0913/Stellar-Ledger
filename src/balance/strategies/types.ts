import type { GameState } from '../../shared/types.js'

export interface PlayerStrategy {
  readonly id: string
  onStart?(state: GameState): void
  /** Called at start of each day, before runTick. Expected blocked actions throw GameError. */
  playDay(state: GameState, day: number): void
}
