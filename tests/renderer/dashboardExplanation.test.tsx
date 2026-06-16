// @vitest-environment jsdom
import './setup.js'
import './apiMock.js'
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { explainMarketChange } from '../../src/shared/explanations/market.js'
import type { MarketChangeEntry, TickResult } from '../../src/shared/types.js'
import { renderWithApp } from './renderWithApp.js'
import { DashboardPage } from '../../src/renderer/pages/DashboardPage.js'

const marketChange: MarketChangeEntry = {
  systemId: 'system_sys_helion',
  systemName: 'Helion',
  itemId: 'food',
  itemName: 'Food',
  price: 15,
  previousPrice: 12,
  priceChange: 3,
  priceChangePercent: 25,
  reason: 'shortage',
  reasonLabel: 'Shortage',
  trend: 'rising'
}

const marketExplanation = explainMarketChange(marketChange)
const marketMessageSnippet = 'regional stockpiles are below target'

const lastTick: TickResult = {
  tick: 5,
  trades: 0,
  completedProductionJobs: 0,
  completedTransportJobs: 0,
  newEvents: 1,
  regionalTrades: 0,
  log: [],
  marketChanges: [marketChange],
  explanations: [
    marketExplanation,
    {
      code: 'event.fired.trigger_match',
      severity: 'info',
      title: 'Event fired',
      message: 'fires every 5 days'
    }
  ]
}

vi.mock('../../src/renderer/hooks.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/renderer/hooks.js')>()
  return {
    ...actual,
    useTickControls: () => ({
      tickLog: [lastTick],
      ticking: false,
      error: null,
      notice: null,
      lastTick,
      setNotice: vi.fn(),
      runTick: vi.fn(async () => {}),
      runWeek: vi.fn(async () => {}),
      runSmart: vi.fn(async () => {})
    })
  }
})

describe('Dashboard explanation deduplication', () => {
  it('shows market explanation once under Market changes, not under Why today', async () => {
    renderWithApp(<DashboardPage />)

    await screen.findByText('Market changes')
    expect(screen.queryByText('Why today')).not.toBeInTheDocument()

    expect(screen.getByText(new RegExp(marketMessageSnippet))).toBeInTheDocument()
    expect(screen.queryAllByText(new RegExp(marketMessageSnippet))).toHaveLength(1)
  })
})
