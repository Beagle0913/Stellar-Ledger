import type { DB } from '../db.js'
import { parseStoredActivityLog, parseStoredPlanetPopulations } from '../saveValidation.js'
import type {
  BuildingInstance,
  EventLogEntry,
  GameLogEntry,
  PlanetDefinition,
  PlanetPopulationRow,
  Ship
} from '../../shared/types.js'

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
