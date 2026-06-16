import { createContext, useContext } from 'react'

export type PageId =
  | 'dashboard'
  | 'starmap'
  | 'system'
  | 'planet'
  | 'market'
  | 'production'
  | 'inventory'
  | 'logistics'
  | 'mods'
  | 'saveload'
  | 'debug'

export interface NavParams {
  systemId?: string
  planetId?: string
}

export interface AppContextValue {
  page: PageId
  navigate: (page: PageId, params?: NavParams) => void
  /** Re-fetch global state (footer) and signal pages to reload. */
  refresh: () => void
  /** Bumps on every refresh so page effects re-run. */
  token: number
  selectedSystemId: string | null
  selectedPlanetId: string | null
  campaignActive: boolean
  setCampaignActive: (v: boolean) => void
  /** Clear campaign UI state and send the player to Save / Load. */
  recoverNoCampaign: () => void
  /**
   * Map an API failure to a user-visible message, or null when handled
   * (e.g. NO_CAMPAIGN recovery). INTERNAL errors still return a message.
   */
  handleApiError: (err: unknown) => string | null
}

export const AppContext = createContext<AppContextValue | null>(null)

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within App')
  return ctx
}
