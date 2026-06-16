// Structured error model shared by main and renderer.
//
// Every error that crosses the IPC boundary is reduced to an IpcError:
// a stable machine-readable code plus a human-readable message. Domain code
// throws GameError with an explicit code; anything else (TypeError, SQLite
// failure, non-Error throw) is classified INTERNAL so the dispatcher can log
// it and the renderer can present it as a bug rather than a user mistake.

export const ERROR_CODES = [
  /** Bad user input or unmet action precondition (e.g. not enough credits). */
  'VALIDATION',
  /** A referenced entity (save, system, ship, order, ...) does not exist. */
  'NOT_FOUND',
  /** The action conflicts with current state (e.g. deleting the open save). */
  'CONFLICT',
  /** No campaign is loaded; the renderer should send the user to Save/Load. */
  'NO_CAMPAIGN',
  /** Mod content failed to load or validate. */
  'MOD_VALIDATION',
  /** Unexpected failure — a bug or environment problem, logged in main. */
  'INTERNAL'
] as const

export type ErrorCode = (typeof ERROR_CODES)[number]

/** The error shape carried inside a failed IpcResult. */
export interface IpcError {
  code: ErrorCode
  message: string
}

/** Base class for all expected, user-presentable errors. */
export class GameError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'GameError'
  }
}

/**
 * Reduce any thrown value to an IpcError. GameError keeps its code; every
 * other throw — including non-Error values — is classified INTERNAL.
 */
export function toIpcError(err: unknown): IpcError {
  if (err instanceof GameError) return { code: err.code, message: err.message }
  return { code: 'INTERNAL', message: errorMessage(err) }
}

/** Safe message extraction for any thrown value (never yields "undefined"). */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
