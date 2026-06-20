import type { DB } from '../db.js'
import { parseStoredBuildMaterials, parseStoredPlanetModifiers } from '../saveValidation.js'
import type {
  BuildingDefinition,
  CampaignStartConfig,
  ContractTemplateDefinition,
  EconomicProfileDefinition,
  EconomyConfig,
  EventDefinition,
  FactionDefinition,
  GameDefinitions,
  ItemDefinition,
  ObjectiveDefinition,
  PlanetDefinition,
  RecipeDefinition,
  RecipeIO,
  ShipDefinition,
  SystemDefinition
} from '../../shared/types.js'

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
    scenarios: [],
    npcCorporations: []
  }
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
