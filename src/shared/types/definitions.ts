// Mod-defined static content (definitions). Immutable at runtime; frozen into saves.

export type ItemId = string
export type RecipeId = string
export type BuildingTypeId = string
export type SystemId = string
export type PlanetId = string
export type FactionId = string
export type EventId = string
export type MarketId = string
export type CorporationId = string

/** Sentinel owner id used for NPC / market-maker orders. */
export const NPC_OWNER = 'npc' as const

export type ItemCategory =
  | 'raw'
  | 'refined'
  | 'component'
  | 'good'
  | 'energy'
  | 'special'

export interface ItemDefinition {
  id: ItemId
  name: string
  category: ItemCategory
  baseValue: number
  volume: number
}

export interface RecipeIO {
  itemId: ItemId
  quantity: number
}

export interface RecipeDefinition {
  id: RecipeId
  name: string
  buildingType: BuildingTypeId
  inputs: RecipeIO[]
  outputs: RecipeIO[]
  duration: number
  extraction?: boolean
  yieldStat?: PlanetYieldStat
}

export type PlanetYieldStat =
  | 'mineralRichness'
  | 'fertility'
  | 'energyPotential'
  | 'habitability'

export interface BuildingDefinition {
  id: BuildingTypeId
  name: string
  buildCost: number
  buildMaterials: RecipeIO[]
}

export interface PlanetModifiers {
  [key: string]: number
}

export type PlanetType =
  | 'rocky'
  | 'oceanic'
  | 'gas_giant'
  | 'barren'
  | 'terran'
  | 'volcanic'
  | 'ice'

export interface PlanetDefinition {
  id: PlanetId
  name: string
  systemId: SystemId
  planetType: PlanetType
  habitability: number
  mineralRichness: number
  fertility: number
  energyPotential: number
  population: number
  modifiers: PlanetModifiers
  economicProfileId?: string
}

export interface EconomicProfileItemRule {
  itemId: ItemId
  consumedPerDay: number
  perCapitaConsumptionPerDay?: number
  producedPerDay: number
  targetStockpile: number
  minPriceMultiplier: number
  maxPriceMultiplier: number
  shortagePressureMultiplier: number
  surplusPressureMultiplier: number
}

export interface EconomicProfileDefinition {
  id: string
  name: string
  items: EconomicProfileItemRule[]
}

export interface SystemDefinition {
  id: SystemId
  name: string
  x: number
  y: number
  economicProfileId?: string
  controllingFactionId?: FactionId
}

export interface FactionDefinition {
  id: FactionId
  name: string
  description: string
  priceBias?: number
}

export interface ShipDefinition {
  id: string
  name: string
  cargoCapacity: number
  fuelUsePerDistance: number
  speed: number
  purchaseCost: number
  starter?: boolean
}

export type ObjectiveType =
  | 'produce_item'
  | 'sell_proceeds'
  | 'own_ships'
  | 'inter_system_delivery'
  | 'net_worth'
  | 'complete_contracts'

export interface ObjectiveDefinition {
  id: string
  title: string
  description: string
  type: ObjectiveType
  target: number
  itemId?: ItemId
  /** Single prerequisite objective id; this objective stays locked until it completes. */
  dependsOnObjectiveId?: string
  /** UI/priority only: shown in the Optional section and excluded from the current-goal hint. */
  optional?: boolean
}

export type ContractTemplateType =
  | 'deliver_item'
  | 'produce_item'
  | 'sell_in_faction'
  | 'own_asset'
  | 'reach_net_worth'

export interface ContractTemplateTier {
  tier: number
  minReputation: number
  creditReward: number
  reputationReward: number
  expiresInDays: number
  minCampaignTick?: number
  itemId?: ItemId
  quantityMin?: number
  quantityMax?: number
  shipDefinitionId?: string
  netWorthMin?: number
  netWorthMax?: number
}

export interface ContractTemplateDefinition {
  id: string
  type: ContractTemplateType
  title: string
  description: string
  factionId: FactionId
  /** Template-level gate: not offered on the board until state.meta.tick >= this. */
  minCampaignTick?: number
  tiers: ContractTemplateTier[]
}

export type EventTrigger =
  | { type: 'tickInterval'; everyTicks: number }
  | { type: 'lowStock'; itemId: ItemId; threshold: number }
  | { type: 'stockpileShortage'; itemId: ItemId; threshold: number }

export type EventEffect =
  | { type: 'priceShock'; itemId: ItemId; multiplier: number }
  | { type: 'message' }
  | { type: 'stockpileShock'; itemId: ItemId; delta: number }
  | { type: 'creditBonus'; amount: number }

export interface EventDefinition {
  id: EventId
  name: string
  description: string
  trigger: EventTrigger
  effect: EventEffect
  /** Not evaluated until state.meta.tick >= this (default 0). */
  minCampaignTick?: number
  /** Not evaluated until this objective is completed. */
  requiresCompletedObjectiveId?: string
  /** Minimum ticks between fires; uses progression.eventLastFiredTick. */
  cooldownTicks?: number
}

export interface EconomyConfig {
  npcLiquidityMinFraction: number
  npcLiquidityMaxFraction: number
  regionalTradeMinSpreadPercent: number
  regionalTradeMaxUnitsPerDay: number
  regionalTradeMinSurplusFraction: number
  regionalTradeMinShortageFraction: number
  populationGrowthRatePerDay: number
  populationDeclineFoodRatio: number
  populationFoodItemId: ItemId
  /** Item consumed as ship fuel during transport jobs. */
  fuelItemId: ItemId
}

/**
 * New-campaign bootstrap values. Loaded from optional `campaign_start.json`
 * per mod; later mods override individual fields (like economy_config).
 */
export interface CampaignStartConfig {
  startingCredits: number
  startingStock: Record<ItemId, number>
  startingBuildingTypes: BuildingTypeId[]
  /** When unset, the first merged system is used. */
  homeSystemId?: SystemId
  /** Prefer a home planet at or above this habitability. */
  homePlanetMinHabitability: number
}

export type ScenarioDifficulty = 'easy' | 'normal' | 'hard' | 'custom'

/** Named new-campaign preset (loaded from mod scenarios.json). */
export interface ScenarioDefinition {
  id: string
  name: string
  description: string
  difficulty: ScenarioDifficulty
  campaignStart: Partial<CampaignStartConfig>
  economyConfigOverrides?: Partial<EconomyConfig>
  startingObjectiveIds?: string[]
}

export interface GameDefinitions {
  items: ItemDefinition[]
  recipes: RecipeDefinition[]
  buildings: BuildingDefinition[]
  systems: SystemDefinition[]
  planets: PlanetDefinition[]
  factions: FactionDefinition[]
  events: EventDefinition[]
  economicProfiles: EconomicProfileDefinition[]
  ships: ShipDefinition[]
  objectives: ObjectiveDefinition[]
  contractTemplates: ContractTemplateDefinition[]
  economyConfig: EconomyConfig
  campaignStartConfig: CampaignStartConfig
  scenarios: ScenarioDefinition[]
}
