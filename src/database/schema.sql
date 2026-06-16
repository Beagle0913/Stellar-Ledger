-- SQLite schema for a single campaign save file.
-- Definition tables (item/recipe/building/system/planet) hold a FROZEN snapshot
-- of the mod content that was loaded when the campaign was created, so the save
-- is protected if the player's mods change later. Mutable state lives in the
-- remaining tables.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS campaign_meta (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  tick          INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL,
  ticking       INTEGER NOT NULL DEFAULT 0,
  game_version  TEXT NOT NULL,
  -- factions and events have no dedicated tables in the prototype; their frozen
  -- definitions are stored here as JSON.
  factions_json TEXT NOT NULL DEFAULT '[]',
  events_json   TEXT NOT NULL DEFAULT '[]',
  economic_profiles_json TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS corporations (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  credits        REAL NOT NULL,
  home_system_id TEXT NOT NULL
);

-- ---- Frozen definition tables ------------------------------------------------

CREATE TABLE IF NOT EXISTS star_systems (
  id                   TEXT PRIMARY KEY,
  name                 TEXT NOT NULL,
  x                    REAL NOT NULL,
  y                    REAL NOT NULL,
  economic_profile_id  TEXT
);

CREATE TABLE IF NOT EXISTS planets (
  id                   TEXT PRIMARY KEY,
  name                 TEXT NOT NULL,
  system_id            TEXT NOT NULL,
  planet_type          TEXT NOT NULL,
  habitability         REAL NOT NULL,
  mineral_richness     REAL NOT NULL,
  fertility            REAL NOT NULL,
  energy_potential     REAL NOT NULL,
  population           INTEGER NOT NULL,
  modifiers_json       TEXT NOT NULL DEFAULT '{}',
  economic_profile_id  TEXT
);

CREATE TABLE IF NOT EXISTS item_definitions (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  category   TEXT NOT NULL,
  base_value REAL NOT NULL,
  volume     REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS recipe_definitions (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  building_type TEXT NOT NULL,
  duration      INTEGER NOT NULL,
  extraction    INTEGER NOT NULL DEFAULT 0,
  yield_stat    TEXT
);

CREATE TABLE IF NOT EXISTS recipe_inputs (
  recipe_id TEXT NOT NULL,
  item_id   TEXT NOT NULL,
  quantity  REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS recipe_outputs (
  recipe_id TEXT NOT NULL,
  item_id   TEXT NOT NULL,
  quantity  REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS building_definitions (
  id                   TEXT PRIMARY KEY,
  name                 TEXT NOT NULL,
  build_cost           REAL NOT NULL,
  build_materials_json TEXT NOT NULL DEFAULT '[]'
);

-- ---- Mutable runtime state ---------------------------------------------------

CREATE TABLE IF NOT EXISTS buildings (
  id            TEXT PRIMARY KEY,
  definition_id TEXT NOT NULL,
  planet_id     TEXT NOT NULL,
  owner_id      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS inventories (
  owner_id  TEXT NOT NULL,
  system_id TEXT NOT NULL,
  item_id   TEXT NOT NULL,
  quantity  REAL NOT NULL,
  reserved  REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (owner_id, system_id, item_id)
);

CREATE TABLE IF NOT EXISTS markets (
  id        TEXT PRIMARY KEY,
  system_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS market_orders (
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

CREATE TABLE IF NOT EXISTS price_history (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  market_id TEXT NOT NULL,
  item_id   TEXT NOT NULL,
  tick      INTEGER NOT NULL,
  price     REAL NOT NULL,
  reason    TEXT
);

CREATE TABLE IF NOT EXISTS local_stockpiles (
  market_id TEXT NOT NULL,
  item_id   TEXT NOT NULL,
  quantity  REAL NOT NULL,
  PRIMARY KEY (market_id, item_id)
);

CREATE TABLE IF NOT EXISTS ships (
  id                   TEXT PRIMARY KEY,
  name                 TEXT NOT NULL,
  definition_id        TEXT,
  cargo_capacity       REAL NOT NULL,
  fuel_use_per_distance REAL NOT NULL,
  speed                REAL NOT NULL,
  current_system_id    TEXT NOT NULL,
  owner_id             TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transport_jobs (
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

CREATE TABLE IF NOT EXISTS production_jobs (
  id          TEXT PRIMARY KEY,
  building_id TEXT NOT NULL,
  recipe_id   TEXT NOT NULL,
  quantity    REAL NOT NULL,
  progress    REAL NOT NULL,
  duration    REAL NOT NULL,
  status      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events_log (
  id       TEXT PRIMARY KEY,
  tick     INTEGER NOT NULL,
  event_id TEXT NOT NULL,
  message  TEXT NOT NULL
);

-- ---- Indexes -----------------------------------------------------------------
-- price_history is persisted incrementally by tick (see marketRepo), so an index
-- on tick keeps MAX(tick) and the retention/re-sync DELETEs O(log n) instead of
-- full scans on large saves.
CREATE INDEX IF NOT EXISTS idx_price_history_tick ON price_history(tick);
CREATE INDEX IF NOT EXISTS idx_price_history_market_item ON price_history(market_id, item_id);
