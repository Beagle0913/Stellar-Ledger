import React from 'react'
import { render, type RenderResult } from '@testing-library/react'
import { vi } from 'vitest'
import { AppContext, type AppContextValue, type PageId } from '../../src/renderer/context.js'
import { MOCK_HOME_PLANET_ID, MOCK_HOME_SYSTEM_ID } from './fixtures.js'

export function defaultAppContext(overrides: Partial<AppContextValue> = {}): AppContextValue {
  return {
    page: 'dashboard' as PageId,
    navigate: vi.fn(),
    refresh: vi.fn(),
    token: 0,
    selectedSystemId: MOCK_HOME_SYSTEM_ID,
    selectedPlanetId: MOCK_HOME_PLANET_ID,
    campaignActive: true,
    setCampaignActive: vi.fn(),
    recoverNoCampaign: vi.fn(),
    handleApiError: (err: unknown) => (err instanceof Error ? err.message : String(err)),
    ...overrides
  }
}

export function renderWithApp(ui: React.ReactElement, overrides: Partial<AppContextValue> = {}): RenderResult {
  const value = defaultAppContext(overrides)
  return render(<AppContext.Provider value={value}>{ui}</AppContext.Provider>)
}
