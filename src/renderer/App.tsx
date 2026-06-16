import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from './api'
import {
  formatApiErrorMessage,
  isNoCampaignError,
  resolveNoCampaignRecovery
} from './campaignRequired'
import { CampaignRequiredBoundary } from './components/CampaignRequiredBoundary'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Layout, type NavItem } from './components/Layout'
import {
  AppContext,
  type AppContextValue,
  type NavParams,
  type PageId
} from './context'
import type { DashboardData } from '../shared/types'
import { DashboardPage } from './pages/DashboardPage'
import { StarMapPage } from './pages/StarMapPage'
import { SystemPage } from './pages/SystemPage'
import { PlanetPage } from './pages/PlanetPage'
import { MarketPage } from './pages/MarketPage'
import { ProductionPage } from './pages/ProductionPage'
import { InventoryPage } from './pages/InventoryPage'
import { LogisticsPage } from './pages/LogisticsPage'
import { ModsPage } from './pages/ModsPage'
import { SaveLoadPage } from './pages/SaveLoadPage'
import { DebugPage } from './pages/DebugPage'

export type { PageId } from './context'
export { useApp } from './context'

const BASE_PAGES: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'starmap', label: 'Star Map' },
  { id: 'system', label: 'System' },
  { id: 'planet', label: 'Planet' },
  { id: 'market', label: 'Market' },
  { id: 'production', label: 'Production' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'logistics', label: 'Logistics' },
  { id: 'mods', label: 'Mods' },
  { id: 'saveload', label: 'Save / Load' }
]

const PAGES: NavItem[] = import.meta.env.DEV
  ? [...BASE_PAGES, { id: 'debug', label: 'Debug' }]
  : BASE_PAGES

export function App(): React.JSX.Element {
  const [page, setPage] = useState<PageId>('saveload')
  const [selectedSystemId, setSelectedSystemId] = useState<string | null>(null)
  const [selectedPlanetId, setSelectedPlanetId] = useState<string | null>(null)
  const [token, setToken] = useState(0)
  const [campaignActive, setCampaignActive] = useState(false)
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)

  const navigate = useCallback((next: PageId, params?: NavParams) => {
    if (params?.systemId !== undefined) {
      setSelectedSystemId(params.systemId)
      if (params.planetId === undefined) setSelectedPlanetId(null)
    }
    if (params?.planetId !== undefined) setSelectedPlanetId(params.planetId)
    setPage(next)
  }, [])

  const refresh = useCallback(() => setToken((t) => t + 1), [])

  const recoverNoCampaign = useCallback(() => {
    setCampaignActive(false)
    setDashboard(null)
    setSelectedSystemId(null)
    setSelectedPlanetId(null)
    setPage('saveload')
  }, [])

  const handleApiError = useCallback(
    (err: unknown): string | null => {
      if (isNoCampaignError(err)) {
        if (resolveNoCampaignRecovery(page) === 'redirect') {
          recoverNoCampaign()
        } else {
          setCampaignActive(false)
          setDashboard(null)
        }
        return null
      }
      return formatApiErrorMessage(err)
    },
    [page, recoverNoCampaign]
  )

  // Detect an already-active campaign (e.g. after a hot reload) on first mount.
  useEffect(() => {
    api
      .hasActiveCampaign()
      .then((active) => {
        if (active) {
          setCampaignActive(true)
          setPage('dashboard')
        }
      })
      .catch(() => undefined)
  }, [])

  // Keep the sidebar footer (credits/day) in sync whenever something changes.
  useEffect(() => {
    if (!campaignActive) {
      setDashboard(null)
      return
    }
    api
      .getDashboard()
      .then(setDashboard)
      .catch((err) => {
        if (isNoCampaignError(err)) {
          recoverNoCampaign()
          return
        }
        setDashboard(null)
      })
  }, [campaignActive, token, recoverNoCampaign])

  const ctx = useMemo<AppContextValue>(
    () => ({
      page,
      navigate,
      refresh,
      token,
      selectedSystemId,
      selectedPlanetId,
      campaignActive,
      setCampaignActive,
      recoverNoCampaign,
      handleApiError
    }),
    [
      page,
      navigate,
      refresh,
      token,
      selectedSystemId,
      selectedPlanetId,
      campaignActive,
      recoverNoCampaign,
      handleApiError
    ]
  )

  return (
    <AppContext.Provider value={ctx}>
      <Layout
        pages={PAGES}
        active={page}
        onNavigate={(id) => navigate(id as PageId)}
        footer={
          dashboard
            ? {
                campaignName: dashboard.campaignName,
                credits: dashboard.credits,
                tick: dashboard.tick,
                saveStatus: dashboard.saveStatus,
                saveError: dashboard.saveError
              }
            : null
        }
      >
        <ErrorBoundary resetKey={`${page}:${token}`}>
          <CampaignRequiredBoundary page={page}>
            <PageView page={page} />
          </CampaignRequiredBoundary>
        </ErrorBoundary>
      </Layout>
    </AppContext.Provider>
  )
}

function PageView({ page }: { page: PageId }): React.JSX.Element {
  switch (page) {
    case 'dashboard':
      return <DashboardPage />
    case 'starmap':
      return <StarMapPage />
    case 'system':
      return <SystemPage />
    case 'planet':
      return <PlanetPage />
    case 'market':
      return <MarketPage />
    case 'production':
      return <ProductionPage />
    case 'inventory':
      return <InventoryPage />
    case 'logistics':
      return <LogisticsPage />
    case 'mods':
      return <ModsPage />
    case 'saveload':
      return <SaveLoadPage />
    case 'debug':
      return <DebugPage />
  }
}
