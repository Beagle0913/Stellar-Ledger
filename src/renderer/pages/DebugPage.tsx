import React, { useMemo, useState } from 'react'

import { api } from '../api'

import { useApp } from '../App'

import { useCampaignAsync } from '../hooks'

import { DataTable } from '../components/DataTable'

import { LOG_CATEGORY_LABELS } from '../../shared/gameLog'

import type { DebugStateView, GameLogCategory, GameLogEntry } from '../../shared/types'



const ALL_CATEGORIES: GameLogCategory[] = [

  'system',

  'tick',

  'production',

  'transport',

  'market',

  'trade',

  'economy',

  'regional',

  'population',

  'event',

  'player',

  'contract',

  'mod'

]



export function DebugPage(): React.JSX.Element {

  const { token } = useApp()

  const debug = useCampaignAsync<DebugStateView>(() => api.getDebugState(), [token])

  const activity = useCampaignAsync<GameLogEntry[]>(() => api.getActivityLog(500), [token])

  const [categoryFilter, setCategoryFilter] = useState<GameLogCategory | 'all'>('all')

  const d = debug.data



  const filteredLog = useMemo(() => {

    const rows = activity.data ?? []

    if (categoryFilter === 'all') return rows

    return rows.filter((e) => e.category === categoryFilter)

  }, [activity.data, categoryFilter])



  return (

    <div>

      <h2>Debug (dev)</h2>

      <p className="muted">Read-only economy snapshot and full activity log for mod and balance debugging.</p>
      {d && (d.loadWarnings?.length ?? 0) > 0 && (
        <div className="panel">
          <h3>Save load warnings</h3>
          <ul>
            {d.loadWarnings!.map((w) => (
              <li key={w} className="error">
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {debug.error && <div className="error">{debug.error}</div>}

      {activity.error && <div className="error">{activity.error}</div>}

      {(d?.npcCorporations.length ?? 0) > 0 && (
        <div className="panel">
          <h3>NPC corporations ({d!.npcCorporations.length})</h3>
          {d!.npcCorporations.map((corp) => (
            <div key={corp.id} className="panel" style={{ marginTop: 12 }}>
              <h4>
                {corp.name} <span className="mono">({corp.id})</span>
              </h4>
              <p className="muted">
                {corp.aiProfile ?? 'unknown'} · {Math.round(corp.credits).toLocaleString()} cr · home{' '}
                {corp.homeSystemName}
              </p>
              <p className="hint">
                Inventory {corp.inventory.length} · Buildings {corp.buildings.length} · Ships{' '}
                {corp.ships.length} · Orders {corp.orders.length}
              </p>
              {corp.inventory.length > 0 && (
                <DataTable
                  rows={corp.inventory}
                  rowKey={(r) => `${r.systemId}:${r.itemId}`}
                  columns={[
                    { key: 'sys', header: 'System', render: (r) => r.systemName },
                    { key: 'item', header: 'Item', render: (r) => r.itemName },
                    { key: 'qty', header: 'Qty', numeric: true, render: (r) => r.quantity }
                  ]}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="panel">

        <div className="panel-head">

          <h3>Activity log ({filteredLog.length})</h3>

          <select

            value={categoryFilter}

            onChange={(e) => setCategoryFilter(e.target.value as GameLogCategory | 'all')}

          >

            <option value="all">All categories</option>

            {ALL_CATEGORIES.map((cat) => (

              <option key={cat} value={cat}>

                {LOG_CATEGORY_LABELS[cat]}

              </option>

            ))}

          </select>

        </div>

        <p className="hint">

          Persistent log (up to 500 entries). Set <code>GE_DEBUG=1</code> in the main process for console

          mirroring.

        </p>

        <DataTable<GameLogEntry>

          rows={filteredLog.slice(0, 200)}

          rowKey={(r) => r.id}

          empty="No log entries yet. Run ticks or take actions."

          columns={[

            { key: 'tick', header: 'Day', numeric: true, render: (r) => r.tick },

            {

              key: 'cat',

              header: 'Category',

              render: (r) => (

                <span className={`log-cat log-cat-${r.category}`}>

                  {LOG_CATEGORY_LABELS[r.category] ?? r.category}

                </span>

              )

            },

            { key: 'msg', header: 'Message', render: (r) => r.message }

          ]}

        />

      </div>



      <div className="panel">

        <h3>Regional stockpiles ({d?.localStockpiles.length ?? 0})</h3>

        <DataTable

          rows={d?.localStockpiles ?? []}

          rowKey={(r) => `${r.marketId}:${r.itemId}`}

          empty="No stockpile rows."

          columns={[

            { key: 'market', header: 'Market', render: (r) => r.marketId },

            { key: 'item', header: 'Item', render: (r) => r.itemId },

            { key: 'qty', header: 'Qty', numeric: true, render: (r) => r.quantity }

          ]}

        />

      </div>



      <div className="panel">

        <h3>NPC orders ({d?.npcOrders.length ?? 0})</h3>

        <DataTable

          rows={d?.npcOrders ?? []}

          rowKey={(r) => `${r.marketId}:${r.itemId}:${r.side}:${r.price}`}

          empty="No NPC orders."

          columns={[

            { key: 'market', header: 'Market', render: (r) => r.marketId },

            { key: 'item', header: 'Item', render: (r) => r.itemId },

            { key: 'side', header: 'Side', render: (r) => r.side },

            { key: 'price', header: 'Price', numeric: true, render: (r) => r.price },

            { key: 'rem', header: 'Remaining', numeric: true, render: (r) => r.remainingQuantity }

          ]}

        />

      </div>



      <div className="panel">

        <h3>Recent prices ({d?.recentPrices.length ?? 0})</h3>

        <DataTable

          rows={d?.recentPrices ?? []}

          rowKey={(r) => `${r.marketId}:${r.itemId}:${r.tick}:${r.price}`}

          empty="No price history."

          columns={[

            { key: 'market', header: 'Market', render: (r) => r.marketId },

            { key: 'item', header: 'Item', render: (r) => r.itemId },

            { key: 'tick', header: 'Day', numeric: true, render: (r) => r.tick },

            { key: 'price', header: 'Price', numeric: true, render: (r) => r.price },

            { key: 'reason', header: 'Reason', render: (r) => r.reason ?? '—' }

          ]}

        />

      </div>

    </div>

  )

}

