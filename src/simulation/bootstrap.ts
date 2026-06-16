import { mergeCampaignStartConfig } from '../shared/campaignStartConfig.js'
import { DEFAULT_CORP_ID, DEFAULT_CORP_NAME } from '../shared/constants.js'
import { marketIdForSystem, newId } from '../shared/ids.js'
import { appendActivityLog, createLogEntry } from '../shared/gameLog.js'
import type { GameDefinitions, GameState, Market } from '../shared/types.js'
import { initLocalStockpiles } from './localEconomy.js'
import { seedNpcOrders } from './market.js'
import { syncNpcLiquidityToStockpiles } from './npcLiquidity.js'
import { initPlanetPopulations } from './planetPopulation.js'
import { ensureContractBoard, initCampaignProgression } from './progression.js'
import { seedNpcCorporations } from './seedNpcCorporations.js'

/**
 * Build the initial in-memory game state for a brand new campaign: starting
 * corporation, one market per system, starting inventory/buildings/ship at the
 * home system, and seeded NPC market liquidity.
 *
 * Pure — no database or Electron dependencies.
 */
export function buildInitialState(defs: GameDefinitions, campaignName: string): GameState {
  const start = defs.campaignStartConfig ?? mergeCampaignStartConfig(undefined)
  const homeSystemId =
    (start.homeSystemId && defs.systems.some((s) => s.id === start.homeSystemId)
      ? start.homeSystemId
      : defs.systems[0]?.id) ?? 'sys_helion'
  const minHab = start.homePlanetMinHabitability
  const homePlanet =
    defs.planets.find((p) => p.systemId === homeSystemId && p.habitability >= minHab) ??
    defs.planets.find((p) => p.systemId === homeSystemId)

  const markets: Market[] = defs.systems.map((s) => ({
    id: marketIdForSystem(s.id),
    systemId: s.id
  }))

  const playerCorp = {
    id: DEFAULT_CORP_ID,
    name: DEFAULT_CORP_NAME,
    credits: start.startingCredits,
    homeSystemId
  }

  const state: GameState = {
    meta: {
      id: newId('campaign'),
      name: campaignName,
      tick: 0,
      createdAt: Date.now(),
      ticking: false
    },
    definitions: defs,
    corporations: [playerCorp],
    playerCorporationId: DEFAULT_CORP_ID,
    inventories: [],
    markets,
    orders: [],
    priceHistory: [],
    localStockpiles: [],
    buildings: [],
    ships: [],
    transportJobs: [],
    productionJobs: [],
    eventsLog: [],
    progression: {
      objectives: [],
      totalSellProceeds: 0,
      firstInterSystemDelivery: false,
      producedItems: {},
      activeContracts: [],
      completedContractIds: [],
      factionReputation: {},
      eventLastFiredTick: {}
    },
    planetPopulations: [],
    activityLog: [],
    recentRegionalTrades: []
  }

  state.progression = initCampaignProgression(state)
  ensureContractBoard(state)

  const startingStock = Object.entries(start.startingStock) as Array<[string, number]>
  for (const [itemId, qty] of startingStock) {
    if (defs.items.some((i) => i.id === itemId)) {
      state.inventories.push({
        ownerId: playerCorp.id,
        systemId: homeSystemId,
        itemId,
        quantity: qty,
        reserved: 0
      })
    }
  }

  if (homePlanet) {
    for (const type of start.startingBuildingTypes) {
      if (defs.buildings.some((b) => b.id === type)) {
        state.buildings.push({
          id: newId('bld'),
          definitionId: type,
          planetId: homePlanet.id,
          ownerId: playerCorp.id
        })
      }
    }
  }

  const starterDef =
    defs.ships.find((s) => s.starter) ??
    defs.ships[0] ??
    ({
      id: 'legacy_hauler',
      name: 'Hauler I',
      cargoCapacity: 100,
      fuelUsePerDistance: 1,
      speed: 5,
      purchaseCost: 0
    } as const)
  state.ships.push({
    id: newId('ship'),
    name: starterDef.name,
    definitionId: starterDef.id,
    cargoCapacity: starterDef.cargoCapacity,
    fuelUsePerDistance: starterDef.fuelUsePerDistance,
    speed: starterDef.speed,
    currentSystemId: homeSystemId,
    ownerId: playerCorp.id
  })

  initLocalStockpiles(state)
  seedNpcCorporations(state)
  initPlanetPopulations(state)
  seedNpcOrders(state, 0)
  syncNpcLiquidityToStockpiles(state)
  appendActivityLog(state, [
    createLogEntry(0, 'system', `Campaign "${campaignName}" started with ${defs.systems.length} systems.`)
  ])
  return state
}
