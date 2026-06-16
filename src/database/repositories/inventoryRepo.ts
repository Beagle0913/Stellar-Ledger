import type { DB } from '../db.js'
import type { InventoryRow } from '../../shared/types.js'

// Persistence for the inventories table. Save uses a wipe-and-reinsert strategy
// (simple and correct for a prototype's modest data sizes).

export function loadInventories(db: DB): InventoryRow[] {
  const rows = db
    .prepare('SELECT owner_id, system_id, item_id, quantity, reserved FROM inventories')
    .all() as Array<{
    owner_id: string
    system_id: string
    item_id: string
    quantity: number
    reserved: number
  }>
  return rows.map((r) => ({
    ownerId: r.owner_id,
    systemId: r.system_id,
    itemId: r.item_id,
    quantity: r.quantity,
    reserved: r.reserved
  }))
}

export function saveInventories(db: DB, inventories: InventoryRow[]): void {
  db.prepare('DELETE FROM inventories').run()
  const stmt = db.prepare(
    'INSERT INTO inventories (owner_id, system_id, item_id, quantity, reserved) VALUES (?, ?, ?, ?, ?)'
  )
  for (const row of inventories) {
    stmt.run(row.ownerId, row.systemId, row.itemId, row.quantity, row.reserved)
  }
}
