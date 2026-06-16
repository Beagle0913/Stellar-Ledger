import { z } from 'zod'
import {
  buildMaterialsFileSchema,
  campaignStartConfigSchema,
  contractTemplatesFileSchema,
  economicProfilesFileSchema,
  economyConfigSchema,
  eventsFileSchema,
  factionsFileSchema,
  idSchema,
  objectivesFileSchema,
  planetModifiersSchema,
  scenarioDefinitionSchema,
  shipsFileSchema
} from '../mods/modSchemas.js'
import { mergeCampaignStartConfig } from '../shared/campaignStartConfig.js'
import { mergeEconomyConfig } from '../shared/economyConfig.js'
import { legacyStandardScenarioSnapshot } from '../shared/scenarios.js'
import type {
  CampaignProgression,
  CampaignStartConfig,
  CampaignScenarioSnapshot,
  ContractTemplateDefinition,
  EconomicProfileDefinition,
  EconomyConfig,
  EventDefinition,
  FactionDefinition,
  GameLogEntry,
  ObjectiveDefinition,
  PlanetPopulationRow,
  PlanetModifiers,
  RecipeIO,
  ScenarioDefinition,
  ShipDefinition
} from '../shared/types.js'

/**
 * Parse and validate frozen JSON blobs loaded from a save file. Invalid or
 * corrupt values fall back to engine defaults unless GE_STRICT_SAVE=1.
 */

export const loadValidationWarnings: string[] = []

export function clearLoadValidationWarnings(): void {
  loadValidationWarnings.length = 0
}

export function isStrictSaveValidation(): boolean {
  return process.env['GE_STRICT_SAVE'] === '1'
}

function noteValidationWarning(label: string, detail: string): void {
  const msg = `${label}: ${detail}`
  if (isStrictSaveValidation()) {
    throw new Error(msg)
  }
  loadValidationWarnings.push(msg)
}

const gameLogCategorySchema = z.enum([
  'system',
  'tick',
  'production',
  'transport',
  'market',
  'trade',
  'economy',
  'regional',
  'population',
  'event',
  'player',
  'contract',
  'mod'
])

const gameLogEntrySchema = z.object({
  id: z.string().min(1),
  tick: z.number().int().nonnegative(),
  category: gameLogCategorySchema,
  message: z.string(),
  at: z.number()
})

const gameLogFileSchema = z.array(gameLogEntrySchema)

const planetPopulationRowSchema = z.object({
  planetId: idSchema,
  population: z.number().nonnegative()
})

const planetPopulationsFileSchema = z.array(planetPopulationRowSchema)

const objectiveProgressEntrySchema = z.object({
  objectiveId: z.string().min(1),
  current: z.number(),
  target: z.number(),
  completed: z.boolean()
})

const activeContractParamsSchema = z.object({
  itemId: idSchema.optional(),
  quantity: z.number().optional(),
  systemId: idSchema.optional(),
  factionId: idSchema.optional(),
  shipDefinitionId: idSchema.optional(),
  netWorthTarget: z.number().optional(),
  target: z.number().optional(),
  baselineProduced: z.number().optional()
})

const activeContractSchema = z.object({
  id: z.string().min(1),
  templateId: z.string().min(1),
  type: z.enum([
    'deliver_item',
    'produce_item',
    'sell_in_faction',
    'own_asset',
    'reach_net_worth'
  ]),
  title: z.string(),
  description: z.string(),
  factionId: idSchema,
  tier: z.number().int().nonnegative(),
  creditReward: z.number(),
  reputationReward: z.number(),
  expiresAtTick: z.number().int(),
  accepted: z.boolean(),
  progress: z.number(),
  target: z.number(),
  params: activeContractParamsSchema.default({})
})

export const campaignProgressionSchema = z.object({
  objectives: z.array(objectiveProgressEntrySchema).default([]),
  totalSellProceeds: z.number().default(0),
  firstInterSystemDelivery: z.boolean().default(false),
  producedItems: z.record(idSchema, z.number()).default({}),
  activeContracts: z.array(activeContractSchema).default([]),
  completedContractIds: z.array(z.string()).default([]),
  factionReputation: z.record(idSchema, z.number()).default({}),
  eventLastFiredTick: z.record(idSchema, z.number()).default({})
})

function parseJsonArray<T>(
  raw: string | null | undefined,
  schema: { safeParse: (v: unknown) => { success: boolean; data?: T } },
  fallback: T,
  label: string
): T {
  if (!raw) return fallback
  try {
    const parsed: unknown = JSON.parse(raw)
    const result = schema.safeParse(parsed)
    if (result.success) return result.data as T
    noteValidationWarning(label, 'schema validation failed')
    return fallback
  } catch {
    noteValidationWarning(label, 'invalid JSON')
    return fallback
  }
}

function parseJsonObject<T>(
  raw: string | null | undefined,
  schema: { safeParse: (v: unknown) => { success: boolean; data?: T } },
  fallback: T,
  label: string
): T {
  if (!raw) return fallback
  try {
    const parsed: unknown = JSON.parse(raw)
    const result = schema.safeParse(parsed)
    if (result.success) return result.data as T
    noteValidationWarning(label, 'schema validation failed')
    return fallback
  } catch {
    noteValidationWarning(label, 'invalid JSON')
    return fallback
  }
}

export function parseStoredEconomyConfig(raw: string | null | undefined): EconomyConfig {
  if (!raw) return mergeEconomyConfig(undefined)
  try {
    const parsed: unknown = JSON.parse(raw)
    const result = economyConfigSchema.safeParse(parsed)
    if (!result.success) {
      noteValidationWarning('economy_config_json', 'schema validation failed')
      return mergeEconomyConfig(undefined)
    }
    return mergeEconomyConfig(result.data)
  } catch {
    noteValidationWarning('economy_config_json', 'invalid JSON')
    return mergeEconomyConfig(undefined)
  }
}

export function parseStoredCampaignStartConfig(raw: string | null | undefined): CampaignStartConfig {
  if (!raw) return mergeCampaignStartConfig(undefined)
  try {
    const parsed: unknown = JSON.parse(raw)
    const result = campaignStartConfigSchema.safeParse(parsed)
    if (!result.success) {
      noteValidationWarning('campaign_start_config_json', 'schema validation failed')
      return mergeCampaignStartConfig(undefined)
    }
    return mergeCampaignStartConfig(result.data)
  } catch {
    noteValidationWarning('campaign_start_config_json', 'invalid JSON')
    return mergeCampaignStartConfig(undefined)
  }
}

export function parseStoredScenarioConfig(raw: string | null | undefined): ScenarioDefinition {
  if (!raw) return legacyStandardScenarioSnapshot()
  try {
    const parsed: unknown = JSON.parse(raw)
    const result = scenarioDefinitionSchema.safeParse(parsed)
    if (!result.success) {
      noteValidationWarning('scenario_config_json', 'schema validation failed')
      return legacyStandardScenarioSnapshot()
    }
    return result.data
  } catch {
    noteValidationWarning('scenario_config_json', 'invalid JSON')
    return legacyStandardScenarioSnapshot()
  }
}

export function buildScenarioSnapshotFromRow(
  scenarioId: string | null | undefined,
  scenarioName: string | null | undefined,
  scenarioDifficulty: string | null | undefined,
  scenarioConfigJson: string | null | undefined
): CampaignScenarioSnapshot {
  const config = parseStoredScenarioConfig(scenarioConfigJson)
  const difficulty = (scenarioDifficulty ??
    config.difficulty ??
    'normal') as CampaignScenarioSnapshot['difficulty']
  return {
    id: scenarioId ?? config.id,
    name: scenarioName ?? config.name,
    difficulty,
    config
  }
}

export function parseStoredFactions(raw: string | null | undefined): FactionDefinition[] {
  return parseJsonArray(raw, factionsFileSchema, [], 'factions_json')
}

export function parseStoredEvents(raw: string | null | undefined): EventDefinition[] {
  return parseJsonArray(raw, eventsFileSchema, [], 'events_json')
}

export function parseStoredEconomicProfiles(
  raw: string | null | undefined
): EconomicProfileDefinition[] {
  return parseJsonArray(raw, economicProfilesFileSchema, [], 'economic_profiles_json')
}

export function parseStoredShipDefinitions(raw: string | null | undefined): ShipDefinition[] {
  return parseJsonArray(raw, shipsFileSchema, [], 'ships_json')
}

export function parseStoredObjectives(raw: string | null | undefined): ObjectiveDefinition[] {
  return parseJsonArray(raw, objectivesFileSchema, [], 'objectives_json')
}

export function parseStoredContractTemplates(
  raw: string | null | undefined
): ContractTemplateDefinition[] {
  return parseJsonArray(raw, contractTemplatesFileSchema, [], 'contract_templates_json')
}

export function parseStoredActivityLog(raw: string | null | undefined): GameLogEntry[] {
  return parseJsonArray(raw, gameLogFileSchema, [], 'activity_log_json')
}

export function parseStoredPlanetPopulations(
  raw: string | null | undefined
): PlanetPopulationRow[] | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    const result = planetPopulationsFileSchema.safeParse(parsed)
    if (!result.success || result.data.length === 0) {
      noteValidationWarning('planet_populations_json', 'schema validation failed or empty')
      return null
    }
    return result.data as PlanetPopulationRow[]
  } catch {
    noteValidationWarning('planet_populations_json', 'invalid JSON')
    return null
  }
}

export function parseStoredProgression(raw: string | null | undefined): CampaignProgression | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    const result = campaignProgressionSchema.safeParse(parsed)
    if (!result.success) {
      noteValidationWarning('progression_json', 'schema validation failed')
      return null
    }
    return result.data as CampaignProgression
  } catch {
    noteValidationWarning('progression_json', 'invalid JSON')
    return null
  }
}

export function parseStoredPlanetModifiers(raw: string | null | undefined): PlanetModifiers {
  return parseJsonObject(raw, planetModifiersSchema, {}, 'modifiers_json')
}

export function parseStoredBuildMaterials(raw: string | null | undefined): RecipeIO[] {
  return parseJsonArray(raw, buildMaterialsFileSchema, [], 'build_materials_json')
}
