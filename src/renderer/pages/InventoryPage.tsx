import React from 'react'
import { api } from '../api'
import { useApp } from '../App'
import { useCampaignAsync } from '../hooks'
import { DataTable } from '../components/DataTable'
import type { InventoryView } from '../../shared/types'

interface SystemGroup {
  systemId: string
  systemName: string
  rows: InventoryView[]
  totalUnits: number
}

/** Group flat inventory rows by system so holdings read as a per-location ledger. */
function groupBySystem(rows: InventoryView[]): SystemGroup[] {
  const map = new Map<string, SystemGroup>()
  for (const r of rows) {
    let g = map.get(r.systemId)
    if (!g) {
      g = { systemId: r.systemId, systemName: r.systemName, rows: [], totalUnits: 0 }
      map.set(r.systemId, g)
    }
    g.rows.push(r)
    g.totalUnits += r.quantity
  }
  for (const g of map.values()) {
    g.rows.sort((a, b) => a.itemName.localeCompare(b.itemName))
  }
  return [...map.values()].sort((a, b) => a.systemName.localeCompare(b.systemName))
}

export function InventoryPage(): React.JSX.Element {
  const { token } = useApp()
  const inv = useCampaignAsync<InventoryView[]>(() => api.getInventory(), [token])
  const groups = groupBySystem(inv.data ?? [])

  return (
    <div>
      <h2>Inventory</h2>
      {inv.error && <div className="error">{inv.error}</div>}

      {groups.length === 0 && !inv.loading && (
        <div className="panel">
          <p className="muted">Inventory is empty.</p>
        </div>
      )}

      {groups.map((g) => (
        <div className="panel" key={g.systemId}>
          <div className="panel-head">
            <h3>{g.systemName}</h3>
            <span className="muted mono">{g.totalUnits.toLocaleString()} units total</span>
          </div>
          <DataTable<InventoryView>
            rows={g.rows}
            rowKey={(r) => `${r.systemId}:${r.itemId}`}
            empty="Nothing stored here."
            columns={[
              { key: 'item', header: 'Item', render: (r) => r.itemName },
              { key: 'qty', header: 'Quantity', numeric: true, render: (r) => r.quantity },
              {
                key: 'reserved',
                header: 'Reserved',
                numeric: true,
                render: (r) => (r.reserved > 0 ? r.reserved : '—')
              },
              {
                key: 'free',
                header: 'Available',
                numeric: true,
                render: (r) => r.quantity - r.reserved
              }
            ]}
          />
        </div>
      ))}
    </div>
  )
}
