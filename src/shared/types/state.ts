import type {
  BuildingTypeId,
  ContractTemplateType,
  CorporationId,
  EventId,
  FactionId,
  GameDefinitions,
  ItemId,
  MarketId,
  PlanetId,
  RecipeId,
  SystemId
} from './definitions.js'

export { NPC_OWNER } from './definitions.js'

export interface Corporation {
  id: CorporationId
  name: string
  credits: number
  homeSystemId: SystemId
}

export interface InventoryRow {
  ownerId: CorporationId
  systemId: SystemId
  itemId: ItemId
  quantity: number
  reserved: number
}

export interface Market {
  id: MarketId
  systemId: SystemId
}

export type OrderSide = 'buy' | 'sell'

export interface MarketOrder {
  id: string
  marketId: MarketId
  itemId: ItemId
  side: OrderSide
  quantity: number
  remainingQuantity: number
  price: number
  ownerId: CorporationId | 'npc'
  createdAt: number
}

export type PriceMovementReason =
  | 'shortage'
  | 'surplus'
  | 'stable'
  | 'npc_demand'
  | 'npc_supply'
  | 'trade'

export type PriceTrend = 'rising' | 'falling' | 'stable' | 'unknown'

export interface ItemPriceDiagnostics {
  currentPrice: number | null
  previousPrice: number | null
  priceChange: number | null
  priceChangePercent: number | null
  trend: PriceTrend
  latestReason: PriceMovementReason | null
  latestReasonLabel: string | null
  npcStockpile: number | null
}

export interface MarketChangeEntry {
  systemId: SystemId
  systemName: string
  itemId: ItemId
  itemName: string
  price: number
  previousPrice: number | null
  priceChange: number | null
  priceChangePercent: number | null
  reason: PriceMovementReason
  reasonLabel: string
  trend: PriceTrend
}

export interface PriceHistoryRow {
  marketId: MarketId
  itemId: ItemId
  tick: number
  price: number
  reason?: PriceMovementReason
}

export interface LocalStockpileRow {
  marketId: MarketId
  itemId: ItemId
  quantity: number
}

export interface BuildingInstance {
  id: string
  definitionId: BuildingTypeId
  planetId: PlanetId
  ownerId: CorporationId
}

export type JobStatus = 'queued' | 'running' | 'completed' | 'cancelled'

export interface ProductionJob {
  id: string
  buildingId: string
  recipeId: RecipeId
  quantity: number
  progress: number
  duration: number
  status: JobStatus
}

export interface Ship {
  id: string
  name: string
  /** Ship definition this instance was built from. Optional for legacy saves
   * created before the field existed (falls back to stat-matching). */
  definitionId?: string
  cargoCapacity: number
  fuelUsePerDistance: number
  speed: number
  currentSystemId: SystemId
  ownerId: CorporationId
}

export interface TransportJob {
  id: string
  shipId: string
  originSystemId: SystemId
  destinationSystemId: SystemId
  itemId: ItemId
  quantity: number
  progress: number
  distance: number
  fuelCost: number
  status: JobStatus
  ownerId: CorporationId
}

export interface EventLogEntry {
  id: string
  tick: number
  eventId: EventId
  message: string
}

export interface ObjectiveProgressEntry {
  objectiveId: string
  current: number
  target: number
  completed: boolean
}

export interface ActiveContractParams {
  itemId?: ItemId
  quantity?: number
  systemId?: SystemId
  factionId?: FactionId
  shipDefinitionId?: string
  netWorthTarget?: number
  target?: number
  baselineProduced?: number
}

export interface ActiveContract {
  id: string
  templateId: string
  type: ContractTemplateType
  title: string
  description: string
  factionId: FactionId
  tier: number
  creditReward: number
  reputationReward: number
  expiresAtTick: number
  accepted: boolean
  progress: number
  target: number
  params: ActiveContractParams
}

export interface CampaignProgression {
  objectives: ObjectiveProgressEntry[]
  totalSellProceeds: number
  firstInterSystemDelivery: boolean
  producedItems: Record<ItemId, number>
  activeContracts: ActiveContract[]
  completedContractIds: string[]
  factionReputation: Record<FactionId, number>
  /** Last tick each event fired; used for cooldownTicks gating. */
  eventLastFiredTick?: Record<EventId, number>
}

export interface CampaignMeta {
  id: string
  name: string
  tick: number
  createdAt: number
  ticking: boolean
}

export interface PlanetPopulationRow {
  planetId: PlanetId
  population: number
}

export type GameLogCategory =
  | 'system'
  | 'tick'
  | 'production'
  | 'transport'
  | 'market'
  | 'trade'
  | 'economy'
  | 'regional'
  | 'population'
  | 'event'
  | 'player'
  | 'contract'
  | 'mod'

export interface GameLogEntry {
  id: string
  tick: number
  category: GameLogCategory
  message: string
  at: number
}

/** Ephemeral NPC convoy record for star map overlay (not persisted). */
export interface StarMapRegionalTradeRow {
  tick: number
  fromSystemId: SystemId
  toSystemId: SystemId
  itemId: ItemId
  itemName: string
  quantity: number
}

export interface GameState {
  meta: CampaignMeta
  definitions: GameDefinitions
  corporation: Corporation
  inventories: InventoryRow[]
  markets: Market[]
  orders: MarketOrder[]
  priceHistory: PriceHistoryRow[]
  localStockpiles: LocalStockpileRow[]
  buildings: BuildingInstance[]
  productionJobs: ProductionJob[]
  ships: Ship[]
  transportJobs: TransportJob[]
  eventsLog: EventLogEntry[]
  progression: CampaignProgression
  planetPopulations: PlanetPopulationRow[]
  activityLog: GameLogEntry[]
  recentRegionalTrades: StarMapRegionalTradeRow[]
}
