import type { GameApi, IpcResult } from '../shared/types'
import { ApiError } from './apiError'

// Thin renderer-side wrapper that unwraps IpcResult: returns data on success
// and throws an ApiError (message + code) on failure, so pages can use plain
// async/await + catch and still branch on the error code when useful.

export { ApiError } from './apiError'

async function unwrap<T>(promise: Promise<IpcResult<T>>): Promise<T> {
  const result = await promise
  if (!result.ok) throw new ApiError(result.error.code, result.error.message)
  return result.data
}

type Unwrapped = {
  [K in keyof GameApi]: GameApi[K] extends (...args: infer A) => Promise<IpcResult<infer R>>
    ? (...args: A) => Promise<R>
    : never
}

function build(): Unwrapped {
  const raw = window.api
  const out = {} as Record<string, unknown>
  for (const key of Object.keys(raw) as Array<keyof GameApi>) {
    out[key] = (...args: unknown[]) =>
      unwrap((raw[key] as (...a: unknown[]) => Promise<IpcResult<unknown>>)(...args))
  }
  return out as Unwrapped
}

export const api: Unwrapped = build()
