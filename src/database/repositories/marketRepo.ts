import type { DB } from '../db.js'
import type { Market, MarketOrder, OrderSide, PriceHistoryRow } from '../../shared/types.js'

// Persistence for markets, market_orders and price_history.

export function loadMarkets(db: DB): Market[] {
  const rows = db.prepare('SELECT id, system_id FROM markets').all() as Array<{
    id: string
    system_id: string
  }>
  return rows.map((r) => ({ id: r.id, systemId: r.system_id }))
}

export function saveMarkets(db: DB, markets: Market[]): void {
  db.prepare('DELETE FROM markets').run()
  const stmt = db.prepare('INSERT INTO markets (id, system_id) VALUES (?, ?)')
  for (const m of markets) stmt.run(m.id, m.systemId)
}

export function loadOrders(db: DB): MarketOrder[] {
  const rows = db
    .prepare(
      'SELECT id, market_id, item_id, side, quantity, remaining_quantity, price, owner_id, created_at FROM market_orders'
    )
    .all() as Array<{
    id: string
    market_id: string
    item_id: string
    side: string
    quantity: number
    remaining_quantity: number
    price: number
    owner_id: string
    created_at: number
  }>
  return rows.map((r) => ({
    id: r.id,
    marketId: r.market_id,
    itemId: r.item_id,
    side: r.side as OrderSide,
    quantity: r.quantity,
    remainingQuantity: r.remaining_quantity,
    price: r.price,
    ownerId: r.owner_id,
    createdAt: r.created_at
  }))
}

export function saveOrders(db: DB, orders: MarketOrder[]): void {
  const tx = db.transaction(() => {
    const existing = db.prepare('SELECT id FROM market_orders').all() as Array<{ id: string }>
    const nextIds = new Set(orders.map((o) => o.id))
    const del = db.prepare('DELETE FROM market_orders WHERE id = ?')
    for (const row of existing) {
      if (!nextIds.has(row.id)) del.run(row.id)
    }
    const upsert = db.prepare(`
      INSERT INTO market_orders (id, market_id, item_id, side, quantity, remaining_quantity, price, owner_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        market_id = excluded.market_id,
        item_id = excluded.item_id,
        side = excluded.side,
        quantity = excluded.quantity,
        remaining_quantity = excluded.remaining_quantity,
        price = excluded.price,
        owner_id = excluded.owner_id,
        created_at = excluded.created_at
    `)
    for (const o of orders) {
      upsert.run(
        o.id,
        o.marketId,
        o.itemId,
        o.side,
        o.quantity,
        o.remainingQuantity,
        o.price,
        o.ownerId,
        o.createdAt
      )
    }
  })
  tx()
}

export function loadPriceHistory(db: DB, sinceTick?: number): PriceHistoryRow[] {
  const rows = sinceTick
    ? (db
        .prepare(
          'SELECT market_id, item_id, tick, price, reason FROM price_history WHERE tick >= ? ORDER BY id'
        )
        .all(sinceTick) as Array<{
        market_id: string
        item_id: string
        tick: number
        price: number
        reason: string | null
      }>)
    : (db
        .prepare('SELECT market_id, item_id, tick, price, reason FROM price_history ORDER BY id')
        .all() as Array<{
        market_id: string
        item_id: string
        tick: number
        price: number
        reason: string | null
      }>)
  return rows.map((r) => ({
    marketId: r.market_id,
    itemId: r.item_id,
    tick: r.tick,
    price: r.price,
    ...(r.reason ? { reason: r.reason as PriceHistoryRow['reason'] } : {})
  }))
}

/**
 * Persist price history INCREMENTALLY. Price history is by far the largest
 * mutable table (markets x items x retained ticks) and is append-mostly: rows
 * for past ticks never change once written. Rewriting the whole table every tick
 * is O(total rows) and does not scale to large galaxies, so instead we:
 *   1. re-sync only rows at/after the last persisted tick (the current tick can
 *      gain rows between saves, e.g. from instant trades, so it must be redone),
 *   2. drop rows older than the in-memory retention window (mirrors the tick
 *      prune in tick.ts).
 * Rows strictly between those bounds are immutable and already persisted, so
 * they are left untouched. Requires the idx_price_history_tick index to be fast.
 */
export function savePriceHistory(db: DB, history: PriceHistoryRow[]): void {
  const maxRow = db.prepare('SELECT MAX(tick) AS m FROM price_history').get() as {
    m: number | null
  }
  const dbMaxTick = maxRow.m ?? -1

  db.prepare('DELETE FROM price_history WHERE tick >= ?').run(dbMaxTick)
  const stmt = db.prepare(
    'INSERT INTO price_history (market_id, item_id, tick, price, reason) VALUES (?, ?, ?, ?, ?)'
  )
  let minTick = Infinity
  for (const h of history) {
    if (h.tick < minTick) minTick = h.tick
    if (h.tick >= dbMaxTick) stmt.run(h.marketId, h.itemId, h.tick, h.price, h.reason ?? null)
  }

  if (history.length > 0 && Number.isFinite(minTick)) {
    db.prepare('DELETE FROM price_history WHERE tick < ?').run(minTick)
  }
}
