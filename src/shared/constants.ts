// Global, non-content constants. Game CONTENT (items/recipes/etc.) lives in data
// JSON, never here. These are engine-level tunables.

export { STARTING_CREDITS } from './balance.js'

/** Name of the always-present built-in base content mod. */
export const VANILLA_MOD_ID = 'vanilla'

/** Game data/schema version used for mod compatibility checks and save metadata. */
export const GAME_VERSION = '0.2.0'

/** Default player corporation. */
export const DEFAULT_CORP_ID = 'player'
export const DEFAULT_CORP_NAME = 'Player Holdings'

/**
 * Market trade-price rule. We settle matched trades at the MIDPOINT of the
 * crossing buy and sell prices. See ECONOMY.md for the rationale.
 */
export const TRADE_PRICE_RULE = 'midpoint' as const

/** Quantity backing each NPC market order (replenished each tick after matching). */
export const NPC_ORDER_QUANTITY = 1000

/** Channel name used between renderer and main for the single IPC bridge. */
export const IPC_CHANNEL = 'game:invoke'

/** Price-history retention: rows older than this many ticks are pruned each tick. */
export const PRICE_HISTORY_RETENTION_TICKS = 365
