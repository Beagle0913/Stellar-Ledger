import { GameError } from '../shared/errors.js'
import type {
  BuildingDefinition,
  CampaignStartConfig,
  EconomicProfileDefinition,
  EconomyConfig,
  EventDefinition,
  FactionDefinition,
  ItemDefinition,
  PlanetDefinition,
  RecipeDefinition,
  ShipDefinition,
  SystemDefinition,
  ObjectiveDefinition,
  ContractTemplateDefinition,
  NpcCorporationDefinition,
  ScenarioDefinition
} from '../shared/types.js'

/** Parsed contents of a single mod's mod.json manifest. */
export interface ModManifest {
  id: string
  name: string
  version: string
  author: string
  gameVersion: string
  dependencies: string[]
  loadAfter: string[]
  description: string
}

/** A fully parsed mod: manifest plus any content files it provided. */
export interface LoadedMod {
  manifest: ModManifest
  source: 'builtin' | 'external'
  enabled: boolean
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
  /** Partial overrides from optional economy_config.json. */
  economyConfig: Partial<EconomyConfig>
  /** Partial overrides from optional campaign_start.json. */
  campaignStartConfig: Partial<CampaignStartConfig>
  scenarios: ScenarioDefinition[]
  npcCorporations: NpcCorporationDefinition[]
}

/** Error type thrown for any mod loading/validation failure (clear messages). */
export class ModValidationError extends GameError {
  constructor(message: string) {
    super('MOD_VALIDATION', message)
    this.name = 'ModValidationError'
  }
}
