import { describe, expect, it } from 'vitest'
import {
  CAMPAIGN_REQUIRED_PAGES,
  formatApiErrorMessage,
  isCampaignRequiredPage,
  isInternalError,
  isNoCampaignError,
  resolveNoCampaignRecovery,
  shouldRecoverNoCampaign
} from '../src/renderer/campaignRequired.js'
import { ApiError } from '../src/renderer/apiError.js'

describe('campaignRequired helpers', () => {
  it('recognizes ApiError with code NO_CAMPAIGN', () => {
    const err = new ApiError('NO_CAMPAIGN', 'No active campaign. Create or load one first.')
    expect(isNoCampaignError(err)).toBe(true)
    expect(isInternalError(err)).toBe(false)
  })

  it('treats INTERNAL differently from NO_CAMPAIGN', () => {
    const internal = new ApiError('INTERNAL', 'simulated bug')
    expect(isNoCampaignError(internal)).toBe(false)
    expect(isInternalError(internal)).toBe(true)
  })

  it('does not classify plain Errors as NO_CAMPAIGN', () => {
    expect(isNoCampaignError(new Error('No active campaign'))).toBe(false)
    expect(isInternalError(new Error('boom'))).toBe(false)
  })

  it('does not redirect on Save/Load or Mods pages', () => {
    expect(shouldRecoverNoCampaign('saveload')).toBe(false)
    expect(shouldRecoverNoCampaign('mods')).toBe(false)
    expect(resolveNoCampaignRecovery('saveload')).toBe('sync')
    expect(resolveNoCampaignRecovery('mods')).toBe('sync')
  })

  it('redirects campaign-dependent pages on NO_CAMPAIGN', () => {
    for (const page of CAMPAIGN_REQUIRED_PAGES) {
      expect(shouldRecoverNoCampaign(page)).toBe(true)
      expect(resolveNoCampaignRecovery(page)).toBe('redirect')
      expect(isCampaignRequiredPage(page)).toBe(true)
    }
  })

  it('leaves non-campaign pages out of the required set', () => {
    expect(isCampaignRequiredPage('saveload')).toBe(false)
    expect(isCampaignRequiredPage('mods')).toBe(false)
  })

  it('formats ApiError messages for display panels', () => {
    expect(formatApiErrorMessage(new ApiError('VALIDATION', 'Quantity must be positive.'))).toBe(
      'Action blocked: Quantity must be positive.'
    )
    expect(formatApiErrorMessage('plain')).toBe('plain')
  })
})
