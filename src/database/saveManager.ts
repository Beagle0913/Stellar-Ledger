import type { GameDefinitions, GameState } from '../shared/types.js'
import { buildInitialState } from '../simulation/bootstrap.js'
import { PRICE_HISTORY_RETENTION_TICKS } from '../simulation/tick.js'

export { buildInitialState } from '../simulation/bootstrap.js'
import type { DB } from './db.js'
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
  loadCorporation,
  loadDefinitions,
  loadEventsLog,
  loadMeta,
  loadActivityLog,
  loadPlanetPopulations,
  loadShips,
  saveBuildings,
  saveCorporation,
  saveEventsLog,
  saveMeta,
  saveMetaProgress,
  saveShips,
  writeDefinitions
} from './repositories/worldRepo.js'
import { loadProgression, saveProgression } from './repositories/progressionRepo.js'
import { clearLoadValidationWarnings } from './saveValidation.js'

// Orchestrates campaign create / load / save. Definitions are frozen into the
// save at creation; subsequent saves only rewrite mutable state.

/** Create a new campaign: freeze definitions + persist initial state. */
export function createCampaign(db: DB, defs: GameDefinitions, campaignName: string): GameState {
  const state = buildInitialState(defs, campaignName)
  const tx = db.transaction(() => {
    writeDefinitions(db, defs)
    saveMeta(db, state.meta, defs)
    saveCorporation(db, state.corporation)
    persistMutable(db, state)
  })
  tx()
  return state
}

/** Load a full GameState from an existing save DB. */
export function loadCampaign(db: DB): GameState {
  clearLoadValidationWarnings()
  const { meta, factions, events, economicProfiles, ships, objectives, contractTemplates, economyConfig, campaignStartConfig } =
    loadMeta(db)
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
  const progression = loadProgression(db, definitions.objectives)
  const planetPopulations = loadPlanetPopulations(db, definitions.planets)
  const priceSinceTick = Math.max(0, meta.tick - PRICE_HISTORY_RETENTION_TICKS)
  return {
    meta,
    definitions,
    corporation: loadCorporation(db),
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
    saveCorporation(db, state.corporation)
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
