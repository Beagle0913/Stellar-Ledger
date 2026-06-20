import { GAME_VERSION } from '../../shared/constants.js'
import { GameError } from '../../shared/errors.js'
import type { DB } from '../db.js'
import {
  parseStoredCampaignStartConfig,
  parseStoredContractTemplates,
  parseStoredEconomicProfiles,
  parseStoredEconomyConfig,
  parseStoredEvents,
  parseStoredFactions,
  parseStoredObjectives,
  parseStoredShipDefinitions,
  buildScenarioSnapshotFromRow
} from '../saveValidation.js'
import type {
  CampaignMeta,
  CampaignScenarioSnapshot,
  CampaignStartConfig,
  ContractTemplateDefinition,
  EconomicProfileDefinition,
  EconomyConfig,
  EventDefinition,
  FactionDefinition,
  GameDefinitions,
  ObjectiveDefinition,
  PlanetPopulationRow,
  ShipDefinition,
  GameLogEntry
} from '../../shared/types.js'

export function saveMeta(
  db: DB,
  meta: CampaignMeta,
  defs: GameDefinitions,
  playerCorporationId: string
): void {
  const scenario = meta.scenario
  db.prepare(
    `INSERT INTO campaign_meta (id, name, tick, created_at, ticking, game_version, factions_json, events_json, economic_profiles_json, ships_json, objectives_json, contract_templates_json, progression_json, economy_config_json, campaign_start_config_json, planet_populations_json, activity_log_json, scenario_id, scenario_name, scenario_difficulty, scenario_config_json, player_corporation_id)
     VALUES (@id, @name, @tick, @created_at, @ticking, @game_version, @factions_json, @events_json, @economic_profiles_json, @ships_json, @objectives_json, @contract_templates_json, @progression_json, @economy_config_json, @campaign_start_config_json, @planet_populations_json, @activity_log_json, @scenario_id, @scenario_name, @scenario_difficulty, @scenario_config_json, @player_corporation_id)
     ON CONFLICT(id) DO UPDATE SET
       name=excluded.name, tick=excluded.tick, ticking=excluded.ticking,
       planet_populations_json=excluded.planet_populations_json`
  ).run({
    id: meta.id,
    name: meta.name,
    tick: meta.tick,
    created_at: meta.createdAt,
    ticking: meta.ticking ? 1 : 0,
    game_version: GAME_VERSION,
    factions_json: JSON.stringify(defs.factions),
    events_json: JSON.stringify(defs.events),
    economic_profiles_json: JSON.stringify(defs.economicProfiles),
    ships_json: JSON.stringify(defs.ships),
    objectives_json: JSON.stringify(defs.objectives),
    contract_templates_json: JSON.stringify(defs.contractTemplates),
    progression_json: '{}',
    economy_config_json: JSON.stringify(defs.economyConfig),
    campaign_start_config_json: JSON.stringify(defs.campaignStartConfig),
    planet_populations_json: '[]',
    activity_log_json: '[]',
    scenario_id: scenario?.id ?? 'standard',
    scenario_name: scenario?.name ?? 'Standard',
    scenario_difficulty: scenario?.difficulty ?? 'normal',
    scenario_config_json: JSON.stringify(scenario?.config ?? null),
    player_corporation_id: playerCorporationId
  })
}

export function saveMetaProgress(
  db: DB,
  meta: CampaignMeta,
  planetPopulations: PlanetPopulationRow[],
  activityLog: GameLogEntry[]
): void {
  db.prepare(
    `UPDATE campaign_meta SET name = @name, tick = @tick, ticking = @ticking, planet_populations_json = @planet_populations_json, activity_log_json = @activity_log_json WHERE id = @id`
  ).run({
    id: meta.id,
    name: meta.name,
    tick: meta.tick,
    ticking: meta.ticking ? 1 : 0,
    planet_populations_json: JSON.stringify(planetPopulations),
    activity_log_json: JSON.stringify(activityLog)
  })
}

export function loadMeta(db: DB): {
  meta: CampaignMeta
  playerCorporationId: string | null
  factions: FactionDefinition[]
  events: EventDefinition[]
  economicProfiles: EconomicProfileDefinition[]
  ships: ShipDefinition[]
  objectives: ObjectiveDefinition[]
  contractTemplates: ContractTemplateDefinition[]
  economyConfig: EconomyConfig
  campaignStartConfig: CampaignStartConfig
  scenario: CampaignScenarioSnapshot
} {
  const row = db
    .prepare(
      'SELECT id, name, tick, created_at, ticking, factions_json, events_json, economic_profiles_json, ships_json, objectives_json, contract_templates_json, economy_config_json, campaign_start_config_json, scenario_id, scenario_name, scenario_difficulty, scenario_config_json, player_corporation_id FROM campaign_meta LIMIT 1'
    )
    .get() as
    | {
        id: string
        name: string
        tick: number
        created_at: number
        ticking: number
        factions_json: string
        events_json: string
        economic_profiles_json: string | null
        ships_json: string | null
        objectives_json: string | null
        contract_templates_json: string | null
        economy_config_json: string | null
        campaign_start_config_json: string | null
        scenario_id: string | null
        scenario_name: string | null
        scenario_difficulty: string | null
        scenario_config_json: string | null
        player_corporation_id: string | null
      }
    | undefined
  if (!row) throw new GameError('INTERNAL', 'No campaign_meta row found in save.')
  const scenario = buildScenarioSnapshotFromRow(
    row.scenario_id,
    row.scenario_name,
    row.scenario_difficulty,
    row.scenario_config_json
  )
  return {
    meta: {
      id: row.id,
      name: row.name,
      tick: row.tick,
      createdAt: row.created_at,
      ticking: false,
      scenario
    },
    playerCorporationId: row.player_corporation_id,
    factions: parseStoredFactions(row.factions_json),
    events: parseStoredEvents(row.events_json),
    economicProfiles: parseStoredEconomicProfiles(row.economic_profiles_json),
    ships: parseStoredShipDefinitions(row.ships_json),
    objectives: parseStoredObjectives(row.objectives_json),
    contractTemplates: parseStoredContractTemplates(row.contract_templates_json),
    economyConfig: parseStoredEconomyConfig(row.economy_config_json),
    campaignStartConfig: parseStoredCampaignStartConfig(row.campaign_start_config_json),
    scenario
  }
}
