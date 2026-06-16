import { describe, expect, it } from 'vitest'
import { explainFromError, formatExplainedError } from '../../src/shared/explanations/fromError.js'

describe('explainFromError', () => {
  it('maps VALIDATION to error.validation with original message', () => {
    const ex = explainFromError({ code: 'VALIDATION', message: 'Quantity must be positive.' })
    expect(ex.code).toBe('error.validation')
    expect(ex.message).toBe('Quantity must be positive.')
  })

  it('maps known liquidity message to market.trade.blocked.no_liquidity', () => {
    const ex = explainFromError({
      code: 'VALIDATION',
      message: 'Not enough Metal liquidity on the market: need 50, only 12 available at current asks.'
    })
    expect(ex.code).toBe('market.trade.blocked.no_liquidity')
    expect(ex.message).toContain('12')
  })

  it('maps insufficient credits message', () => {
    const ex = explainFromError({
      code: 'VALIDATION',
      message: 'Not enough credits to escrow 500 cr.'
    })
    expect(ex.code).toBe('market.trade.blocked.insufficient_credits')
  })

  it('maps NOT_FOUND without inventing a specific cause', () => {
    const ex = explainFromError({ code: 'NOT_FOUND', message: 'Unknown ship "abc".' })
    expect(ex.code).toBe('error.not_found')
    expect(ex.message).toBe('Unknown ship "abc".')
  })

  it('formatExplainedError includes title for structured errors', () => {
    const text = formatExplainedError({
      code: 'VALIDATION',
      message: 'Not enough Ore to sell: need 5, have 2 available.'
    })
    expect(text).toContain('Not enough inventory')
    expect(text).toContain('Not enough Ore')
  })
})
