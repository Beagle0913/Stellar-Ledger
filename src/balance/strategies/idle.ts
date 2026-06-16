import type { PlayerStrategy } from './types.js'

/** Advance time without player actions. */
export const idleStrategy: PlayerStrategy = {
  id: 'idle',
  playDay() {
    // runTick is handled by the harness
  }
}
