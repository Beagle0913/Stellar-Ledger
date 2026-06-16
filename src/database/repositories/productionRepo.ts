import type { DB } from '../db.js'
import type { JobStatus, ProductionJob, TransportJob } from '../../shared/types.js'

// Persistence for production_jobs and transport_jobs.

export function loadProductionJobs(db: DB): ProductionJob[] {
  const rows = db
    .prepare('SELECT id, building_id, recipe_id, quantity, progress, duration, status FROM production_jobs')
    .all() as Array<{
    id: string
    building_id: string
    recipe_id: string
    quantity: number
    progress: number
    duration: number
    status: string
  }>
  return rows.map((r) => ({
    id: r.id,
    buildingId: r.building_id,
    recipeId: r.recipe_id,
    quantity: r.quantity,
    progress: r.progress,
    duration: r.duration,
    status: r.status as JobStatus
  }))
}

export function saveProductionJobs(db: DB, jobs: ProductionJob[]): void {
  db.prepare('DELETE FROM production_jobs').run()
  const stmt = db.prepare(
    'INSERT INTO production_jobs (id, building_id, recipe_id, quantity, progress, duration, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
  )
  for (const j of jobs) {
    stmt.run(j.id, j.buildingId, j.recipeId, j.quantity, j.progress, j.duration, j.status)
  }
}

export function loadTransportJobs(db: DB): TransportJob[] {
  const rows = db
    .prepare(
      'SELECT id, ship_id, origin_system_id, destination_system_id, item_id, quantity, progress, distance, fuel_cost, status, owner_id FROM transport_jobs'
    )
    .all() as Array<{
    id: string
    ship_id: string
    origin_system_id: string
    destination_system_id: string
    item_id: string
    quantity: number
    progress: number
    distance: number
    fuel_cost: number
    status: string
    owner_id: string
  }>
  return rows.map((r) => ({
    id: r.id,
    shipId: r.ship_id,
    originSystemId: r.origin_system_id,
    destinationSystemId: r.destination_system_id,
    itemId: r.item_id,
    quantity: r.quantity,
    progress: r.progress,
    distance: r.distance,
    fuelCost: r.fuel_cost,
    status: r.status as JobStatus,
    ownerId: r.owner_id
  }))
}

export function saveTransportJobs(db: DB, jobs: TransportJob[]): void {
  db.prepare('DELETE FROM transport_jobs').run()
  const stmt = db.prepare(
    'INSERT INTO transport_jobs (id, ship_id, origin_system_id, destination_system_id, item_id, quantity, progress, distance, fuel_cost, status, owner_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  )
  for (const j of jobs) {
    stmt.run(
      j.id,
      j.shipId,
      j.originSystemId,
      j.destinationSystemId,
      j.itemId,
      j.quantity,
      j.progress,
      j.distance,
      j.fuelCost,
      j.status,
      j.ownerId
    )
  }
}
