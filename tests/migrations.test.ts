import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { runMigrations } from '../src/database/migrations.js'
import { loadCampaign } from '../src/database/saveManager.js'

// Real v1 -> v2 migration test. We build a genuine v1 database BY HAND (the
// current schema minus everything added in v2) and assert runMigrations()
// upgrades it in place and that the result loads as a valid GameState.

/** The v1 schema: schema.sql as it was before the v2 additions, i.e. without
 * campaign_meta.economic_profiles_json, star_systems/planets.economic_profile_id,
 * price_history.reason, and without the local_stockpiles table. */
const V1_SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE campaign_meta (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  tick          INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL,
  ticking       INTEGER NOT NULL DEFAULT 0,
  game_version  TEXT NOT NULL,
  factions_json TEXT NOT NULL DEFAULT '[]',
  events_json   TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE corporations (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  credits        REAL NOT NULL,
  home_system_id TEXT NOT NULL
);

CREATE TABLE star_systems (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  x    REAL NOT NULL,
  y    REAL NOT NULL
);

CREATE TABLE planets (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  system_id        TEXT NOT NULL,
  planet_type      TEXT NOT NULL,
  habitability     REAL NOT NULL,
  mineral_richness REAL NOT NULL,
  fertility        REAL NOT NULL,
  energy_potential REAL NOT NULL,
  population       INTEGER NOT NULL,
  modifiers_json   TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE item_definitions (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  category   TEXT NOT NULL,
  base_value REAL NOT NULL,
  volume     REAL NOT NULL
);

CREATE TABLE recipe_definitions (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  building_type TEXT NOT NULL,
  duration      INTEGER NOT NULL,
  extraction    INTEGER NOT NULL DEFAULT 0,
  yield_stat    TEXT
);

CREATE TABLE recipe_inputs (
  recipe_id TEXT NOT NULL,
  item_id   TEXT NOT NULL,
  quantity  REAL NOT NULL
);

CREATE TABLE recipe_outputs (
  recipe_id TEXT NOT NULL,
  item_id   TEXT NOT NULL,
  quantity  REAL NOT NULL
);

CREATE TABLE building_definitions (
  id                   TEXT PRIMARY KEY,
  name                 TEXT NOT NULL,
  build_cost           REAL NOT NULL,
  build_materials_json TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE buildings (
  id            TEXT PRIMARY KEY,
  definition_id TEXT NOT NULL,
  planet_id     TEXT NOT NULL,
  owner_id      TEXT NOT NULL
);

CREATE TABLE inventories (
  owner_id  TEXT NOT NULL,
  system_id TEXT NOT NULL,
  item_id   TEXT NOT NULL,
  quantity  REAL NOT NULL,
  reserved  REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (owner_id, system_id, item_id)
);

CREATE TABLE markets (
  id        TEXT PRIMARY KEY,
  system_id TEXT NOT NULL
);

CREATE TABLE market_orders (
  id                 TEXT PRIMARY KEY,
  market_id          TEXT NOT NULL,
  item_id            TEXT NOT NULL,
  side               TEXT NOT NULL,
  quantity           REAL NOT NULL,
  remaining_quantity REAL NOT NULL,
  price              REAL NOT NULL,
  owner_id           TEXT NOT NULL,
  created_at         INTEGER NOT NULL
);

CREATE TABLE price_history (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  market_id TEXT NOT NULL,
  item_id   TEXT NOT NULL,
  tick      INTEGER NOT NULL,
  price     REAL NOT NULL
);

CREATE TABLE ships (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  cargo_capacity        REAL NOT NULL,
  fuel_use_per_distance REAL NOT NULL,
  speed                 REAL NOT NULL,
  current_system_id     TEXT NOT NULL,
  owner_id              TEXT NOT NULL
);

CREATE TABLE transport_jobs (
  id                    TEXT PRIMARY KEY,
  ship_id               TEXT NOT NULL,
  origin_system_id      TEXT NOT NULL,
  destination_system_id TEXT NOT NULL,
  item_id               TEXT NOT NULL,
  quantity              REAL NOT NULL,
  progress              REAL NOT NULL,
  distance              REAL NOT NULL,
  fuel_cost             REAL NOT NULL,
  status                TEXT NOT NULL,
  owner_id              TEXT NOT NULL
);

CREATE TABLE production_jobs (
  id          TEXT PRIMARY KEY,
  building_id TEXT NOT NULL,
  recipe_id   TEXT NOT NULL,
  quantity    REAL NOT NULL,
  progress    REAL NOT NULL,
  duration    REAL NOT NULL,
  status      TEXT NOT NULL
);

CREATE TABLE events_log (
  id       TEXT PRIMARY KEY,
  tick     INTEGER NOT NULL,
  event_id TEXT NOT NULL,
  message  TEXT NOT NULL
);
`

function buildV1Database(): Database.Database {
  const db = new Database(':memory:')
  db.exec(V1_SCHEMA)

  db.prepare(
    `INSERT INTO campaign_meta (id, name, tick, created_at, ticking, game_version)
     VALUES ('camp_1', 'Legacy Campaign', 12, 1700000000000, 0, '0.1.0')`
  ).run()
  db.prepare(
    `INSERT INTO corporations (id, name, credits, home_system_id)
     VALUES ('player', 'Player Holdings', 100000, 'sys_a')`
  ).run()
  db.prepare(`INSERT INTO star_systems (id, name, x, y) VALUES ('sys_a', 'Alpha', 10, 20)`).run()
  db.prepare(
    `INSERT INTO planets (id, name, system_id, planet_type, habitability, mineral_richness, fertility, energy_potential, population, modifiers_json)
     VALUES ('planet_a', 'Alpha I', 'sys_a', 'terran', 0.8, 0.5, 1.0, 1.0, 1000, '{}')`
  ).run()
  db.prepare(
    `INSERT INTO item_definitions (id, name, category, base_value, volume)
     VALUES ('ore', 'Ore', 'raw', 10, 1)`
  ).run()
  db.prepare(`INSERT INTO markets (id, system_id) VALUES ('market_sys_a', 'sys_a')`).run()
  db.prepare(
    `INSERT INTO price_history (market_id, item_id, tick, price) VALUES ('market_sys_a', 'ore', 3, 11)`
  ).run()

  db.pragma('user_version = 1')
  return db
}

function columnNames(db: Database.Database, table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map(
    (r) => r.name
  )
}

describe('v1 -> v2 migration', () => {
  it('upgrades a real v1 database in place and loads it as a valid GameState', () => {
    const db = buildV1Database()

    runMigrations(db)

    expect(db.pragma('user_version', { simple: true })).toBe(10)
    expect(columnNames(db, 'campaign_meta')).toContain('economic_profiles_json')
    expect(columnNames(db, 'campaign_meta')).toContain('ships_json')
    expect(columnNames(db, 'campaign_meta')).toContain('progression_json')
    expect(columnNames(db, 'campaign_meta')).toContain('objectives_json')
    expect(columnNames(db, 'campaign_meta')).toContain('contract_templates_json')
    expect(columnNames(db, 'campaign_meta')).toContain('economy_config_json')
    expect(columnNames(db, 'campaign_meta')).toContain('planet_populations_json')
    expect(columnNames(db, 'campaign_meta')).toContain('activity_log_json')
    expect(columnNames(db, 'campaign_meta')).toContain('campaign_start_config_json')
    expect(columnNames(db, 'star_systems')).toContain('economic_profile_id')
    expect(columnNames(db, 'star_systems')).toContain('controlling_faction_id')
    expect(columnNames(db, 'planets')).toContain('economic_profile_id')
    expect(columnNames(db, 'price_history')).toContain('reason')
    expect(columnNames(db, 'ships')).toContain('definition_id')
    expect(columnNames(db, 'local_stockpiles')).toEqual(
      expect.arrayContaining(['market_id', 'item_id', 'quantity'])
    )

    const state = loadCampaign(db)
    expect(state.meta.name).toBe('Legacy Campaign')
    expect(state.meta.tick).toBe(12)
    expect(state.corporation.credits).toBe(100000)
    expect(state.definitions.systems).toHaveLength(1)
    expect(state.definitions.planets).toHaveLength(1)
    expect(state.definitions.items).toHaveLength(1)
    expect(state.definitions.economicProfiles).toEqual([])
    expect(state.definitions.ships).toEqual([])
    expect(state.definitions.economyConfig.populationFoodItemId).toBe('food')
    expect(state.planetPopulations.length).toBeGreaterThanOrEqual(0)
    expect(state.activityLog).toEqual([])
    expect(state.localStockpiles).toEqual([])
    // Legacy price rows survive the migration with no reason attached.
    expect(state.priceHistory).toEqual([
      { marketId: 'market_sys_a', itemId: 'ore', tick: 3, price: 11 }
    ])

    // v7 added the price_history indexes.
    const indexes = (
      db.prepare("PRAGMA index_list('price_history')").all() as Array<{ name: string }>
    ).map((r) => r.name)
    expect(indexes).toContain('idx_price_history_tick')

    const planetFks = (
      db.prepare("PRAGMA foreign_key_list('planets')").all() as Array<{ table: string; from: string }>
    ).map((r) => `${r.from}->${r.table}`)
    expect(planetFks).toContain('system_id->star_systems')

    db.close()
  })

  it('is idempotent: running migrations again changes nothing', () => {
    const db = buildV1Database()
    runMigrations(db)
    runMigrations(db)
    expect(db.pragma('user_version', { simple: true })).toBe(10)
    expect(() => loadCampaign(db)).not.toThrow()
    db.close()
  })
})
