// @vitest-environment jsdom
import './setup.js'
import './apiMock.js'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithApp } from './renderWithApp.js'
import { DashboardPage } from '../../src/renderer/pages/DashboardPage.js'
import { MarketPage } from '../../src/renderer/pages/MarketPage.js'
import { ProductionPage } from '../../src/renderer/pages/ProductionPage.js'
import { LogisticsPage } from '../../src/renderer/pages/LogisticsPage.js'
import { api } from '../../src/renderer/api.js'

describe('renderer page interactions', () => {
  it('DashboardPage run tick button calls api.runTick', async () => {
    const runTick = vi.spyOn(api, 'runTick').mockResolvedValue({
      tick: 6,
      trades: 0,
      completedProductionJobs: 0,
      completedTransportJobs: 0,
      newEvents: 0,
      regionalTrades: 0,
      log: [],
      marketChanges: []
    })

    renderWithApp(<DashboardPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Run 1 Day Tick' }))

    await waitFor(() => expect(runTick).toHaveBeenCalledTimes(1))
    runTick.mockRestore()
  })

  it('MarketPage submit order calls createMarketOrder', async () => {
    const createMarketOrder = vi.spyOn(api, 'createMarketOrder').mockResolvedValue(true)

    renderWithApp(<MarketPage />)
    await screen.findByRole('heading', { name: 'Market' })
    fireEvent.click(await screen.findByRole('button', { name: 'Submit Order' }))

    await waitFor(() => expect(createMarketOrder).toHaveBeenCalled())
    createMarketOrder.mockRestore()
  })

  it('ProductionPage renders building table when data loads', async () => {
    renderWithApp(<ProductionPage />)
    expect(await screen.findByRole('heading', { name: 'Production' })).toBeInTheDocument()
  })

  it('LogisticsPage renders ship section when data loads', async () => {
    renderWithApp(<LogisticsPage />)
    expect(await screen.findByRole('heading', { name: 'Logistics' })).toBeInTheDocument()
    expect(await screen.findByText('Hauler I')).toBeInTheDocument()
  })
})
