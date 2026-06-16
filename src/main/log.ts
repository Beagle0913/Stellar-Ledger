import type { GameLogCategory, GameLogEntry } from '../shared/types.js'
import { formatLogLine, LOG_CATEGORY_LABELS } from '../shared/gameLog.js'

// Main-process console logging. Simulation detail is GE_DEBUG-gated; errors are always on.
//
//   GE_DEBUG=1         — tick summaries, player actions, economy/trade lines
//   GE_DEBUG_VERBOSE=1 — include quiet-day / tick header lines (noisy)
//   GE_DEBUG_PATHS=1   — path seeding (main.ts, unchanged)

const DEBUG = process.env['GE_DEBUG'] === '1'
const VERBOSE = process.env['GE_DEBUG_VERBOSE'] === '1'

function categoryEnabled(category: GameLogCategory): boolean {
  if (category === 'tick' && !VERBOSE) return false
  return true
}

/** Log a debug message when GE_DEBUG=1. */
export function debugLog(message: string, ...detail: unknown[]): void {
  if (DEBUG) console.log(`[debug] ${message}`, ...detail)
}

/** Log campaign lifecycle (create/load/save) when GE_DEBUG=1. */
export function logSystem(message: string, ...detail: unknown[]): void {
  if (DEBUG) console.log(`[system] ${message}`, ...detail)
}

/** Log a player or IPC-initiated action when GE_DEBUG=1. */
export function logAction(entry: GameLogEntry): void {
  if (!DEBUG) return
  console.log(`[action] ${formatLogLine(entry)}`)
}

/** Log simulation entries produced by a tick. */
export function logTickEntries(entries: GameLogEntry[]): void {
  if (!DEBUG || entries.length === 0) return
  for (const entry of entries) {
    if (!categoryEnabled(entry.category)) continue
    const label = LOG_CATEGORY_LABELS[entry.category] ?? entry.category
    console.log(`[${label.toLowerCase()}] ${entry.message}`)
  }
}

/** Log unexpected errors — always active. */
export function logError(context: string, err: unknown): void {
  const detail = err instanceof Error ? err.stack ?? err.message : String(err)
  console.error(`[error] ${context}: ${detail}`)
}

/** Log expected domain failures at debug level only. */
export function logExpectedFailure(context: string, message: string): void {
  if (DEBUG) console.log(`[expected] ${context}: ${message}`)
}
