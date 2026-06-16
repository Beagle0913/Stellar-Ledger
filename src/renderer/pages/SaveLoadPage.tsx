import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import { useApp } from '../App'
import { useAsync } from '../hooks'
import { DataTable } from '../components/DataTable'
import type { SaveSummary, ScenarioSummary } from '../../shared/types'

export function SaveLoadPage(): React.JSX.Element {
  const { navigate, refresh, setCampaignActive, campaignActive, handleApiError } = useApp()
  const [name, setName] = useState('New Campaign')
  const [scenarioId, setScenarioId] = useState('standard')
  const [error, setError] = useState<string | null>(null)
  const saves = useAsync<SaveSummary[]>(() => api.listSaves(), [])
  const scenarios = useAsync<ScenarioSummary[]>(() => api.listScenarios(), [])

  useEffect(() => {
    if (scenarios.data?.length && !scenarios.data.some((s) => s.id === scenarioId)) {
      setScenarioId(scenarios.data[0]!.id)
    }
  }, [scenarios.data, scenarioId])

  const selectedScenario = useMemo(
    () => scenarios.data?.find((s) => s.id === scenarioId) ?? null,
    [scenarios.data, scenarioId]
  )

  async function create(): Promise<void> {
    setError(null)
    try {
      await api.createNewCampaign({ name, scenarioId })
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

  const start = selectedScenario?.campaignStart

  return (
    <div>
      <h2>Save / Load</h2>
      {error && <div className="error">{error}</div>}

      <div className="panel">
        <h3>New Campaign</h3>
        <div className="form-line">
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="form-line">
          <label>Scenario</label>
          <select value={scenarioId} onChange={(e) => setScenarioId(e.target.value)}>
            {(scenarios.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.difficulty})
              </option>
            ))}
          </select>
          <button className="primary" onClick={() => void create()}>
            Create Campaign
          </button>
        </div>
        {selectedScenario && (
          <div className="panel" style={{ marginTop: 12, padding: 12 }}>
            <div className="badges" style={{ marginBottom: 8 }}>
              <span className="tag">{selectedScenario.difficulty}</span>
            </div>
            <p>{selectedScenario.description}</p>
            <ul className="ticklog">
              <li>
                Starting credits:{' '}
                <span className="mono">
                  {(start?.startingCredits ?? 38_000).toLocaleString()} cr
                </span>
              </li>
              {start?.startingBuildingTypes && (
                <li>
                  Buildings:{' '}
                  <span className="mono">{start.startingBuildingTypes.join(', ')}</span>
                </li>
              )}
              {start?.startingStock && (
                <li>
                  Stock highlights:{' '}
                  <span className="mono">
                    {Object.entries(start.startingStock)
                      .slice(0, 5)
                      .map(([k, v]) => `${k} ${v}`)
                      .join(' · ')}
                  </span>
                </li>
              )}
              {start?.homeSystemId && (
                <li>
                  Home system: <span className="mono">{start.homeSystemId}</span>
                </li>
              )}
            </ul>
          </div>
        )}
        <p className="muted">
          Creates a fresh local SQLite save in <span className="mono">saves/</span> and freezes the
          currently loaded mod definitions into it. Scenario settings are snapshotted into the save.
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
            {
              key: 'scenario',
              header: 'Scenario',
              render: (r) => r.scenarioName ?? 'Standard'
            },
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
