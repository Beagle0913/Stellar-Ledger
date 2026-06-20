import type { ComponentType } from 'react'
import type { PageId } from '../context'
import { DashboardPage } from './DashboardPage'
import { DebugPage } from './DebugPage'
import { InventoryPage } from './InventoryPage'
import { LogisticsPage } from './LogisticsPage'
import { MarketPage } from './MarketPage'
import { ModsPage } from './ModsPage'
import { PlanetPage } from './PlanetPage'
import { ProductionPage } from './ProductionPage'
import { SaveLoadPage } from './SaveLoadPage'
import { StarMapPage } from './StarMapPage'
import { SystemPage } from './SystemPage'

export type PageRegistryEntry = {
  id: PageId
  label: string
  component: ComponentType
  showInNav: boolean
  devOnly?: boolean
}

export const PAGE_REGISTRY: PageRegistryEntry[] = [
  { id: 'dashboard', label: 'Dashboard', component: DashboardPage, showInNav: true },
  { id: 'starmap', label: 'Star Map', component: StarMapPage, showInNav: true },
  { id: 'system', label: 'System', component: SystemPage, showInNav: true },
  { id: 'planet', label: 'Planet', component: PlanetPage, showInNav: true },
  { id: 'market', label: 'Market', component: MarketPage, showInNav: true },
  { id: 'production', label: 'Production', component: ProductionPage, showInNav: true },
  { id: 'inventory', label: 'Inventory', component: InventoryPage, showInNav: true },
  { id: 'logistics', label: 'Logistics', component: LogisticsPage, showInNav: true },
  { id: 'mods', label: 'Mods', component: ModsPage, showInNav: true },
  { id: 'saveload', label: 'Save / Load', component: SaveLoadPage, showInNav: true },
  { id: 'debug', label: 'Debug', component: DebugPage, showInNav: true, devOnly: true }
]
