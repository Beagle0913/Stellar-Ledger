import { z } from 'zod'

// Zod schemas validate ALL mod JSON before it ever reaches the game. The schemas
// mirror the domain types in shared/types.ts. Cross-file reference checks (item
// ids referenced by recipes, etc.) happen later in validateMods/mergeMods.

export const idSchema = z.string().min(1).regex(/^[a-z0-9_]+$/, {
  message: 'ids must be lowercase letters, digits, or underscores'
})

export const recipeIoSchema = z.object({
  itemId: idSchema,
  quantity: z.number().positive()
})

/** Planet stat multipliers stored as JSON on frozen planet rows. */
export const planetModifiersSchema = z.record(z.string(), z.number())

/** Building construction inputs stored as JSON on frozen building definition rows. */
export const buildMaterialsFileSchema = z.array(recipeIoSchema)

export const itemSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  category: z.enum(['raw', 'refined', 'component', 'good', 'energy', 'special']),
  baseValue: z.number().nonnegative(),
  volume: z.number().positive()
})

export const recipeSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  buildingType: idSchema,
  inputs: z.array(recipeIoSchema),
  outputs: z.array(recipeIoSchema).min(1),
  duration: z.number().int().positive(),
  extraction: z.boolean().optional(),
  yieldStat: z
    .enum(['mineralRichness', 'fertility', 'energyPotential', 'habitability'])
    .optional()
})

export const buildingSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  buildCost: z.number().nonnegative(),
  buildMaterials: buildMaterialsFileSchema
})

export const planetSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  systemId: idSchema,
  planetType: z.enum([
    'rocky',
    'oceanic',
    'gas_giant',
    'barren',
    'terran',
    'volcanic',
    'ice'
  ]),
  habitability: z.number().min(0).max(1),
  mineralRichness: z.number().min(0).max(2),
  fertility: z.number().min(0).max(2),
  energyPotential: z.number().min(0).max(2),
  population: z.number().int().nonnegative(),
  modifiers: planetModifiersSchema.default({}),
  economicProfileId: idSchema.optional()
})

export const economicProfileItemRuleSchema = z
  .object({
    itemId: idSchema,
    consumedPerDay: z.number().nonnegative().default(0),
    perCapitaConsumptionPerDay: z.number().nonnegative().optional(),
    producedPerDay: z.number().nonnegative().default(0),
    targetStockpile: z.number().nonnegative(),
    minPriceMultiplier: z.number().positive().default(0.5),
    maxPriceMultiplier: z.number().positive().default(2.0),
    shortagePressureMultiplier: z.number().positive().default(1.0),
    surplusPressureMultiplier: z.number().positive().default(1.0)
  })
  .refine((r) => r.maxPriceMultiplier >= r.minPriceMultiplier, {
    message: 'maxPriceMultiplier must be >= minPriceMultiplier',
    path: ['maxPriceMultiplier']
  })

export const economicProfileSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  items: z.array(economicProfileItemRuleSchema).min(1)
})

export const systemSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  x: z.number(),
  y: z.number(),
  economicProfileId: idSchema.optional(),
  controllingFactionId: idSchema.optional()
})

export const factionSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  description: z.string().default(''),
  priceBias: z.number().positive().optional()
})

export const shipSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  cargoCapacity: z.number().positive(),
  fuelUsePerDistance: z.number().nonnegative(),
  speed: z.number().positive(),
  purchaseCost: z.number().nonnegative(),
  starter: z.boolean().optional()
})

export const eventSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  description: z.string().default(''),
  trigger: z.discriminatedUnion('type', [
    z.object({ type: z.literal('tickInterval'), everyTicks: z.number().int().positive() }),
    z.object({ type: z.literal('lowStock'), itemId: idSchema, threshold: z.number().nonnegative() }),
    z.object({
      type: z.literal('stockpileShortage'),
      itemId: idSchema,
      threshold: z.number().nonnegative()
    })
  ]),
  effect: z.discriminatedUnion('type', [
    z.object({ type: z.literal('priceShock'), itemId: idSchema, multiplier: z.number().positive() }),
    z.object({ type: z.literal('message') }),
    z.object({ type: z.literal('stockpileShock'), itemId: idSchema, delta: z.number() }),
    z.object({ type: z.literal('creditBonus'), amount: z.number() })
  ]),
  minCampaignTick: z.number().int().nonnegative().optional(),
  requiresCompletedObjectiveId: idSchema.optional(),
  cooldownTicks: z.number().int().positive().optional()
})

export const manifestSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  version: z.string().min(1),
  author: z.string().default('unknown'),
  gameVersion: z.string().default('0.1.x'),
  dependencies: z.array(idSchema).default([]),
  loadAfter: z.array(idSchema).default([]),
  description: z.string().default('')
})

// Content-file schemas: each optional file is an array of the relevant entity.
export const itemsFileSchema = z.array(itemSchema)
export const recipesFileSchema = z.array(recipeSchema)
export const buildingsFileSchema = z.array(buildingSchema)
export const planetsFileSchema = z.array(planetSchema)
export const systemsFileSchema = z.array(systemSchema)
export const factionsFileSchema = z.array(factionSchema)
export const eventsFileSchema = z.array(eventSchema)
export const economicProfilesFileSchema = z.array(economicProfileSchema)
export const shipsFileSchema = z.array(shipSchema)

export const objectiveSchema = z.object({
  id: idSchema,
  title: z.string().min(1),
  description: z.string().default(''),
  type: z.enum([
    'produce_item',
    'sell_proceeds',
    'own_ships',
    'inter_system_delivery',
    'net_worth',
    'complete_contracts'
  ]),
  target: z.number().positive(),
  itemId: idSchema.optional(),
  dependsOnObjectiveId: idSchema.optional(),
  optional: z.boolean().optional()
})

export const contractTemplateTierSchema = z.object({
  tier: z.number().int().positive(),
  minReputation: z.number().nonnegative(),
  creditReward: z.number().nonnegative(),
  reputationReward: z.number().nonnegative(),
  expiresInDays: z.number().int().positive(),
  minCampaignTick: z.number().int().nonnegative().optional(),
  itemId: idSchema.optional(),
  quantityMin: z.number().int().positive().optional(),
  quantityMax: z.number().int().positive().optional(),
  shipDefinitionId: idSchema.optional(),
  netWorthMin: z.number().nonnegative().optional(),
  netWorthMax: z.number().nonnegative().optional()
})

export const contractTemplateSchema = z.object({
  id: idSchema,
  type: z.enum(['deliver_item', 'produce_item', 'sell_in_faction', 'own_asset', 'reach_net_worth']),
  title: z.string().min(1),
  description: z.string().default(''),
  factionId: idSchema,
  minCampaignTick: z.number().int().nonnegative().optional(),
  tiers: z.array(contractTemplateTierSchema).min(1)
})

export const objectivesFileSchema = z.array(objectiveSchema)
export const contractTemplatesFileSchema = z.array(contractTemplateSchema)

export const economyConfigSchema = z.object({
  npcLiquidityMinFraction: z.number().min(0).max(1).optional(),
  npcLiquidityMaxFraction: z.number().min(0).max(2).optional(),
  regionalTradeMinSpreadPercent: z.number().nonnegative().optional(),
  regionalTradeMaxUnitsPerDay: z.number().positive().optional(),
  regionalTradeMinSurplusFraction: z.number().nonnegative().optional(),
  regionalTradeMinShortageFraction: z.number().min(0).max(1).optional(),
  populationGrowthRatePerDay: z.number().nonnegative().optional(),
  populationDeclineFoodRatio: z.number().min(0).max(2).optional(),
  populationFoodItemId: idSchema.optional(),
  fuelItemId: idSchema.optional()
})

export const campaignStartConfigSchema = z.object({
  startingCredits: z.number().nonnegative().optional(),
  startingStock: z.record(idSchema, z.number().nonnegative()).optional(),
  startingBuildingTypes: z.array(idSchema).optional(),
  homeSystemId: idSchema.optional(),
  homePlanetMinHabitability: z.number().min(0).max(1).optional()
})

export const scenarioDefinitionSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  description: z.string().default(''),
  difficulty: z.enum(['easy', 'normal', 'hard', 'custom']),
  campaignStart: campaignStartConfigSchema.default({}),
  economyConfigOverrides: economyConfigSchema.optional(),
  startingObjectiveIds: z.array(idSchema).optional()
})

export const scenariosFileSchema = z.array(scenarioDefinitionSchema)

export const npcCorporationBuildingSeedSchema = z.object({
  planetId: idSchema,
  buildingType: idSchema
})

export const npcCorporationShipSeedSchema = z.object({
  definitionId: idSchema,
  name: z.string().min(1)
})

export const npcCorporationSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  factionId: idSchema.optional(),
  homeSystemId: idSchema,
  startingCredits: z.number().nonnegative(),
  startingStock: z.record(idSchema, z.number().nonnegative()).default({}),
  buildings: z.array(npcCorporationBuildingSeedSchema).default([]),
  ships: z.array(npcCorporationShipSeedSchema).optional(),
  aiProfile: z.enum(['extractor', 'refiner', 'trader', 'balanced'])
})

export const npcCorporationsFileSchema = z.array(npcCorporationSchema)
