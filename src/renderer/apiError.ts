import type { ErrorCode } from '../shared/errors'

/** Error thrown by every api.* call on failure; carries the structured code. */
export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}
