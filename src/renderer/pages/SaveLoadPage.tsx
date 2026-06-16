import React, { useState } from 'react'
import { api } from '../api'
import { useApp } from '../App'
import { useAsync } from '../hooks'
import { DataTable } from '../components/DataTable'
import type { SaveSummary } from '../../shared/types'

export function SaveLoadPage(): React.JSX.Element {
  const { navigate, refresh, setCampaignActive, campaignActive, handleApiError } = useApp()
  const [name, setName] = useState('New Campaign')
  const [error, setError] = useState<string | null>(null)
  const saves = useAsync<SaveSummary[]>(() => api.listSaves(), [])

  async function create(): Promise<void> {
    setError(null)
    try {
      await api.createNewCampaign(name)
      setCampaignActive(true)
      refresh()
      navigate('dashboard')
    } catch (e) {
      const msg = handleApiError(e)
      if (msg) setError(msg)
    }
  }

  async function load(fileName: string): Promise<void> {
    setError(null)
    try {
      await api.loadCampaign(fileName)
      setCampaignActive(true)
      refresh()
      navigate('dashboard')
    } catch (e) {
      const msg = handleApiError(e)
      if (msg) setError(msg)
    }
  }

  async function save(): Promise<void> {
    setError(null)
    try {
      await api.saveCurrent()
      saves.reload()
    } catch (e) {
      const msg = handleApiError(e)
      if (msg) setError(msg)
    }
  }

  async function remove(fileName: string): Promise<void> {
    if (!confirm(`Delete save "${fileName}"? This cannot be undone.`)) return
    setError(null)
    try {
      await api.deleteSave(fileName)
      saves.reload()
    } catch (e) {
      const msg = handleApiError(e)
      if (msg) setError(msg)
    }
  }

  async function rename(r: { fileName: string; name: string }): Promise<void> {
    const newName = prompt('New campaign name:', r.name)
    if (!newName || newName.trim() === '' || newName === r.name) return
    setError(null)
    try {
      await api.renameSave(r.fileName, newName)
      saves.reload()
    } catch (e) {
      const msg = handleApiError(e)
      if (msg) setError(msg)
    }
  }

  return (
    <div>
      <h2>Save / Load</h2>
      {error && <div className="error">{error}</div>}

      <div className="panel">
        <h3>New Campaign</h3>
        <div className="form-line">
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
          <button className="primary" onClick={() => void create()}>
            Create Campaign
          </button>
        </div>
        <p className="muted">
          Creates a fresh local SQLite save in <span className="mono">saves/</span> and freezes the
          currently loaded mod definitions into it.
        </p>
      </div>

      <div className="panel">
        <h3>Existing Saves</h3>
        <DataTable<SaveSummary>
          rows={saves.data ?? []}
          rowKey={(r) => r.fileName}
          empty="No saves yet."
          columns={[
            { key: 'name', header: 'Name', render: (r) => r.name },
            { key: 'file', header: 'File', render: (r) => <span className="mono">{r.fileName}</span> },
            { key: 'tick', header: 'Day', numeric: true, render: (r) => r.tick },
            {
              key: 'actions',
              header: '',
              render: (r) => (
                <>
                  <button onClick={() => void load(r.fileName)}>Load</button>{' '}
                  <button onClick={() => void rename(r)}>Rename</button>{' '}
                  <button onClick={() => void remove(r.fileName)}>Delete</button>
                </>
              )
            }
          ]}
        />
      </div>

      {campaignActive && (
        <div className="panel">
          <h3>Current Campaign</h3>
          <button onClick={() => void save()}>Save Now</button>
          <span className="muted">
            {' '}
            &nbsp;(state auto-saves on every tick; actions since the last tick are kept in memory
            until then)
          </span>
        </div>
      )}
    </div>
  )
}
