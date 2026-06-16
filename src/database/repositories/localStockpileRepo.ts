import type { DB } from '../db.js'

import type { LocalStockpileRow } from '../../shared/types.js'



export function loadLocalStockpiles(db: DB): LocalStockpileRow[] {

  const rows = db

    .prepare('SELECT market_id, item_id, quantity FROM local_stockpiles')

    .all() as Array<{ market_id: string; item_id: string; quantity: number }>

  return rows.map((r) => ({

    marketId: r.market_id,

    itemId: r.item_id,

    quantity: r.quantity

  }))

}



export function saveLocalStockpiles(db: DB, stockpiles: LocalStockpileRow[]): void {

  const tx = db.transaction(() => {

    const existing = db

      .prepare('SELECT market_id, item_id FROM local_stockpiles')

      .all() as Array<{ market_id: string; item_id: string }>

    const nextKeys = new Set(stockpiles.map((s) => `${s.marketId}\0${s.itemId}`))

    const del = db.prepare('DELETE FROM local_stockpiles WHERE market_id = ? AND item_id = ?')

    for (const row of existing) {

      const key = `${row.market_id}\0${row.item_id}`

      if (!nextKeys.has(key)) del.run(row.market_id, row.item_id)

    }

    const upsert = db.prepare(`

      INSERT INTO local_stockpiles (market_id, item_id, quantity)

      VALUES (?, ?, ?)

      ON CONFLICT(market_id, item_id) DO UPDATE SET quantity = excluded.quantity

    `)

    for (const s of stockpiles) {

      upsert.run(s.marketId, s.itemId, s.quantity)

    }

  })

  tx()

}

