import type {
  BuildBuildingArgs,
  CreateMarketOrderArgs,
  CreateNewCampaignArgs,
  CreateTransportJobArgs,
  DashboardData,
  DebugStateView,
  EventLogView,
  GameLogEntry,
  InventoryView,
  ItemDefinition,
  LogisticsView,
  MarketView,
  ModsView,
  PlanetDetail,
  PreviewMarketTradeArgs,
  MarketTradePreview,
  PriceHistoryArgs,
  PricePoint,
  ProductionPlanArgs,
  ProductionPlanView,
  ProductionView,
  PurchaseShipArgs,
  RepeatProductionJobArgs,
  RunProductionUntilExhaustedArgs,
  RunTicksSmartArgs,
  ScenarioSummary,
  StarMapView,
  SaveSummary,
  StartProductionJobArgs,
  SystemDetail,
  SystemSummary,
  TickResult
} from '../shared/types.js'
import { CampaignSession } from './campaignSession.js'
import { ModCatalog } from './modCatalog.js'
import {
  createCampaignLifecycle,
  ensureSavesDir,
  type CampaignLifecycle
} from './services/campaignLifecycle.js'
import { createGameMutations, type GameMutations } from './services/gameMutations.js'
import { createGameViews, type GameViews } from './services/gameViews.js'
import { createModService, type ModService } from './services/modService.js'

export interface GameServiceConfig {
  baseDir: string
  savesDir: string
  vanillaDir: string
  modsDir: string
}

/**
 * Owns the active campaign (in-memory GameState + its SQLite file) and is the
 * single place IPC handlers call into. The renderer never sees this directly.
 */
export class GameService {
  private readonly session = new CampaignSession()
  private readonly modCatalog: ModCatalog
  private readonly views: GameViews
  private readonly lifecycle: CampaignLifecycle
  private readonly mutations: GameMutations
  private readonly mods: ModService

  constructor(private readonly config: GameServiceConfig) {
    ensureSavesDir(config.savesDir)
    this.modCatalog = new ModCatalog({
      baseDir: config.baseDir,
      vanillaDir: config.vanillaDir,
      modsDir: config.modsDir
    })
    this.views = createGameViews({ session: this.session })
    this.lifecycle = createCampaignLifecycle({
      session: this.session,
      modCatalog: this.modCatalog,
      config: { savesDir: this.config.savesDir },
      getDashboard: () => this.views.getDashboard()
    })
    this.mutations = createGameMutations({ session: this.session })
    this.mods = createModService({ session: this.session, modCatalog: this.modCatalog })
  }

  listScenarios(): ScenarioSummary[] {
    return this.lifecycle.listScenarios()
  }

  createNewCampaign(args: CreateNewCampaignArgs): DashboardData {
    return this.lifecycle.createNewCampaign(args)
  }

  loadExistingCampaign(fileName: string): DashboardData {
    return this.lifecycle.loadExistingCampaign(fileName)
  }

  saveCurrent(): true {
    return this.lifecycle.saveCurrent()
  }

  hasActiveCampaign(): boolean {
    return this.lifecycle.hasActiveCampaign()
  }

  close(): void {
    return this.lifecycle.close()
  }

  listSaves(): SaveSummary[] {
    return this.lifecycle.listSaves()
  }

  deleteSave(fileName: string): true {
    return this.lifecycle.deleteSave(fileName)
  }

  renameSave(fileName: string, newName: string): true {
    return this.lifecycle.renameSave(fileName, newName)
  }

  getDashboard(): DashboardData {
    return this.views.getDashboard()
  }

  getItems(): ItemDefinition[] {
    return this.views.getItems()
  }

  getPriceHistory(args: PriceHistoryArgs): PricePoint[] {
    return this.views.getPriceHistory(args)
  }

  getSystems(): SystemSummary[] {
    return this.views.getSystems()
  }

  getStarMap(): StarMapView {
    return this.views.getStarMap()
  }

  getSystem(id: string): SystemDetail {
    return this.views.getSystem(id)
  }

  getPlanet(id: string): PlanetDetail {
    return this.views.getPlanet(id)
  }

  getMarket(systemId: string): MarketView {
    return this.views.getMarket(systemId)
  }

  getInventory(): InventoryView[] {
    return this.views.getInventory()
  }

  getProduction(): ProductionView {
    return this.views.getProduction()
  }

  getProductionPlan(args: ProductionPlanArgs): ProductionPlanView {
    return this.views.getProductionPlan(args)
  }

  getLogistics(): LogisticsView {
    return this.views.getLogistics()
  }

  getEvents(): EventLogView[] {
    return this.views.getEvents()
  }

  getActivityLog(limit?: number): GameLogEntry[] {
    return this.views.getActivityLog(limit)
  }

  getMods(): ModsView {
    return this.mods.getMods()
  }

  reloadModData(): ModsView {
    return this.mods.reloadModData()
  }

  setModEnabled(modId: string, enabled: boolean): ModsView {
    return this.mods.setModEnabled(modId, enabled)
  }

  createMarketOrder(args: CreateMarketOrderArgs): true {
    return this.mutations.createMarketOrder(args)
  }

  cancelMarketOrder(orderId: string): true {
    return this.mutations.cancelMarketOrder(orderId)
  }

  startProductionJob(args: StartProductionJobArgs): true {
    return this.mutations.startProductionJob(args)
  }

  cancelProductionJob(jobId: string): true {
    return this.mutations.cancelProductionJob(jobId)
  }

  buildBuilding(args: BuildBuildingArgs): true {
    return this.mutations.buildBuilding(args)
  }

  createTransportJob(args: CreateTransportJobArgs): true {
    return this.mutations.createTransportJob(args)
  }

  cancelTransportJob(jobId: string): true {
    return this.mutations.cancelTransportJob(jobId)
  }

  purchaseShip(args: PurchaseShipArgs): true {
    return this.mutations.purchaseShip(args)
  }

  runTick(): TickResult {
    return this.mutations.runTick()
  }

  runTicks(n: number): TickResult {
    return this.mutations.runTicks(n)
  }

  runTicksSmart(args: RunTicksSmartArgs): TickResult {
    return this.mutations.runTicksSmart(args)
  }

  previewMarketTrade(args: PreviewMarketTradeArgs): MarketTradePreview {
    return this.mutations.previewMarketTrade(args)
  }

  executeMarketTrade(args: PreviewMarketTradeArgs): MarketTradePreview {
    return this.mutations.executeMarketTrade(args)
  }

  repeatProductionJob(args: RepeatProductionJobArgs): true {
    return this.mutations.repeatProductionJob(args)
  }

  runProductionUntilExhausted(args: RunProductionUntilExhaustedArgs): { queued: number } {
    return this.mutations.runProductionUntilExhausted(args)
  }

  acceptContract(contractId: string): true {
    return this.mutations.acceptContract(contractId)
  }

  completeContract(contractId: string): true {
    return this.mutations.completeContract(contractId)
  }

  abandonContract(contractId: string): true {
    return this.mutations.abandonContract(contractId)
  }

  getDebugState(): DebugStateView {
    return this.views.getDebugState()
  }
}
