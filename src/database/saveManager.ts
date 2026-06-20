import { DEFAULT_CORP_ID } from '../shared/constants.js'
import type { DB } from './db.js'
import type { GameDefinitions, GameState, ScenarioDefinition } from '../shared/types.js'
import {
  applyScenarioToDefinitions,
  scenarioSnapshotFrom
} from '../shared/scenarios.js'
import { buildInitialState } from '../simulation/bootstrap.js'
import { PRICE_HISTORY_RETENTION_TICKS } from '../simulation/tick.js'

export { buildInitialState } from '../simulation/bootstrap.js'
import {
  loadLocalStockpiles,
  saveLocalStockpiles
} from './repositories/localStockpileRepo.js'
import {
  loadInventories,
  saveInventories
} from './repositories/inventoryRepo.js'
import {
  loadMarkets,
  loadOrders,
  loadPriceHistory,
  saveMarkets,
  saveOrders,
  savePriceHistory
} from './repositories/marketRepo.js'
import {
  loadProductionJobs,
  loadTransportJobs,
  saveProductionJobs,
  saveTransportJobs
} from './repositories/productionRepo.js'
import {
  loadBuildings,
  loadCorporations,
  loadDefinitions,
  loadEventsLog,
  loadMeta,
  loadActivityLog,
  loadPlanetPopulations,
  loadShips,
  saveBuildings,
  saveCorporations,
  saveEventsLog,
  saveMeta,
  saveMetaProgress,
  saveShips,
  writeDefinitions
} from './repositories/worldRepo.js'
import { loadProgression, saveProgression } from './repositories/progressionRepo.js'
import { assertSaveGalaxyCompatible } from '../shared/galaxyMeta.js'
import { clearLoadValidationWarnings } from './saveValidation.js'

/** Create a new campaign: freeze definitions + persist initial state. */
export function createCampaign(
  db: DB,
  defs: GameDefinitions,
  campaignName: string,
  scenario: ScenarioDefinition
): GameState {
  const applied = applyScenarioToDefinitions(defs, scenario)
  const state = buildInitialState(applied, campaignName)
  state.meta.scenario = scenarioSnapshotFrom(scenario)
  const tx = db.transaction(() => {
    writeDefinitions(db, applied)
    saveMeta(db, state.meta, applied, state.playerCorporationId)
    saveCorporations(db, state.corporations)
    persistMutable(db, state)
  })
  tx()
  return state
}

/** Load a full GameState from an existing save DB. */
export function loadCampaign(db: DB): GameState {
  clearLoadValidationWarnings()
  const {
    meta,
    playerCorporationId: storedPlayerCorpId,
    factions,
    events,
    economicProfiles,
    ships,
    objectives,
    contractTemplates,
    economyConfig,
    campaignStartConfig
  } = loadMeta(db)
  const definitions = loadDefinitions(
    db,
    factions,
    events,
    economicProfiles,
    ships,
    objectives,
    contractTemplates,
    economyConfig,
    campaignStartConfig
  )
  assertSaveGalaxyCompatible(definitions)
  const progression = loadProgression(db, definitions.objectives)
  const planetPopulations = loadPlanetPopulations(db, definitions.planets)
  const corporations = loadCorporations(db)
  const playerCorporationId = storedPlayerCorpId ?? corporations[0]?.id ?? DEFAULT_CORP_ID
  const priceSinceTick = Math.max(0, meta.tick - PRICE_HISTORY_RETENTION_TICKS)
  return {
    meta,
    definitions,
    corporations,
    playerCorporationId,
    inventories: loadInventories(db),
    markets: loadMarkets(db),
    orders: loadOrders(db),
    priceHistory: loadPriceHistory(db, priceSinceTick > 0 ? priceSinceTick : undefined),
    localStockpiles: loadLocalStockpiles(db),
    buildings: loadBuildings(db),
    ships: loadShips(db),
    transportJobs: loadTransportJobs(db),
    productionJobs: loadProductionJobs(db),
    eventsLog: loadEventsLog(db),
    progression,
    planetPopulations,
    activityLog: loadActivityLog(db),
    recentRegionalTrades: []
  }
}

/** Persist all mutable state (definitions are immutable and written once). */
export function saveState(db: DB, state: GameState): void {
  const tx = db.transaction(() => {
    saveMetaProgress(db, state.meta, state.planetPopulations, state.activityLog)
    saveCorporations(db, state.corporations)
    persistMutable(db, state)
  })
  tx()
}

function persistMutable(db: DB, state: GameState): void {
  saveInventories(db, state.inventories)
  saveMarkets(db, state.markets)
  saveOrders(db, state.orders)
  savePriceHistory(db, state.priceHistory)
  saveLocalStockpiles(db, state.localStockpiles)
  saveBuildings(db, state.buildings)
  saveShips(db, state.ships)
  saveTransportJobs(db, state.transportJobs)
  saveProductionJobs(db, state.productionJobs)
  saveEventsLog(db, state.eventsLog)
  saveProgression(db, state.progression)
}
