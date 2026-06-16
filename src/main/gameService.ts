import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { VANILLA_MOD_ID } from '../shared/constants.js'
import { errorMessage, GameError } from '../shared/errors.js'
import { resolveScenario, STANDARD_SCENARIO_ID } from '../shared/scenarios.js'
import type {
  BuildBuildingArgs,
  CreateMarketOrderArgs,
  CreateNewCampaignArgs,
  CreateTransportJobArgs,
  DashboardData,
  DebugStateView,
  DefinitionCounts,
  EventLogView,
  GameDefinitions,
  GameLogEntry,
  GameState,
  ItemDefinition,
  InventoryView,
  LogisticsView,
  MarketView,
  ModInfo,
  ModsView,
  PlanetDetail,
  PriceHistoryArgs,
  PricePoint,
  ProductionView,
  ProductionPlanArgs,
  ProductionPlanView,
  PurchaseShipArgs,
  RepeatProductionJobArgs,
  RunProductionUntilExhaustedArgs,
  RunTicksSmartArgs,
  ScenarioSummary,
  StarMapView,
  PreviewMarketTradeArgs,
  MarketTradePreview,
  SaveSummary,
  StartProductionJobArgs,
  SystemDetail,
  SystemSummary,
  TickResult
} from '../shared/types.js'
import { closeDatabase, openDatabase } from '../database/db.js'
import { debugLog, logSystem, logTickEntries } from './log.js'
import { logPlayerAction } from './actionLog.js'
import { createCampaign, loadCampaign } from '../database/saveManager.js'
import { loadValidationWarnings } from '../database/saveValidation.js'
import { loadMeta } from '../database/repositories/worldRepo.js'
import { detectModConflicts, modLoadOrder } from '../mods/modDiagnostics.js'
import { buildStarMapView, recordRegionalTradesForMap } from '../simulation/starMapView.js'
import { runTicksSmart } from '../simulation/smartTick.js'
import { runTick, runTicks } from '../simulation/tick.js'
import {
  cmdAcceptContract,
  cmdAbandonContract,
  cmdCompleteContract
} from './commands/progressionCommands.js'
import {
  cmdCancelTransportJob,
  cmdCreateTransportJob,
  cmdPurchaseShip
} from './commands/logisticsCommands.js'
import {
  cmdBuildBuilding,
  cmdCancelProductionJob,
  cmdRepeatProductionJob,
  cmdRunProductionUntilExhausted,
  cmdStartProductionJob
} from './commands/productionCommands.js'
import {
  cmdCancelMarketOrder,
  cmdCreateMarketOrder,
  cmdExecuteMarketTrade,
  cmdPreviewMarketTrade
} from './commands/marketCommands.js'
import {
  buildDashboard,
  buildDebugStateView,
  buildInventoryView,
  buildLogisticsView,
  buildMarketView,
  buildEventLogViews,
  buildPlanetDetail,
  buildPriceHistory,
  buildProductionView,
  buildProductionPlanView,
  buildSystemDetail,
  buildSystemSummaries
} from '../simulation/viewQueries.js'
import { CampaignSession } from './campaignSession.js'
import { ModCatalog } from './modCatalog.js'

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

  constructor(private readonly config: GameServiceConfig) {
    if (!existsSync(config.savesDir)) mkdirSync(config.savesDir, { recursive: true })
    this.modCatalog = new ModCatalog({
      baseDir: config.baseDir,
      vanillaDir: config.vanillaDir,
      modsDir: config.modsDir
    })
  }

  // ---- Campaign lifecycle ---------------------------------------------------

  listScenarios(): ScenarioSummary[] {
    const { defs } = this.modCatalog.load()
    return defs.scenarios.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      difficulty: s.difficulty,
      campaignStart: s.campaignStart
    }))
  }

  createNewCampaign(args: CreateNewCampaignArgs): DashboardData {
    const { defs, errors } = this.modCatalog.reload()
    if (errors.length > 0) {
      throw new GameError(
        'MOD_VALIDATION',
        `Cannot start campaign — mod validation failed:\n${errors.join('\n')}`
      )
    }
    this.session.close()
    const safeName = (args.name || 'Campaign').trim()
    const scenarioId = args.scenarioId?.trim() || STANDARD_SCENARIO_ID
    const scenario = resolveScenario(defs, scenarioId)
    const fileName = `${slugify(safeName)}-${Date.now()}.sqlite`
    const db = openDatabase(join(this.config.savesDir, fileName))
    const state = createCampaign(db, defs, safeName, scenario)
    this.session.open(db, state, fileName)
    logSystem(`Created campaign "${safeName}" (${fileName}) scenario=${scenario.id}`)
    return this.getDashboard()
  }

  loadExistingCampaign(fileName: string): DashboardData {
    this.session.close()
    const path = join(this.config.savesDir, fileName)
    if (!existsSync(path)) throw new GameError('NOT_FOUND', `Save not found: ${fileName}`)
    const db = openDatabase(path)
    let state: GameState
    try {
      state = loadCampaign(db)
    } catch (err) {
      closeDatabase(db)
      throw new GameError('INTERNAL', errorMessage(err))
    }
    this.session.open(db, state, fileName, [...loadValidationWarnings])
    logSystem(`Loaded campaign "${state.meta.name}" day ${state.meta.tick} (${fileName})`)
    logPlayerAction(state, 'system', `Loaded save "${state.meta.name}" (day ${state.meta.tick}).`)
    return this.getDashboard()
  }

  saveCurrent(): true {
    const { state } = this.session.require()
    this.session.save()
    logSystem(`Saved campaign "${state.meta.name}" at day ${state.meta.tick}`)
    logPlayerAction(state, 'system', `Game saved (day ${state.meta.tick}).`)
    return true
  }

  hasActiveCampaign(): boolean {
    return this.session.hasCampaign
  }

  close(): void {
    this.session.close()
  }

  listSaves(): SaveSummary[] {
    if (!existsSync(this.config.savesDir)) return []
    const out: SaveSummary[] = []
    for (const file of readdirSync(this.config.savesDir)) {
      if (!file.endsWith('.sqlite')) continue
      try {
        const db = openDatabase(join(this.config.savesDir, file))
        const { meta } = loadMeta(db)
        out.push({
          id: file,
          name: meta.name,
          fileName: file,
          tick: meta.tick,
          scenarioId: meta.scenario?.id,
          scenarioName: meta.scenario?.name,
          scenarioDifficulty: meta.scenario?.difficulty
        })
        closeDatabase(db)
      } catch (err) {
        debugLog(`listSaves: skipping unreadable save "${file}"`, err)
      }
    }
    return out.sort((a, b) => a.name.localeCompare(b.name))
  }

  deleteSave(fileName: string): true {
    if (fileName === this.session.fileName) {
      throw new GameError(
        'CONFLICT',
        'Cannot delete the currently open campaign. Load another save first.'
      )
    }
    const path = join(this.config.savesDir, fileName)
    if (!existsSync(path)) throw new GameError('NOT_FOUND', `Save not found: ${fileName}`)
    rmSync(path)
    for (const suffix of ['-wal', '-shm']) {
      const side = `${path}${suffix}`
      if (existsSync(side)) rmSync(side)
    }
    return true
  }

  renameSave(fileName: string, newName: string): true {
    const name = newName.trim()
    if (!name) throw new GameError('VALIDATION', 'New name must not be empty.')

    if (fileName === this.session.fileName && this.session.hasCampaign) {
      this.session.renameInMemory(name)
      this.session.save()
      return true
    }

    const path = join(this.config.savesDir, fileName)
    if (!existsSync(path)) throw new GameError('NOT_FOUND', `Save not found: ${fileName}`)
    const db = openDatabase(path)
    try {
      db.prepare('UPDATE campaign_meta SET name = ?').run(name)
    } finally {
      closeDatabase(db)
    }
    return true
  }

  // ---- Read models ----------------------------------------------------------

  getDashboard(): DashboardData {
    const { state } = this.session.require()
    return { ...buildDashboard(state), ...this.session.getSaveStatus() }
  }

  getItems(): ItemDefinition[] {
    const { state } = this.session.require()
    return state.definitions.items
  }

  getPriceHistory(args: PriceHistoryArgs): PricePoint[] {
    const { state } = this.session.require()
    return buildPriceHistory(state, args)
  }

  getSystems(): SystemSummary[] {
    const { state } = this.session.require()
    return buildSystemSummaries(state)
  }

  getStarMap(): StarMapView {
    const { state } = this.session.require()
    return buildStarMapView(state)
  }

  getSystem(id: string): SystemDetail {
    const { state } = this.session.require()
    return buildSystemDetail(state, id)
  }

  getPlanet(id: string): PlanetDetail {
    const { state } = this.session.require()
    return buildPlanetDetail(state, id)
  }

  getMarket(systemId: string): MarketView {
    const { state } = this.session.require()
    return buildMarketView(state, systemId)
  }

  getInventory(): InventoryView[] {
    const { state } = this.session.require()
    return buildInventoryView(state)
  }

  getProduction(): ProductionView {
    const { state } = this.session.require()
    return buildProductionView(state)
  }

  getProductionPlan(args: ProductionPlanArgs): ProductionPlanView {
    const { state } = this.session.require()
    return buildProductionPlanView(state, args)
  }

  getLogistics(): LogisticsView {
    const { state } = this.session.require()
    return buildLogisticsView(state)
  }

  getEvents(): EventLogView[] {
    const { state } = this.session.require()
    return buildEventLogViews(state).reverse()
  }

  getActivityLog(limit = 200): GameLogEntry[] {
    const { state } = this.session.require()
    const cap = Math.max(1, Math.min(limit, 500))
    return [...state.activityLog].reverse().slice(0, cap)
  }

  getMods(): ModsView {
    const { mods, defs, errors } = this.modCatalog.load()
    const newCampaignCounts = definitionCountsFrom(defs)
    const frozenCounts = this.session.hasCampaign
      ? definitionCountsFrom(this.session.require().state.definitions)
      : newCampaignCounts
    const modInfos: ModInfo[] = mods.map((m) => ({
      id: m.manifest.id,
      name: m.manifest.name,
      version: m.manifest.version,
      author: m.manifest.author,
      description: m.manifest.description,
      enabled: m.enabled,
      source: m.manifest.id === VANILLA_MOD_ID ? 'builtin' : m.source
    }))
    return {
      mods: modInfos,
      enabledModIds: mods.filter((m) => m.enabled).map((m) => m.manifest.id),
      loadOrder: modLoadOrder(mods),
      conflicts: detectModConflicts(mods),
      hasActiveCampaign: this.session.hasCampaign,
      definitionCounts: frozenCounts,
      newCampaignDefinitionCounts: newCampaignCounts,
      validationErrors: errors
    }
  }

  reloadModData(): ModsView {
    this.modCatalog.invalidate()
    logSystem('Reloaded mod data from disk')
    return this.getMods()
  }

  setModEnabled(modId: string, enabled: boolean): ModsView {
    if (modId === VANILLA_MOD_ID) {
      throw new GameError('VALIDATION', 'The vanilla mod cannot be disabled.')
    }
    try {
      this.modCatalog.setModEnabled(modId, enabled)
    } catch (err) {
      throw new GameError('NOT_FOUND', errorMessage(err))
    }
    logSystem(`Mod "${modId}" ${enabled ? 'enabled' : 'disabled'}`)
    return this.getMods()
  }

  // ---- Mutations ------------------------------------------------------------
  // Player mutations autosave via session.persistAfterMutation().

  createMarketOrder(args: CreateMarketOrderArgs): true {
    const { state } = this.session.require()
    return cmdCreateMarketOrder(this.session, state, args)
  }

  cancelMarketOrder(orderId: string): true {
    const { state } = this.session.require()
    return cmdCancelMarketOrder(this.session, state, orderId)
  }

  startProductionJob(args: StartProductionJobArgs): true {
    const { state } = this.session.require()
    return cmdStartProductionJob(this.session, state, args)
  }

  cancelProductionJob(jobId: string): true {
    const { state } = this.session.require()
    return cmdCancelProductionJob(this.session, state, jobId)
  }

  buildBuilding(args: BuildBuildingArgs): true {
    const { state } = this.session.require()
    return cmdBuildBuilding(this.session, state, args)
  }

  createTransportJob(args: CreateTransportJobArgs): true {
    const { state } = this.session.require()
    return cmdCreateTransportJob(this.session, state, args)
  }

  cancelTransportJob(jobId: string): true {
    const { state } = this.session.require()
    return cmdCancelTransportJob(this.session, state, jobId)
  }

  purchaseShip(args: PurchaseShipArgs): true {
    const { state } = this.session.require()
    return cmdPurchaseShip(this.session, state, args)
  }

  runTick(): TickResult {
    const { state } = this.session.require()
    const result = runTick(state)
    this.applyTickViewState(state, result)
    this.session.save()
    logTickEntries(result.log)
    return result
  }

  runTicks(n: number): TickResult {
    const { state } = this.session.require()
    const result = runTicks(state, n)
    this.applyTickViewState(state, result)
    this.session.save()
    logTickEntries(result.log)
    return result
  }

  runTicksSmart(args: RunTicksSmartArgs): TickResult {
    const { state } = this.session.require()
    const result = runTicksSmart(state, args.mode, args.maxDays ?? 30)
    this.applyTickViewState(state, result)
    this.session.save()
    logTickEntries(result.log)
    return result
  }

  /** Update renderer read-model state after simulation ticks (kept out of runTick). */
  private applyTickViewState(state: GameState, result: TickResult): void {
    if (result.regionalTradeList?.length) {
      recordRegionalTradesForMap(state, result.tick, result.regionalTradeList)
    }
  }

  previewMarketTrade(args: PreviewMarketTradeArgs): MarketTradePreview {
    const { state } = this.session.require()
    return cmdPreviewMarketTrade(state, args)
  }

  executeMarketTrade(args: PreviewMarketTradeArgs): MarketTradePreview {
    const { state } = this.session.require()
    return cmdExecuteMarketTrade(this.session, state, args)
  }

  repeatProductionJob(args: RepeatProductionJobArgs): true {
    const { state } = this.session.require()
    return cmdRepeatProductionJob(this.session, state, args)
  }

  runProductionUntilExhausted(args: RunProductionUntilExhaustedArgs): { queued: number } {
    const { state } = this.session.require()
    return cmdRunProductionUntilExhausted(this.session, state, args)
  }

  acceptContract(contractId: string): true {
    const { state } = this.session.require()
    return cmdAcceptContract(this.session, state, contractId)
  }

  completeContract(contractId: string): true {
    const { state } = this.session.require()
    return cmdCompleteContract(this.session, state, contractId)
  }

  abandonContract(contractId: string): true {
    const { state } = this.session.require()
    return cmdAbandonContract(this.session, state, contractId)
  }

  getDebugState(): DebugStateView {
    const { state } = this.session.require()
    return { ...buildDebugStateView(state), loadWarnings: this.session.getLoadWarnings() }
  }
}

function definitionCountsFrom(defs: GameDefinitions): DefinitionCounts {
  return {
    items: defs.items.length,
    recipes: defs.recipes.length,
    buildings: defs.buildings.length,
    systems: defs.systems.length,
    planets: defs.planets.length,
    factions: defs.factions.length,
    events: defs.events.length,
    economicProfiles: defs.economicProfiles.length,
    ships: defs.ships.length,
    objectives: defs.objectives.length,
    contractTemplates: defs.contractTemplates.length,
    scenarios: defs.scenarios.length,
    npcCorporations: defs.npcCorporations.length
  }
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'campaign'
}
