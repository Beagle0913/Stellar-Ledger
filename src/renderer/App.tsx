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
import { PAGE_REGISTRY } from './pages/registry'

export type { PageId } from './context'
export { useApp } from './context'

const PAGES: NavItem[] = PAGE_REGISTRY.filter(
  (entry) => entry.showInNav && (!entry.devOnly || import.meta.env.DEV)
).map(({ id, label }) => ({ id, label }))

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
  const entry = PAGE_REGISTRY.find((p) => p.id === page)
  if (!entry) throw new Error(`Unknown page: ${page}`)
  const Component = entry.component
  return <Component />
}
