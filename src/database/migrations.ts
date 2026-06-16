import type DatabaseType from 'better-sqlite3'
import schemaSql from './schema.sql?raw'

// Schema migrations, run in version order. Each entry upgrades a database that
// is currently at `version - 1` up to `version`. Fresh databases start at
// user_version 0 and run every migration (version 1 applies the full schema,
// which already includes later additions via CREATE IF NOT EXISTS / column
// guards in subsequent steps).

function tableHasColumn(db: DatabaseType.Database, table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  return rows.some((r) => r.name === column)
}

function migrateV1ToV2(db: DatabaseType.Database): void {
  if (!tableHasColumn(db, 'campaign_meta', 'economic_profiles_json')) {
    db.exec(
      "ALTER TABLE campaign_meta ADD COLUMN economic_profiles_json TEXT NOT NULL DEFAULT '[]'"
    )
  }
  if (!tableHasColumn(db, 'star_systems', 'economic_profile_id')) {
    db.exec('ALTER TABLE star_systems ADD COLUMN economic_profile_id TEXT')
  }
  if (!tableHasColumn(db, 'planets', 'economic_profile_id')) {
    db.exec('ALTER TABLE planets ADD COLUMN economic_profile_id TEXT')
  }
  if (!tableHasColumn(db, 'price_history', 'reason')) {
    db.exec('ALTER TABLE price_history ADD COLUMN reason TEXT')
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS local_stockpiles (
      market_id TEXT NOT NULL,
      item_id   TEXT NOT NULL,
      quantity  REAL NOT NULL,
      PRIMARY KEY (market_id, item_id)
    )
  `)
}

function migrateV2ToV3(db: DatabaseType.Database): void {
  if (!tableHasColumn(db, 'campaign_meta', 'ships_json')) {
    db.exec("ALTER TABLE campaign_meta ADD COLUMN ships_json TEXT NOT NULL DEFAULT '[]'")
  }
  if (!tableHasColumn(db, 'star_systems', 'controlling_faction_id')) {
    db.exec('ALTER TABLE star_systems ADD COLUMN controlling_faction_id TEXT')
  }
}

function migrateV3ToV4(db: DatabaseType.Database): void {
  if (!tableHasColumn(db, 'campaign_meta', 'progression_json')) {
    db.exec("ALTER TABLE campaign_meta ADD COLUMN progression_json TEXT NOT NULL DEFAULT '{}'")
  }
  if (!tableHasColumn(db, 'campaign_meta', 'objectives_json')) {
    db.exec("ALTER TABLE campaign_meta ADD COLUMN objectives_json TEXT NOT NULL DEFAULT '[]'")
  }
  if (!tableHasColumn(db, 'campaign_meta', 'contract_templates_json')) {
    db.exec(
      "ALTER TABLE campaign_meta ADD COLUMN contract_templates_json TEXT NOT NULL DEFAULT '[]'"
    )
  }
}

function migrateV4ToV5(db: DatabaseType.Database): void {
  if (!tableHasColumn(db, 'campaign_meta', 'economy_config_json')) {
    db.exec("ALTER TABLE campaign_meta ADD COLUMN economy_config_json TEXT NOT NULL DEFAULT '{}'")
  }
  if (!tableHasColumn(db, 'campaign_meta', 'planet_populations_json')) {
    db.exec("ALTER TABLE campaign_meta ADD COLUMN planet_populations_json TEXT NOT NULL DEFAULT '[]'")
  }
}

function migrateV5ToV6(db: DatabaseType.Database): void {
  if (!tableHasColumn(db, 'campaign_meta', 'activity_log_json')) {
    db.exec("ALTER TABLE campaign_meta ADD COLUMN activity_log_json TEXT NOT NULL DEFAULT '[]'")
  }
}

function migrateV6ToV7(db: DatabaseType.Database): void {
  // Indexes that support incremental price-history persistence and lookups.
  db.exec('CREATE INDEX IF NOT EXISTS idx_price_history_tick ON price_history(tick)')
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_price_history_market_item ON price_history(market_id, item_id)'
  )
}

function migrateV7ToV8(db: DatabaseType.Database): void {
  // Track which ship definition each instance was built from (own_asset contracts).
  if (!tableHasColumn(db, 'ships', 'definition_id')) {
    db.exec('ALTER TABLE ships ADD COLUMN definition_id TEXT')
  }
}

function migrateV8ToV9(db: DatabaseType.Database): void {
  if (!tableHasColumn(db, 'campaign_meta', 'campaign_start_config_json')) {
    db.exec(
      "ALTER TABLE campaign_meta ADD COLUMN campaign_start_config_json TEXT NOT NULL DEFAULT '{}'"
    )
  }
}

function tableHasForeignKeys(db: DatabaseType.Database, table: string): boolean {
  const rows = db.prepare(`PRAGMA foreign_key_list(${table})`).all() as Array<{ id: number }>
  return rows.length > 0
}

/** Rebuild runtime tables with referential integrity (SQLite cannot ADD FK via ALTER). */
function migrateV9ToV10(db: DatabaseType.Database): void {
  if (tableHasForeignKeys(db, 'planets')) return

  db.pragma('foreign_keys = OFF')
  const run = db.transaction(() => {
    db.exec(`
      CREATE TABLE production_jobs__fk (
        id          TEXT PRIMARY KEY,
        building_id TEXT NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
        recipe_id   TEXT NOT NULL REFERENCES recipe_definitions(id),
        quantity    REAL NOT NULL,
        progress    REAL NOT NULL,
        duration    REAL NOT NULL,
        status      TEXT NOT NULL
      );
      INSERT INTO production_jobs__fk SELECT id, building_id, recipe_id, quantity, progress, duration, status FROM production_jobs;
      DROP TABLE production_jobs;
      ALTER TABLE production_jobs__fk RENAME TO production_jobs;

      CREATE TABLE transport_jobs__fk (
        id                    TEXT PRIMARY KEY,
        ship_id               TEXT NOT NULL REFERENCES ships(id) ON DELETE CASCADE,
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
      INSERT INTO transport_jobs__fk SELECT id, ship_id, origin_system_id, destination_system_id, item_id, quantity, progress, distance, fuel_cost, status, owner_id FROM transport_jobs;
      DROP TABLE transport_jobs;
      ALTER TABLE transport_jobs__fk RENAME TO transport_jobs;

      CREATE TABLE market_orders__fk (
        id                 TEXT PRIMARY KEY,
        market_id          TEXT NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
        item_id            TEXT NOT NULL,
        side               TEXT NOT NULL,
        quantity           REAL NOT NULL,
        remaining_quantity REAL NOT NULL,
        price              REAL NOT NULL,
        owner_id           TEXT NOT NULL,
        created_at         INTEGER NOT NULL
      );
      INSERT INTO market_orders__fk SELECT id, market_id, item_id, side, quantity, remaining_quantity, price, owner_id, created_at FROM market_orders;
      DROP TABLE market_orders;
      ALTER TABLE market_orders__fk RENAME TO market_orders;

      CREATE TABLE price_history__fk (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        market_id TEXT NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
        item_id   TEXT NOT NULL,
        tick      INTEGER NOT NULL,
        price     REAL NOT NULL,
        reason    TEXT
      );
      INSERT INTO price_history__fk (id, market_id, item_id, tick, price, reason)
        SELECT id, market_id, item_id, tick, price, reason FROM price_history;
      DROP TABLE price_history;
      ALTER TABLE price_history__fk RENAME TO price_history;

      CREATE TABLE local_stockpiles__fk (
        market_id TEXT NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
        item_id   TEXT NOT NULL,
        quantity  REAL NOT NULL,
        PRIMARY KEY (market_id, item_id)
      );
      INSERT INTO local_stockpiles__fk SELECT market_id, item_id, quantity FROM local_stockpiles;
      DROP TABLE local_stockpiles;
      ALTER TABLE local_stockpiles__fk RENAME TO local_stockpiles;

      CREATE TABLE buildings__fk (
        id            TEXT PRIMARY KEY,
        definition_id TEXT NOT NULL REFERENCES building_definitions(id),
        planet_id     TEXT NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
        owner_id      TEXT NOT NULL
      );
      INSERT INTO buildings__fk SELECT id, definition_id, planet_id, owner_id FROM buildings;
      DROP TABLE buildings;
      ALTER TABLE buildings__fk RENAME TO buildings;

      CREATE TABLE markets__fk (
        id        TEXT PRIMARY KEY,
        system_id TEXT NOT NULL REFERENCES star_systems(id) ON DELETE CASCADE
      );
      INSERT INTO markets__fk SELECT id, system_id FROM markets;
      DROP TABLE markets;
      ALTER TABLE markets__fk RENAME TO markets;

      CREATE TABLE planets__fk (
        id                   TEXT PRIMARY KEY,
        name                 TEXT NOT NULL,
        system_id            TEXT NOT NULL REFERENCES star_systems(id) ON DELETE CASCADE,
        planet_type          TEXT NOT NULL,
        habitability         REAL NOT NULL,
        mineral_richness     REAL NOT NULL,
        fertility            REAL NOT NULL,
        energy_potential     REAL NOT NULL,
        population           INTEGER NOT NULL,
        modifiers_json       TEXT NOT NULL DEFAULT '{}',
        economic_profile_id  TEXT
      );
      INSERT INTO planets__fk SELECT id, name, system_id, planet_type, habitability, mineral_richness, fertility, energy_potential, population, modifiers_json, economic_profile_id FROM planets;
      DROP TABLE planets;
      ALTER TABLE planets__fk RENAME TO planets;

      CREATE TABLE corporations__fk (
        id             TEXT PRIMARY KEY,
        name           TEXT NOT NULL,
        credits        REAL NOT NULL,
        home_system_id TEXT NOT NULL REFERENCES star_systems(id)
      );
      INSERT INTO corporations__fk SELECT id, name, credits, home_system_id FROM corporations;
      DROP TABLE corporations;
      ALTER TABLE corporations__fk RENAME TO corporations;
    `)

    db.exec('CREATE INDEX IF NOT EXISTS idx_price_history_tick ON price_history(tick)')
    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_price_history_market_item ON price_history(market_id, item_id)'
    )
  })
  run()
  db.pragma('foreign_keys = ON')
}

function migrateV10ToV11(db: DatabaseType.Database): void {
  if (!tableHasColumn(db, 'campaign_meta', 'scenario_id')) {
    db.exec("ALTER TABLE campaign_meta ADD COLUMN scenario_id TEXT NOT NULL DEFAULT 'standard'")
  }
  if (!tableHasColumn(db, 'campaign_meta', 'scenario_name')) {
    db.exec("ALTER TABLE campaign_meta ADD COLUMN scenario_name TEXT NOT NULL DEFAULT 'Standard'")
  }
  if (!tableHasColumn(db, 'campaign_meta', 'scenario_difficulty')) {
    db.exec("ALTER TABLE campaign_meta ADD COLUMN scenario_difficulty TEXT NOT NULL DEFAULT 'normal'")
  }
  if (!tableHasColumn(db, 'campaign_meta', 'scenario_config_json')) {
    db.exec('ALTER TABLE campaign_meta ADD COLUMN scenario_config_json TEXT')
  }
}

function migrateV11ToV12(db: DatabaseType.Database): void {
  if (!tableHasColumn(db, 'campaign_meta', 'player_corporation_id')) {
    db.exec('ALTER TABLE campaign_meta ADD COLUMN player_corporation_id TEXT')
    db.exec(`
      UPDATE campaign_meta
      SET player_corporation_id = (
        SELECT id FROM corporations ORDER BY id LIMIT 1
      )
      WHERE player_corporation_id IS NULL
    `)
  }
}

interface Migration {
  version: number
  migrate(db: DatabaseType.Database): void
}

/** Ordered migration list; the last entry's version is the current schema version. */
const MIGRATIONS: Migration[] = [
  { version: 1, migrate: (db) => db.exec(schemaSql) },
  { version: 2, migrate: migrateV1ToV2 },
  { version: 3, migrate: migrateV2ToV3 },
  { version: 4, migrate: migrateV3ToV4 },
  { version: 5, migrate: migrateV4ToV5 },
  { version: 6, migrate: migrateV5ToV6 },
  { version: 7, migrate: migrateV6ToV7 },
  { version: 8, migrate: migrateV7ToV8 },
  { version: 9, migrate: migrateV8ToV9 },
  { version: 10, migrate: migrateV9ToV10 },
  { version: 11, migrate: migrateV10ToV11 },
  { version: 12, migrate: migrateV11ToV12 }
]

const SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1]!.version

/** Bring a database up to the current schema version. Safe to call on every open. */
export function runMigrations(db: DatabaseType.Database): void {
  const current = db.pragma('user_version', { simple: true }) as number
  for (const migration of MIGRATIONS) {
    if (migration.version <= current) continue
    migration.migrate(db)
  }
  db.pragma(`user_version = ${SCHEMA_VERSION}`)
}
