import type { ErrorCode } from '../shared/errors'
import { formatExplainedError } from '../shared/explanations'
import { ApiError } from './apiError'
import type { PageId } from './context'

/** Pages that require an open campaign to function. */
export const CAMPAIGN_REQUIRED_PAGES: readonly PageId[] = [
  'dashboard',
  'starmap',
  'system',
  'planet',
  'market',
  'production',
  'inventory',
  'logistics'
]

/** True when the page should redirect/guide on NO_CAMPAIGN (not Save/Load or Mods). */
export function shouldRecoverNoCampaign(page: PageId): boolean {
  return page !== 'saveload' && page !== 'mods'
}

export function isCampaignRequiredPage(page: PageId): boolean {
  return (CAMPAIGN_REQUIRED_PAGES as readonly string[]).includes(page)
}

export function isNoCampaignError(err: unknown): err is ApiError {
  return err instanceof ApiError && err.code === 'NO_CAMPAIGN'
}

export function isInternalError(err: unknown): err is ApiError {
  return err instanceof ApiError && err.code === 'INTERNAL'
}

export function apiErrorCode(err: unknown): ErrorCode | null {
  return err instanceof ApiError ? err.code : null
}

/**
 * Decide how NO_CAMPAIGN should be handled for a given page.
 * - `redirect`: campaign page — clear stale UI and go to Save / Load
 * - `sync`: Save/Load or Mods — update campaignActive only, stay on page
 */
export function resolveNoCampaignRecovery(page: PageId): 'redirect' | 'sync' {
  return shouldRecoverNoCampaign(page) ? 'redirect' : 'sync'
}

/** User-visible message for errors that should still display in a panel. */
export function formatApiErrorMessage(err: unknown): string {
  if (err instanceof ApiError) return formatExplainedError({ code: err.code, message: err.message })
  if (err instanceof Error) return err.message
  return String(err)
}
