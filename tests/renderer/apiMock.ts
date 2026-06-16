import { vi } from 'vitest'
import { createMockRendererApi } from './mockApi.js'

/** Shared mock for vi.mock — import this module before page components in smoke tests. */
export const mockApi = createMockRendererApi()

vi.mock('../../src/renderer/api.js', () => ({
  api: mockApi,
  ApiError: class ApiError extends Error {
    constructor(
      readonly code: string,
      message: string
    ) {
      super(message)
      this.name = 'ApiError'
    }
  }
}))
