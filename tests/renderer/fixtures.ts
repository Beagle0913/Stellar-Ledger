import { GAME_VERSION } from '../../src/shared/constants.js'
import type {
  DashboardData,
  InventoryView,
  LogisticsView,
  MarketView,
  ModsView,
  PlanetDetail,
  ProductionView,
  StarMapView,
  SystemDetail,
  SystemSummary
} from '../../src/shared/types.js'

/** Stable mock ids for renderer smoke tests (not tied to procedural galaxy data). */
export const MOCK_HOME_SYSTEM_ID = 'sys_mock_home'
export const MOCK_HOME_SYSTEM_NAME = 'Home System'
export const MOCK_HOME_PLANET_ID = 'planet_mock_home'
export const MOCK_HOME_PLANET_NAME = 'Home Prime'
export const MOCK_OTHER_SYSTEM_ID = 'sys_mock_other'
export const MOCK_OTHER_SYSTEM_NAME = 'Outpost'

export const mockSystemSummary: SystemSummary = {
  id: MOCK_HOME_SYSTEM_ID,
  name: MOCK_HOME_SYSTEM_NAME,
  x: 0,
  y: 0,
  planetCount: 1
}

export const mockSystemDetail: SystemDetail = {
  id: MOCK_HOME_SYSTEM_ID,
  name: MOCK_HOME_SYSTEM_NAME,
  controllingFactionId: 'faction_consortium',
  controllingFactionName: 'Helion Consortium',
  factionPriceBias: 1,
  planets: [
    {
      id: MOCK_HOME_PLANET_ID,
      name: MOCK_HOME_PLANET_NAME,
      planetType: 'terran',
      habitability: 0.8,
      mineralRichness: 0.6,
      fertility: 0.7,
      energyPotential: 0.5,
      population: 1_000_000,
      buildingCount: 3
    }
  ],
  marketItems: [],
  routes: [{ toSystemId: MOCK_OTHER_SYSTEM_ID, toName: MOCK_OTHER_SYSTEM_NAME, distance: 12 }],
  foreignBuildings: []
}

export const mockPlanetDetail: PlanetDetail = {
  id: MOCK_HOME_PLANET_ID,
  name: MOCK_HOME_PLANET_NAME,
  systemId: MOCK_HOME_SYSTEM_ID,
  systemName: MOCK_HOME_SYSTEM_NAME,
  planetType: 'terran',
  habitability: 0.8,
  mineralRichness: 0.6,
  fertility: 0.7,
  energyPotential: 0.5,
  population: 1_000_000,
  modifiers: {},
  buildings: [],
  buildable: []
}

export const mockDashboard: DashboardData = {
  campaignName: 'Smoke Test Campaign',
  credits: 38_000,
  tick: 5,
  systemCount: 2,
  planetCount: 3,
  inventoryValueEstimate: 12_000,
  activeProductionJobs: 0,
  activeTransportJobs: 0,
  productionJobs: [],
  objectives: [],
  contracts: [],
  factionReputation: [],
  actionSuggestions: [],
  saveStatus: 'saved',
  lastSavedTick: 5,
  saveError: null
}

export const mockMarketView: MarketView = {
  systemId: MOCK_HOME_SYSTEM_ID,
  systemName: MOCK_HOME_SYSTEM_NAME,
  items: []
}

export const mockInventory: InventoryView[] = [
  {
    systemId: MOCK_HOME_SYSTEM_ID,
    systemName: MOCK_HOME_SYSTEM_NAME,
    itemId: 'ore',
    itemName: 'Ore',
    quantity: 100,
    reserved: 0
  }
]

export const mockProduction: ProductionView = {
  buildings: [],
  jobs: []
}

export const mockLogistics: LogisticsView = {
  ships: [
    {
      id: 'ship_1',
      name: 'Hauler I',
      cargoCapacity: 100,
      fuelUsePerDistance: 1,
      speed: 5,
      currentSystemId: MOCK_HOME_SYSTEM_ID,
      ownerId: 'player'
    }
  ],
  jobs: [],
  purchasableShips: []
}

export const mockStarMap: StarMapView = {
  homeSystemId: MOCK_HOME_SYSTEM_ID,
  currentTick: 5,
  systems: [
    {
      ...mockSystemSummary,
      isHome: true,
      controllingFactionId: 'faction_consortium',
      controllingFactionName: 'Helion Consortium',
      factionColor: '#4a90d9',
      distanceFromHome: 0,
      inventoryValueEstimate: 12_000,
      buildingCount: 3,
      shipCount: 1,
      topShortageItemName: null,
      topShortageSeverity: null,
      economyHeat: 'stable',
      eventTicksAgo: null,
      contractHighlight: null
    },
    {
      id: MOCK_OTHER_SYSTEM_ID,
      name: MOCK_OTHER_SYSTEM_NAME,
      x: 200,
      y: 150,
      planetCount: 2,
      isHome: false,
      controllingFactionId: 'faction_frontier',
      controllingFactionName: 'Frontier League',
      factionColor: '#f85149',
      distanceFromHome: 18,
      inventoryValueEstimate: 0,
      buildingCount: 0,
      shipCount: 0,
      topShortageItemName: 'Food',
      topShortageSeverity: 0.2,
      economyHeat: 'shortage',
      eventTicksAgo: null,
      contractHighlight: 'Deliver ore to Outpost'
    }
  ],
  lanes: [
    {
      systemAId: MOCK_HOME_SYSTEM_ID,
      systemBId: MOCK_OTHER_SYSTEM_ID,
      x1: 0,
      y1: 0,
      x2: 200,
      y2: 150,
      distance: 18,
      opacity: 0.7,
      strokeWidth: 1.5
    }
  ],
  transportArcs: [
    {
      jobId: 'job_1',
      originSystemId: MOCK_HOME_SYSTEM_ID,
      originX: 0,
      originY: 0,
      destinationSystemId: MOCK_OTHER_SYSTEM_ID,
      destinationX: 200,
      destinationY: 150,
      progressFraction: 0.5,
      itemName: 'Ore',
      quantity: 10
    }
  ],
  npcConvoys: [],
  factions: [
    {
      factionId: 'faction_consortium',
      factionName: 'Helion Consortium',
      color: '#4a90d9'
    },
    {
      factionId: 'faction_frontier',
      factionName: 'Frontier League',
      color: '#f85149'
    }
  ]
}

export const mockModsView: ModsView = {
  mods: [
    {
      id: 'vanilla',
      name: 'Vanilla',
      version: GAME_VERSION,
      author: 'Prototype',
      description: 'Base game',
      enabled: true,
      source: 'builtin'
    }
  ],
  enabledModIds: ['vanilla'],
  loadOrder: ['vanilla'],
  conflicts: [],
  hasActiveCampaign: true,
  definitionCounts: {
    items: 10,
    recipes: 8,
    buildings: 5,
    systems: 2,
    planets: 3,
    factions: 2,
    events: 1,
    economicProfiles: 2,
    ships: 2,
    objectives: 5,
    contractTemplates: 4,
    scenarios: 4,
    npcCorporations: 2
  },
  newCampaignDefinitionCounts: {
    items: 10,
    recipes: 8,
    buildings: 5,
    systems: 2,
    planets: 3,
    factions: 2,
    events: 1,
    economicProfiles: 2,
    ships: 2,
    objectives: 5,
    contractTemplates: 4,
    scenarios: 4,
    npcCorporations: 2
  },
  validationErrors: []
}
