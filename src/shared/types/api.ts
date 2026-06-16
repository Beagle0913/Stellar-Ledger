import type { IpcError } from '../errors.js'
import type {
  BuildingTypeId,
  ItemDefinition,
  ItemId,
  PlanetId,
  RecipeId,
  SystemId
} from './definitions.js'
import type { GameLogEntry, OrderSide } from './state.js'
import type {
  DashboardData,
  DebugStateView,
  EventLogView,
  InventoryView,
  LogisticsView,
  MarketTradePreview,
  MarketView,
  ModsView,
  PlanetDetail,
  PricePoint,
  ProductionView,
  SaveSummary,
  StarMapView,
  SystemDetail,
  SystemSummary,
  TickResult,
  MarketTradeAction
} from './views.js'

export type IpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: IpcError }

export interface CreateMarketOrderArgs {
  systemId: SystemId
  itemId: ItemId
  side: OrderSide
  quantity: number
  price: number
}

export interface StartProductionJobArgs {
  buildingId: string
  recipeId: RecipeId
  quantity: number
}

export interface BuildBuildingArgs {
  planetId: PlanetId
  buildingType: BuildingTypeId
}

export interface CreateTransportJobArgs {
  shipId: string
  destinationSystemId: SystemId
  itemId: ItemId
  quantity: number
}

export interface SetModEnabledArgs {
  modId: string
  enabled: boolean
}

export interface PurchaseShipArgs {
  shipDefinitionId: string
  name?: string
}

export interface PreviewMarketTradeArgs {
  systemId: SystemId
  itemId: ItemId
  action: MarketTradeAction
  quantity?: number
}

export type SmartTickMode = 'production' | 'transport' | 'changes'

export interface RunTicksSmartArgs {
  mode: SmartTickMode
  maxDays?: number
}

export interface RepeatProductionJobArgs {
  buildingId: string
  recipeId: RecipeId
  quantity: number
}

export interface RunProductionUntilExhaustedArgs {
  buildingId: string
  recipeId: RecipeId
}

export interface PriceHistoryArgs {
  systemId: SystemId
  itemId: ItemId
}

export interface RenameSaveArgs {
  fileName: string
  newName: string
}

export interface GameApi {
  listSaves(): Promise<IpcResult<SaveSummary[]>>
  createNewCampaign(name: string): Promise<IpcResult<DashboardData>>
  loadCampaign(id: string): Promise<IpcResult<DashboardData>>
  saveCurrent(): Promise<IpcResult<true>>
  hasActiveCampaign(): Promise<IpcResult<boolean>>
  getDashboard(): Promise<IpcResult<DashboardData>>
  getItems(): Promise<IpcResult<ItemDefinition[]>>
  getPriceHistory(args: PriceHistoryArgs): Promise<IpcResult<PricePoint[]>>
  getSystems(): Promise<IpcResult<SystemSummary[]>>
  /** Galactic map DTO for Star Map page and mod overlays. */
  getStarMap(): Promise<IpcResult<StarMapView>>
  getSystem(id: SystemId): Promise<IpcResult<SystemDetail>>
  getPlanet(id: PlanetId): Promise<IpcResult<PlanetDetail>>
  getMarket(systemId: SystemId): Promise<IpcResult<MarketView>>
  createMarketOrder(args: CreateMarketOrderArgs): Promise<IpcResult<true>>
  cancelMarketOrder(orderId: string): Promise<IpcResult<true>>
  getInventory(): Promise<IpcResult<InventoryView[]>>
  getProduction(): Promise<IpcResult<ProductionView>>
  startProductionJob(args: StartProductionJobArgs): Promise<IpcResult<true>>
  buildBuilding(args: BuildBuildingArgs): Promise<IpcResult<true>>
  getLogistics(): Promise<IpcResult<LogisticsView>>
  createTransportJob(args: CreateTransportJobArgs): Promise<IpcResult<true>>
  cancelTransportJob(jobId: string): Promise<IpcResult<true>>
  runTick(): Promise<IpcResult<TickResult>>
  runTicks(n: number): Promise<IpcResult<TickResult>>
  deleteSave(fileName: string): Promise<IpcResult<true>>
  renameSave(fileName: string, newName: string): Promise<IpcResult<true>>
  getMods(): Promise<IpcResult<ModsView>>
  setModEnabled(args: SetModEnabledArgs): Promise<IpcResult<ModsView>>
  getEvents(): Promise<IpcResult<EventLogView[]>>
  getActivityLog(limit?: number): Promise<IpcResult<GameLogEntry[]>>
  getDebugState(): Promise<IpcResult<DebugStateView>>
  cancelProductionJob(jobId: string): Promise<IpcResult<true>>
  purchaseShip(args: PurchaseShipArgs): Promise<IpcResult<true>>
  runTicksSmart(args: RunTicksSmartArgs): Promise<IpcResult<TickResult>>
  previewMarketTrade(args: PreviewMarketTradeArgs): Promise<IpcResult<MarketTradePreview>>
  executeMarketTrade(args: PreviewMarketTradeArgs): Promise<IpcResult<MarketTradePreview>>
  repeatProductionJob(args: RepeatProductionJobArgs): Promise<IpcResult<true>>
  runProductionUntilExhausted(
    args: RunProductionUntilExhaustedArgs
  ): Promise<IpcResult<{ queued: number }>>
  acceptContract(contractId: string): Promise<IpcResult<true>>
  completeContract(contractId: string): Promise<IpcResult<true>>
  abandonContract(contractId: string): Promise<IpcResult<true>>
  reloadModData(): Promise<IpcResult<ModsView>>
}

export type { MarketTradePreview } from './views.js'
