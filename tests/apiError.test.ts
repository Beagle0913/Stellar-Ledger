import { describe, expect, it } from 'vitest'
import { formatPriceChange, formatTrendLabel } from '../src/shared/economyDiagnostics.js'
import { ApiError } from '../src/renderer/apiError.js'
import { formatApiErrorMessage } from '../src/renderer/campaignRequired.js'

describe('renderer apiError helpers', () => {
  it('ApiError exposes structured code and message', () => {
    const err = new ApiError('VALIDATION', 'Quantity must be positive.')
    expect(err.code).toBe('VALIDATION')
    expect(err.message).toBe('Quantity must be positive.')
    expect(err.name).toBe('ApiError')
  })

  it('formatApiErrorMessage returns explained title and message for ApiError', () => {
    expect(formatApiErrorMessage(new ApiError('CONFLICT', 'Busy ship.'))).toBe(
      'Action conflict: Busy ship.'
    )
  })

  it('formatPriceChange matches economyDiagnostics snapshot style', () => {
    expect(formatPriceChange(2, 10)).toBe('+2 cr (+10.0%)')
    expect(formatPriceChange(null, null)).toBe('—')
    expect(formatTrendLabel('rising')).toBe('Rising')
  })
})
