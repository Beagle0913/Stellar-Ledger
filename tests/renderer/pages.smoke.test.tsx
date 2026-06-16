// @vitest-environment jsdom
import './setup.js'
import './apiMock.js'
import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithApp } from './renderWithApp.js'
import { DashboardPage } from '../../src/renderer/pages/DashboardPage.js'
import { SaveLoadPage } from '../../src/renderer/pages/SaveLoadPage.js'
import { InventoryPage } from '../../src/renderer/pages/InventoryPage.js'
import { MarketPage } from '../../src/renderer/pages/MarketPage.js'
import { ProductionPage } from '../../src/renderer/pages/ProductionPage.js'
import { LogisticsPage } from '../../src/renderer/pages/LogisticsPage.js'
import { ModsPage } from '../../src/renderer/pages/ModsPage.js'
import { SystemPage } from '../../src/renderer/pages/SystemPage.js'
import { PlanetPage } from '../../src/renderer/pages/PlanetPage.js'
import { StarMapPage } from '../../src/renderer/pages/StarMapPage.js'

describe('renderer page smoke tests', () => {
  it('SaveLoadPage renders save/load heading', async () => {
    renderWithApp(<SaveLoadPage />, { campaignActive: false, page: 'saveload' })
    expect(await screen.findByRole('heading', { name: 'Save / Load' })).toBeInTheDocument()
  })

  it('DashboardPage renders tick controls', async () => {
    renderWithApp(<DashboardPage />)
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Run 1 Day Tick' })).toBeInTheDocument()
  })

  it('InventoryPage renders inventory heading and data', async () => {
    renderWithApp(<InventoryPage />)
    expect(await screen.findByRole('heading', { name: 'Inventory' })).toBeInTheDocument()
    expect(await screen.findByText('Helion')).toBeInTheDocument()
    expect(await screen.findByText('Ore')).toBeInTheDocument()
  })

  it('MarketPage renders market heading', async () => {
    renderWithApp(<MarketPage />)
    expect(await screen.findByRole('heading', { name: 'Market' })).toBeInTheDocument()
  })

  it('ProductionPage renders production heading', async () => {
    renderWithApp(<ProductionPage />)
    expect(await screen.findByRole('heading', { name: 'Production' })).toBeInTheDocument()
  })

  it('LogisticsPage renders logistics heading', async () => {
    renderWithApp(<LogisticsPage />)
    expect(await screen.findByRole('heading', { name: 'Logistics' })).toBeInTheDocument()
  })

  it('ModsPage renders mods heading', async () => {
    renderWithApp(<ModsPage />)
    expect(await screen.findByRole('heading', { name: 'Mods & Data' })).toBeInTheDocument()
  })

  it('SystemPage renders system detail when selected', async () => {
    renderWithApp(<SystemPage />)
    expect(await screen.findByRole('heading', { name: 'Helion' })).toBeInTheDocument()
  })

  it('PlanetPage renders planet detail when selected', async () => {
    renderWithApp(<PlanetPage />)
    expect(await screen.findByRole('heading', { name: 'Helion Prime' })).toBeInTheDocument()
  })

  it('StarMapPage renders map, node, and detail panel', async () => {
    renderWithApp(<StarMapPage />)
    expect(await screen.findByTestId('star-map-page')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Star Map' })).toBeInTheDocument()
    expect(await screen.findByTestId('star-map-svg')).toBeInTheDocument()
    expect(await screen.findByTestId('star-map-node-sys_helion')).toBeInTheDocument()
    const detail = await screen.findByTestId('star-map-detail-panel')
    expect(detail).toHaveTextContent('Helion')
  })
})
