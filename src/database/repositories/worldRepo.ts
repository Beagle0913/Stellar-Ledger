import type { DB } from '../db.js'
import { parseStoredActivityLog, parseStoredBuildMaterials, parseStoredCampaignStartConfig, parseStoredContractTemplates, parseStoredEconomicProfiles, parseStoredEconomyConfig, parseStoredEvents, parseStoredFactions, parseStoredObjectives, parseStoredPlanetModifiers, parseStoredPlanetPopulations, parseStoredShipDefinitions, buildScenarioSnapshotFromRow } from '../saveValidation.js'
import type {
  BuildingDefinition,
  BuildingInstance,
  CampaignMeta,
  CampaignScenarioSnapshot,
  CampaignStartConfig,
  Corporation,
  EconomicProfileDefinition,
  EconomyConfig,
  EventDefinition,
  EventLogEntry,
  FactionDefinition,
  GameDefinitions,
  GameLogEntry,
  ItemDefinition,
  PlanetDefinition,
  PlanetPopulationRow,
  RecipeDefinition,
  RecipeIO,
  Ship,
  ShipDefinition,
  SystemDefinition,
  ObjectiveDefinition,
  ContractTemplateDefinition
} from '../../shared/types.js'

// Persistence for campaign meta, the player corporation, the FROZEN definition
// snapshot (items/recipes/buildings/systems/planets + factions/events JSON),
// plus building instances, ships, and the events log.

// ---- Campaign meta ----------------------------------------------------------

export function saveMeta(db: DB, meta: CampaignMeta, defs: GameDefinitions): void {
  const scenario = meta.scenario
  db.prepare(
    `INSERT INTO campaign_meta (id, name, tick, created_at, ticking, game_version, factions_json, events_json, economic_profiles_json, ships_json, objectives_json, contract_templates_json, progression_json, economy_config_json, campaign_start_config_json, planet_populations_json, activity_log_json, scenario_id, scenario_name, scenario_difficulty, scenario_config_json)
     VALUES (@id, @name, @tick, @created_at, @ticking, @game_version, @factions_json, @events_json, @economic_profiles_json, @ships_json, @objectives_json, @contract_templates_json, @progression_json, @economy_config_json, @campaign_start_config_json, @planet_populations_json, @activity_log_json, @scenario_id, @scenario_name, @scenario_difficulty, @scenario_config_json)
     ON CONFLICT(id) DO UPDATE SET
       name=excluded.name, tick=excluded.tick, ticking=excluded.ticking,
       planet_populations_json=excluded.planet_populations_json`
  ).run({
    id: meta.id,
    name: meta.name,
    tick: meta.tick,
    created_at: meta.createdAt,
    ticking: meta.ticking ? 1 : 0,
    game_version: '0.1.0',
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
    scenario_config_json: JSON.stringify(scenario?.config ?? null)
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
      'SELECT id, name, tick, created_at, ticking, factions_json, events_json, economic_profiles_json, ships_json, objectives_json, contract_templates_json, economy_config_json, campaign_start_config_json, scenario_id, scenario_name, scenario_difficulty, scenario_config_json FROM campaign_meta LIMIT 1'
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
      }
    | undefined
  if (!row) throw new Error('No campaign_meta row found in save.')
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

// ---- Corporation ------------------------------------------------------------

export function saveCorporation(db: DB, corp: Corporation): void {
  db.prepare(
    `INSERT INTO corporations (id, name, credits, home_system_id)
     VALUES (@id, @name, @credits, @home_system_id)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, credits=excluded.credits, home_system_id=excluded.home_system_id`
  ).run({ id: corp.id, name: corp.name, credits: corp.credits, home_system_id: corp.homeSystemId })
}

export function loadCorporation(db: DB): Corporation {
  const row = db
    .prepare('SELECT id, name, credits, home_system_id FROM corporations LIMIT 1')
    .get() as { id: string; name: string; credits: number; home_system_id: string } | undefined
  if (!row) throw new Error('No corporation found in save.')
  return { id: row.id, name: row.name, credits: row.credits, homeSystemId: row.home_system_id }
}

// ---- Frozen definitions (written once at campaign creation) -----------------

export function writeDefinitions(db: DB, defs: GameDefinitions): void {
  const sys = db.prepare(
    'INSERT INTO star_systems (id, name, x, y, economic_profile_id, controlling_faction_id) VALUES (?, ?, ?, ?, ?, ?)'
  )
  for (const s of defs.systems) {
    sys.run(s.id, s.name, s.x, s.y, s.economicProfileId ?? null, s.controllingFactionId ?? null)
  }

  const planet = db.prepare(
    'INSERT INTO planets (id, name, system_id, planet_type, habitability, mineral_richness, fertility, energy_potential, population, modifiers_json, economic_profile_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  )
  for (const p of defs.planets) {
    planet.run(
      p.id,
      p.name,
      p.systemId,
      p.planetType,
      p.habitability,
      p.mineralRichness,
      p.fertility,
      p.energyPotential,
      p.population,
      JSON.stringify(p.modifiers),
      p.economicProfileId ?? null
    )
  }

  const item = db.prepare(
    'INSERT INTO item_definitions (id, name, category, base_value, volume) VALUES (?, ?, ?, ?, ?)'
  )
  for (const i of defs.items) item.run(i.id, i.name, i.category, i.baseValue, i.volume)

  const recipe = db.prepare(
    'INSERT INTO recipe_definitions (id, name, building_type, duration, extraction, yield_stat) VALUES (?, ?, ?, ?, ?, ?)'
  )
  const recipeIn = db.prepare('INSERT INTO recipe_inputs (recipe_id, item_id, quantity) VALUES (?, ?, ?)')
  const recipeOut = db.prepare('INSERT INTO recipe_outputs (recipe_id, item_id, quantity) VALUES (?, ?, ?)')
  for (const r of defs.recipes) {
    recipe.run(r.id, r.name, r.buildingType, r.duration, r.extraction ? 1 : 0, r.yieldStat ?? null)
    for (const io of r.inputs) recipeIn.run(r.id, io.itemId, io.quantity)
    for (const io of r.outputs) recipeOut.run(r.id, io.itemId, io.quantity)
  }

  const building = db.prepare(
    'INSERT INTO building_definitions (id, name, build_cost, build_materials_json) VALUES (?, ?, ?, ?)'
  )
  for (const b of defs.buildings) {
    building.run(b.id, b.name, b.buildCost, JSON.stringify(b.buildMaterials))
  }
}

export function loadDefinitions(
  db: DB,
  factions: FactionDefinition[],
  events: EventDefinition[],
  economicProfiles: EconomicProfileDefinition[],
  ships: ShipDefinition[],
  objectives: ObjectiveDefinition[],
  contractTemplates: ContractTemplateDefinition[],
  economyConfig: EconomyConfig,
  campaignStartConfig: CampaignStartConfig
): GameDefinitions {
  const systems = (
    db
      .prepare(
        'SELECT id, name, x, y, economic_profile_id, controlling_faction_id FROM star_systems'
      )
      .all() as Array<{
      id: string
      name: string
      x: number
      y: number
      economic_profile_id: string | null
      controlling_faction_id: string | null
    }>
  ).map<SystemDefinition>((r) => ({
    id: r.id,
    name: r.name,
    x: r.x,
    y: r.y,
    ...(r.economic_profile_id ? { economicProfileId: r.economic_profile_id } : {}),
    ...(r.controlling_faction_id ? { controllingFactionId: r.controlling_faction_id } : {})
  }))

  const planets = (
    db
      .prepare(
        'SELECT id, name, system_id, planet_type, habitability, mineral_richness, fertility, energy_potential, population, modifiers_json, economic_profile_id FROM planets'
      )
      .all() as Array<{
      id: string
      name: string
      system_id: string
      planet_type: string
      habitability: number
      mineral_richness: number
      fertility: number
      energy_potential: number
      population: number
      modifiers_json: string
      economic_profile_id: string | null
    }>
  ).map<PlanetDefinition>((r) => ({
    id: r.id,
    name: r.name,
    systemId: r.system_id,
    planetType: r.planet_type as PlanetDefinition['planetType'],
    habitability: r.habitability,
    mineralRichness: r.mineral_richness,
    fertility: r.fertility,
    energyPotential: r.energy_potential,
    population: r.population,
    modifiers: parseStoredPlanetModifiers(r.modifiers_json),
    ...(r.economic_profile_id ? { economicProfileId: r.economic_profile_id } : {})
  }))

  const items = (
    db.prepare('SELECT id, name, category, base_value, volume FROM item_definitions').all() as Array<{
      id: string
      name: string
      category: string
      base_value: number
      volume: number
    }>
  ).map<ItemDefinition>((r) => ({
    id: r.id,
    name: r.name,
    category: r.category as ItemDefinition['category'],
    baseValue: r.base_value,
    volume: r.volume
  }))

  const inputsByRecipe = groupIo(
    db.prepare('SELECT recipe_id, item_id, quantity FROM recipe_inputs').all() as Array<{
      recipe_id: string
      item_id: string
      quantity: number
    }>
  )
  const outputsByRecipe = groupIo(
    db.prepare('SELECT recipe_id, item_id, quantity FROM recipe_outputs').all() as Array<{
      recipe_id: string
      item_id: string
      quantity: number
    }>
  )
  const recipes = (
    db
      .prepare('SELECT id, name, building_type, duration, extraction, yield_stat FROM recipe_definitions')
      .all() as Array<{
      id: string
      name: string
      building_type: string
      duration: number
      extraction: number
      yield_stat: string | null
    }>
  ).map<RecipeDefinition>((r) => ({
    id: r.id,
    name: r.name,
    buildingType: r.building_type,
    duration: r.duration,
    extraction: r.extraction === 1,
    ...(r.yield_stat ? { yieldStat: r.yield_stat as RecipeDefinition['yieldStat'] } : {}),
    inputs: inputsByRecipe.get(r.id) ?? [],
    outputs: outputsByRecipe.get(r.id) ?? []
  }))

  const buildings = (
    db.prepare('SELECT id, name, build_cost, build_materials_json FROM building_definitions').all() as Array<{
      id: string
      name: string
      build_cost: number
      build_materials_json: string
    }>
  ).map<BuildingDefinition>((r) => ({
    id: r.id,
    name: r.name,
    buildCost: r.build_cost,
    buildMaterials: parseStoredBuildMaterials(r.build_materials_json)
  }))

  return {
    items,
    recipes,
    buildings,
    systems,
    planets,
    factions,
    events,
    economicProfiles,
    ships,
    objectives,
    contractTemplates,
    economyConfig,
    campaignStartConfig,
    scenarios: []
  }
}

export function loadActivityLog(db: DB): GameLogEntry[] {
  const row = db
    .prepare('SELECT activity_log_json FROM campaign_meta LIMIT 1')
    .get() as { activity_log_json: string | null } | undefined
  return parseStoredActivityLog(row?.activity_log_json)
}

export function loadPlanetPopulations(
  db: DB,
  planets: PlanetDefinition[]
): PlanetPopulationRow[] {
  const row = db
    .prepare('SELECT planet_populations_json FROM campaign_meta LIMIT 1')
    .get() as { planet_populations_json: string | null } | undefined
  const parsed = parseStoredPlanetPopulations(row?.planet_populations_json)
  if (parsed) return parsed
  return planets.map((p) => ({ planetId: p.id, population: p.population }))
}

export function savePlanetPopulations(db: DB, rows: PlanetPopulationRow[]): void {
  db.prepare('UPDATE campaign_meta SET planet_populations_json = ?').run(JSON.stringify(rows))
}

function groupIo(
  rows: Array<{ recipe_id: string; item_id: string; quantity: number }>
): Map<string, RecipeIO[]> {
  const map = new Map<string, RecipeIO[]>()
  for (const r of rows) {
    const list = map.get(r.recipe_id) ?? []
    list.push({ itemId: r.item_id, quantity: r.quantity })
    map.set(r.recipe_id, list)
  }
  return map
}

// ---- Building instances, ships, events log ----------------------------------

export function loadBuildings(db: DB): BuildingInstance[] {
  const rows = db.prepare('SELECT id, definition_id, planet_id, owner_id FROM buildings').all() as Array<{
    id: string
    definition_id: string
    planet_id: string
    owner_id: string
  }>
  return rows.map((r) => ({
    id: r.id,
    definitionId: r.definition_id,
    planetId: r.planet_id,
    ownerId: r.owner_id
  }))
}

export function saveBuildings(db: DB, buildings: BuildingInstance[]): void {
  db.prepare('DELETE FROM buildings').run()
  const stmt = db.prepare(
    'INSERT INTO buildings (id, definition_id, planet_id, owner_id) VALUES (?, ?, ?, ?)'
  )
  for (const b of buildings) stmt.run(b.id, b.definitionId, b.planetId, b.ownerId)
}

export function loadShips(db: DB): Ship[] {
  const rows = db
    .prepare(
      'SELECT id, name, definition_id, cargo_capacity, fuel_use_per_distance, speed, current_system_id, owner_id FROM ships'
    )
    .all() as Array<{
    id: string
    name: string
    definition_id: string | null
    cargo_capacity: number
    fuel_use_per_distance: number
    speed: number
    current_system_id: string
    owner_id: string
  }>
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    ...(r.definition_id ? { definitionId: r.definition_id } : {}),
    cargoCapacity: r.cargo_capacity,
    fuelUsePerDistance: r.fuel_use_per_distance,
    speed: r.speed,
    currentSystemId: r.current_system_id,
    ownerId: r.owner_id
  }))
}

export function saveShips(db: DB, ships: Ship[]): void {
  db.prepare('DELETE FROM ships').run()
  const stmt = db.prepare(
    'INSERT INTO ships (id, name, definition_id, cargo_capacity, fuel_use_per_distance, speed, current_system_id, owner_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  )
  for (const s of ships) {
    stmt.run(
      s.id,
      s.name,
      s.definitionId ?? null,
      s.cargoCapacity,
      s.fuelUsePerDistance,
      s.speed,
      s.currentSystemId,
      s.ownerId
    )
  }
}

export function loadEventsLog(db: DB): EventLogEntry[] {
  const rows = db.prepare('SELECT id, tick, event_id, message FROM events_log ORDER BY tick').all() as Array<{
    id: string
    tick: number
    event_id: string
    message: string
  }>
  return rows.map((r) => ({ id: r.id, tick: r.tick, eventId: r.event_id, message: r.message }))
}

export function saveEventsLog(db: DB, log: EventLogEntry[]): void {
  db.prepare('DELETE FROM events_log').run()
  const stmt = db.prepare('INSERT INTO events_log (id, tick, event_id, message) VALUES (?, ?, ?, ?)')
  for (const e of log) stmt.run(e.id, e.tick, e.eventId, e.message)
}
