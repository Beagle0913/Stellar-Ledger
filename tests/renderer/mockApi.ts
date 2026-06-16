import { vi } from 'vitest'
import type { GameApi, IpcResult } from '../../src/shared/types.js'
import {
  mockDashboard,
  mockInventory,
  mockLogistics,
  mockMarketView,
  mockModsView,
  mockPlanetDetail,
  mockProduction,
  mockStarMap,
  mockSystemDetail,
  mockSystemSummary
} from './fixtures.js'

/** Renderer `api` shape: GameApi methods that return unwrapped data (not IpcResult). */
export type MockRendererApi = {
  [K in keyof GameApi]: GameApi[K] extends (...args: infer A) => Promise<IpcResult<infer R>>
    ? (...args: A) => Promise<R>
    : never
}

/** Build a vi.fn-backed mock for every GameApi method with sensible defaults. */
export function createMockRendererApi(overrides: Partial<MockRendererApi> = {}): MockRendererApi {
  const base: MockRendererApi = {
    listSaves: vi.fn(async () => []),
    listScenarios: vi.fn(async () => [
      {
        id: 'standard',
        name: 'Standard',
        description: 'Default',
        difficulty: 'normal' as const,
        campaignStart: {}
      }
    ]),
    createNewCampaign: vi.fn(async () => mockDashboard),
    loadCampaign: vi.fn(async () => mockDashboard),
    saveCurrent: vi.fn(async () => true as const),
    hasActiveCampaign: vi.fn(async () => true),
    getDashboard: vi.fn(async () => mockDashboard),
    getItems: vi.fn(async () => []),
    getPriceHistory: vi.fn(async () => []),
    getSystems: vi.fn(async () => [mockSystemSummary]),
    getStarMap: vi.fn(async () => mockStarMap),
    getSystem: vi.fn(async () => mockSystemDetail),
    getPlanet: vi.fn(async () => mockPlanetDetail),
    getMarket: vi.fn(async () => mockMarketView),
    createMarketOrder: vi.fn(async () => true as const),
    cancelMarketOrder: vi.fn(async () => true as const),
    getInventory: vi.fn(async () => mockInventory),
    getProduction: vi.fn(async () => mockProduction),
    getProductionPlan: vi.fn(async () => ({
      feasible: true,
      targetItemId: 'metal',
      targetQty: 10,
      estimatedDays: 4,
      requiredInputs: [],
      requiredBuildings: [],
      bottlenecks: [],
      warnings: []
    })),
    startProductionJob: vi.fn(async () => true as const),
    buildBuilding: vi.fn(async () => true as const),
    getLogistics: vi.fn(async () => mockLogistics),
    createTransportJob: vi.fn(async () => true as const),
    cancelTransportJob: vi.fn(async () => true as const),
    runTick: vi.fn(async () => ({
      tick: 6,
      trades: 0,
      completedProductionJobs: 0,
      completedTransportJobs: 0,
      newEvents: 0,
      regionalTrades: 0,
      log: [],
      marketChanges: []
    })),
    runTicks: vi.fn(async () => ({
      tick: 12,
      trades: 0,
      completedProductionJobs: 0,
      completedTransportJobs: 0,
      newEvents: 0,
      regionalTrades: 0,
      log: [],
      marketChanges: []
    })),
    deleteSave: vi.fn(async () => true as const),
    renameSave: vi.fn(async () => true as const),
    getMods: vi.fn(async () => mockModsView),
    setModEnabled: vi.fn(async () => mockModsView),
    getEvents: vi.fn(async () => []),
    getActivityLog: vi.fn(async () => []),
    getDebugState: vi.fn(async () => ({
      localStockpiles: [],
      npcOrders: [],
      recentPrices: [],
      loadWarnings: []
    })),
    cancelProductionJob: vi.fn(async () => true as const),
    purchaseShip: vi.fn(async () => true as const),
    runTicksSmart: vi.fn(async () => ({
      tick: 8,
      trades: 0,
      completedProductionJobs: 0,
      completedTransportJobs: 0,
      newEvents: 0,
      regionalTrades: 0,
      log: [],
      marketChanges: []
    })),
    previewMarketTrade: vi.fn(async () => ({
      action: 'sell_max' as const,
      systemId: 'sys_helion',
      systemName: 'Helion',
      itemId: 'ore',
      itemName: 'Ore',
      quantity: 0,
      averagePrice: 0,
      fills: [],
      fillCount: 0
    })),
    executeMarketTrade: vi.fn(async () => ({
      action: 'sell_max' as const,
      systemId: 'sys_helion',
      systemName: 'Helion',
      itemId: 'ore',
      itemName: 'Ore',
      quantity: 0,
      averagePrice: 0,
      fills: [],
      fillCount: 0
    })),
    repeatProductionJob: vi.fn(async () => true as const),
    runProductionUntilExhausted: vi.fn(async () => ({ queued: 0 })),
    acceptContract: vi.fn(async () => true as const),
    completeContract: vi.fn(async () => true as const),
    abandonContract: vi.fn(async () => true as const),
    reloadModData: vi.fn(async () => mockModsView)
  }
  return { ...base, ...overrides }
}
