import type {
  BuildingTypeId,
  CorporationId,
  FactionId,
  ItemId,
  MarketId,
  NpcAiProfile,
  PlanetId,
  PlanetModifiers,
  PlanetType,
  RecipeDefinition,
  RecipeIO,
  ShipDefinition,
  SystemId
} from './definitions.js'
import type { Explanation } from '../explanations/types.js'
import type {
  ItemPriceDiagnostics,
  JobStatus,
  EventLogEntry,
  LocalStockpileRow,
  MarketOrder,
  OrderSide,
  PriceHistoryRow,
  PriceMovementReason,
  ProductionJob,
  Ship,
  TransportJob,
  GameLogEntry,
  MarketChangeEntry
} from './state.js'

export interface ProductionPlanView {
  feasible: boolean
  targetItemId: ItemId
  targetQty: number
  estimatedDays: number
  requiredInputs: {
    itemId: ItemId
    itemName: string
    requiredQty: number
    availableQty: number
    missingQty: number
  }[]
  requiredBuildings: {
    buildingTypeId: BuildingTypeId
    buildingName: string
    available: number
    required: number
  }[]
  bottlenecks: string[]
  warnings: string[]
}

export interface ProductionPlanArgs {
  targetItemId: ItemId
  targetQty: number
}

export interface ProductionJobSummary {
  id: string
  recipeName: string
  buildingName: string
  progress: number
  duration: number
  status: JobStatus
}

export type ObjectiveStatus = 'locked' | 'active' | 'completed'

export interface ObjectiveView {
  id: string
  title: string
  description: string
  current: number
  target: number
  completed: boolean
  /** False while the prerequisite objective is incomplete. */
  isUnlocked: boolean
  /** Derived status for Dashboard sections (locked = Upcoming). */
  status: ObjectiveStatus
  /** UI/priority only: shown in Optional section, excluded from current-goal hint. */
  optional?: boolean
  dependsOnObjectiveId?: string | null
  /** Player-facing "why" for locked objectives (derived on demand). */
  explanation?: Explanation
}

export interface ContractView {
  id: string
  title: string
  description: string
  factionId: FactionId
  factionName: string
  tier: number
  creditReward: number
  effectiveCreditReward: number
  reputationReward: number
  expiresAtTick: number
  accepted: boolean
  progress: number
  target: number
  completable: boolean
}

export interface FactionReputationView {
  factionId: FactionId
  factionName: string
  reputation: number
  nextTierAt: number | null
  contractBonusPercent: number
}

export type SaveStatus = 'saved' | 'saving' | 'error'

export interface DashboardData {
  campaignName: string
  credits: number
  tick: number
  systemCount: number
  planetCount: number
  inventoryValueEstimate: number
  activeProductionJobs: number
  activeTransportJobs: number
  productionJobs: ProductionJobSummary[]
  objectives: ObjectiveView[]
  contracts: ContractView[]
  factionReputation: FactionReputationView[]
  actionSuggestions: string[]
  saveStatus: SaveStatus
  lastSavedTick: number
  saveError: string | null
}

export interface SystemSummary {
  id: SystemId
  name: string
  x: number
  y: number
  planetCount: number
  controllingFactionId?: FactionId | null
  distanceFromHome?: number
  isHome?: boolean
}

/** Galactic map DTO — exposed via `GameApi.getStarMap`; used by vanilla Star Map page and mod UIs. */
export interface StarMapFactionLegendEntry {
  factionId: FactionId
  factionName: string
  color: string
}

export type StarMapEconomyHeat = 'surplus' | 'stable' | 'shortage'

export interface StarMapSystemView extends SystemSummary {
  isHome: boolean
  controllingFactionId: FactionId | null
  controllingFactionName: string | null
  factionColor: string
  distanceFromHome: number
  inventoryValueEstimate: number
  buildingCount: number
  shipCount: number
  topShortageItemName: string | null
  topShortageSeverity: number | null
  economyHeat: StarMapEconomyHeat
  eventTicksAgo: number | null
  contractHighlight: string | null
}

export interface StarMapLaneView {
  systemAId: SystemId
  systemBId: SystemId
  x1: number
  y1: number
  x2: number
  y2: number
  distance: number
  opacity: number
  strokeWidth: number
}

export interface StarMapTransportArc {
  jobId: string
  originSystemId: SystemId
  originX: number
  originY: number
  destinationSystemId: SystemId
  destinationX: number
  destinationY: number
  progressFraction: number
  itemName: string
  quantity: number
}

export interface StarMapNpcConvoyArc {
  tick: number
  fromSystemId: SystemId
  toSystemId: SystemId
  fromX: number
  fromY: number
  toX: number
  toY: number
  itemName: string
  quantity: number
  ticksAgo: number
}

export interface StarMapView {
  homeSystemId: SystemId
  currentTick: number
  systems: StarMapSystemView[]
  lanes: StarMapLaneView[]
  transportArcs: StarMapTransportArc[]
  npcConvoys: StarMapNpcConvoyArc[]
  factions: StarMapFactionLegendEntry[]
}

export interface MarketOrderView extends MarketOrder {
  itemName: string
}

export interface MarketItemView {
  itemId: ItemId
  itemName: string
  lastPrice: number | null
  buyOrders: MarketOrderView[]
  sellOrders: MarketOrderView[]
  diagnostics: ItemPriceDiagnostics
  /** Player-facing "why" for latest price movement (derived on demand). */
  explanation?: Explanation
}

export interface InventoryView {
  systemId: SystemId
  systemName: string
  itemId: ItemId
  itemName: string
  quantity: number
  reserved: number
}

export interface ProductionView {
  buildings: Array<{
    id: string
    definitionId: BuildingTypeId
    definitionName: string
    planetId: PlanetId
    planetName: string
    availableRecipes: RecipeDefinition[]
    explanation?: Explanation
  }>
  jobs: Array<
    ProductionJob & { recipeName: string; buildingName: string; explanation?: Explanation }
  >
}

export interface PurchasableShipView extends ShipDefinition {
  affordable: boolean
}

export interface LogisticsView {
  ships: Ship[]
  jobs: Array<TransportJob & { itemName: string; explanation?: Explanation }>
  purchasableShips: PurchasableShipView[]
}

export interface EventLogView extends EventLogEntry {
  explanation?: Explanation
}

export interface ModInfo {
  id: string
  name: string
  version: string
  author: string
  description: string
  enabled: boolean
  source: 'builtin' | 'external'
}

export interface DefinitionCounts {
  items: number
  recipes: number
  buildings: number
  systems: number
  planets: number
  factions: number
  events: number
  economicProfiles: number
  ships: number
  objectives: number
  contractTemplates: number
  scenarios: number
  npcCorporations: number
}

export interface ModConflictWarning {
  kind: string
  id: string
  modIds: string[]
}

export interface ModsView {
  mods: ModInfo[]
  enabledModIds: string[]
  loadOrder: string[]
  conflicts: ModConflictWarning[]
  hasActiveCampaign: boolean
  definitionCounts: DefinitionCounts
  newCampaignDefinitionCounts: DefinitionCounts
  validationErrors: string[]
}

export interface SaveSummary {
  id: string
  name: string
  fileName: string
  tick: number
  scenarioId?: string
  scenarioName?: string
  scenarioDifficulty?: string
}

export interface PlanetSummary {
  id: PlanetId
  name: string
  planetType: PlanetType
  habitability: number
  mineralRichness: number
  fertility: number
  energyPotential: number
  population: number
  buildingCount: number
}

export interface RouteView {
  toSystemId: SystemId
  toName: string
  distance: number
}

export interface SystemDetail {
  id: SystemId
  name: string
  controllingFactionId: FactionId | null
  controllingFactionName: string | null
  factionPriceBias: number | null
  planets: PlanetSummary[]
  marketItems: MarketItemView[]
  routes: RouteView[]
  foreignBuildings: SystemBuildingView[]
}

export interface PlanetBuildingView {
  id: string
  definitionId: BuildingTypeId
  definitionName: string
  ownerId: CorporationId
  ownerName: string
  isPlayerOwned: boolean
}

export interface SystemBuildingView {
  id: string
  planetId: PlanetId
  planetName: string
  definitionName: string
  ownerId: CorporationId
  ownerName: string
}

export interface DebugNpcCorporationView {
  id: CorporationId
  name: string
  credits: number
  homeSystemId: SystemId
  homeSystemName: string
  aiProfile: NpcAiProfile | null
  inventory: Array<{
    systemId: SystemId
    systemName: string
    itemId: ItemId
    itemName: string
    quantity: number
  }>
  buildings: Array<{
    id: string
    planetId: PlanetId
    planetName: string
    definitionName: string
  }>
  ships: Array<{
    id: string
    name: string
    currentSystemId: SystemId
    systemName: string
  }>
  orders: Array<{
    marketId: MarketId
    itemId: ItemId
    side: OrderSide
    price: number
    remainingQuantity: number
  }>
  productionJobs: Array<{
    buildingId: string
    recipeId: string
    status: string
    quantity: number
    progress: number
    duration: number
  }>
  transportJobs: Array<{
    id: string
    itemId: ItemId
    quantity: number
    status: string
    originSystemName: string
    destinationSystemName: string
  }>
}

export interface BuildableView {
  definitionId: BuildingTypeId
  name: string
  buildCost: number
  buildMaterials: RecipeIO[]
  affordable: boolean
}

export interface PlanetDetail {
  id: PlanetId
  name: string
  systemId: SystemId
  systemName: string
  planetType: PlanetType
  habitability: number
  mineralRichness: number
  fertility: number
  energyPotential: number
  population: number
  modifiers: PlanetModifiers
  buildings: PlanetBuildingView[]
  buildable: BuildableView[]
}

export interface MarketView {
  systemId: SystemId
  systemName: string
  items: MarketItemView[]
}

export interface DebugStateView {
  npcCorporations: DebugNpcCorporationView[]
  localStockpiles: LocalStockpileRow[]
  npcOrders: Array<{
    marketId: MarketId
    itemId: ItemId
    side: OrderSide
    price: number
    remainingQuantity: number
  }>
  recentPrices: PriceHistoryRow[]
  loadWarnings?: string[]
}

export interface TickResult {
  tick: number
  trades: number
  completedProductionJobs: number
  completedTransportJobs: number
  newEvents: number
  regionalTrades: number
  /** NPC convoy detail for the service layer (star map overlay). */
  regionalTradeList?: RegionalTradeDetail[]
  log: GameLogEntry[]
  marketChanges: MarketChangeEntry[]
  /** Capped daily "why today" digest (ephemeral, not persisted). */
  explanations?: Explanation[]
}

/** One NPC regional convoy executed during a tick (for map overlay). */
export interface RegionalTradeDetail {
  itemId: string
  fromMarketId: string
  toMarketId: string
  fromSystemId: string
  toSystemId: string
  quantity: number
}

export interface PricePoint {
  tick: number
  price: number
  reason?: PriceMovementReason
}

export type MarketTradeAction = 'sell_max' | 'buy_amount' | 'sell_amount'

export interface MarketTradeFill {
  orderId: string
  quantity: number
  price: number
}

export interface MarketTradePreview {
  action: MarketTradeAction
  systemId: SystemId
  systemName: string
  itemId: ItemId
  itemName: string
  quantity: number
  estimatedRevenue?: number
  estimatedCost?: number
  averagePrice: number
  fills: MarketTradeFill[]
  fillCount: number
}
