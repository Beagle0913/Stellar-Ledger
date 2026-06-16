import React, { useState } from 'react'
import { api } from '../api'
import { useApp } from '../context'
import { useAsync } from '../hooks'
import { DataTable } from '../components/DataTable'
import { StatCard } from '../components/StatCard'
import type { ModInfo, ModsView } from '../../shared/types'

export function ModsPage(): React.JSX.Element {
  const { handleApiError } = useApp()
  const mods = useAsync<ModsView>(() => api.getMods(), [])
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [busyReload, setBusyReload] = useState(false)
  const m = mods.data

  async function reloadFromDisk(): Promise<void> {
    setError(null)
    setBusyReload(true)
    try {
      await api.reloadModData()
      mods.reload()
    } catch (e) {
      const msg = handleApiError(e)
      if (msg) setError(msg)
    } finally {
      setBusyReload(false)
    }
  }

  async function toggle(mod: ModInfo): Promise<void> {
    if (mod.source === 'builtin') return
    setError(null)
    setBusyId(mod.id)
    try {
      await api.setModEnabled({ modId: mod.id, enabled: !mod.enabled })
      mods.reload()
    } catch (e) {
      const msg = handleApiError(e)
      if (msg) setError(msg)
    } finally {
      setBusyId(null)
    }
  }

  const counts = m?.newCampaignDefinitionCounts ?? m?.definitionCounts

  return (
    <div>
      <h2>Mods &amp; Data</h2>
      {mods.error && <div className="error">{mods.error}</div>}
      {error && <div className="error">{error}</div>}

      <p className="notice">
        Enable or disable external mods before starting a <strong>new campaign</strong>. Loaded saves
        keep the definitions frozen at creation — toggling mods here does not change an open save.
      </p>

      {m && m.hasActiveCampaign && (
        <p className="muted">
          Active campaign uses frozen definitions ({m.enabledModIds.length} mod
          {m.enabledModIds.length === 1 ? '' : 's'} were enabled at create time). Counts below show
          what a new campaign would use.
        </p>
      )}

      <div className="form-line" style={{ marginTop: 8 }}>
        <button disabled={busyReload} onClick={() => void reloadFromDisk()}>
          {busyReload ? 'Reloading…' : 'Reload mod data from disk'}
        </button>
        <span className="muted">Re-reads JSON without restarting the app. Open saves keep frozen definitions.</span>
      </div>

      {m && m.conflicts.length > 0 && (
        <div className="error" style={{ marginTop: 12 }}>
          <strong>Content conflicts</strong> (resolve before starting a new campaign):
          <ul className="ticklog">
            {m.conflicts.map((c) => (
              <li key={`${c.kind}:${c.id}`}>
                Duplicate {c.kind} <span className="mono">{c.id}</span> in mods: {c.modIds.join(', ')}
              </li>
            ))}
          </ul>
        </div>
      )}

      {m && m.loadOrder.length > 0 && (
        <p className="muted" style={{ marginTop: 12 }}>
          Load order:{' '}
          {m.loadOrder.map((id, i) => (
            <span key={id}>
              {i > 0 ? ' → ' : ''}
              <span className="mono">{id}</span>
            </span>
          ))}
        </p>
      )}

      {m && m.validationErrors.length > 0 && (
        <div className="error">{m.validationErrors.join('\n')}</div>
      )}
      {m && m.validationErrors.length === 0 && (
        <p className="notice">All discovered mods validated successfully.</p>
      )}

      {m && (
        <>
          <p className="muted">
            Active for new campaign:{' '}
            {m.enabledModIds.map((id) => (
              <span key={id} className="tag green" style={{ marginRight: 6 }}>
                {id}
              </span>
            ))}
          </p>
          <div className="stat-grid">
            <StatCard label="Items" value={counts?.items ?? 0} />
            <StatCard label="Recipes" value={counts?.recipes ?? 0} />
            <StatCard label="Buildings" value={counts?.buildings ?? 0} />
            <StatCard label="Systems" value={counts?.systems ?? 0} />
            <StatCard label="Planets" value={counts?.planets ?? 0} />
            <StatCard label="Factions" value={counts?.factions ?? 0} />
            <StatCard label="Events" value={counts?.events ?? 0} />
            <StatCard label="Economic Profiles" value={counts?.economicProfiles ?? 0} />
            <StatCard label="Ship Types" value={counts?.ships ?? 0} />
          </div>
        </>
      )}

      <div className="panel" style={{ marginTop: 16 }}>
        <h3>Discovered Mods</h3>
        <DataTable<ModInfo>
          rows={m?.mods ?? []}
          rowKey={(r) => r.id}
          columns={[
            { key: 'name', header: 'Name', render: (r) => r.name },
            { key: 'id', header: 'Id', render: (r) => <span className="mono">{r.id}</span> },
            { key: 'ver', header: 'Version', render: (r) => r.version },
            { key: 'author', header: 'Author', render: (r) => r.author },
            {
              key: 'src',
              header: 'Source',
              render: (r) => <span className="tag">{r.source}</span>
            },
            {
              key: 'state',
              header: 'State',
              render: (r) => (
                <span className={`tag ${r.enabled ? 'green' : 'red'}`}>
                  {r.enabled ? 'enabled' : 'disabled'}
                </span>
              )
            },
            {
              key: 'toggle',
              header: '',
              render: (r) =>
                r.source === 'builtin' ? (
                  <span className="muted">always on</span>
                ) : (
                  <button disabled={busyId === r.id} onClick={() => void toggle(r)}>
                    {r.enabled ? 'Disable' : 'Enable'}
                  </button>
                )
            },
            { key: 'desc', header: 'Description', render: (r) => r.description }
          ]}
        />
      </div>
    </div>
  )
}
