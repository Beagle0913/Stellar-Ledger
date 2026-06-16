import React, { useState } from 'react'
import { api } from '../api'
import { useApp } from '../context'
import { useCampaignAsync } from '../hooks'
import { DataTable } from '../components/DataTable'
import { StatusBanner } from '../components/StatusBanner'
import { StatCard } from '../components/StatCard'
import type { BuildableView, PlanetBuildingView, PlanetDetail } from '../../shared/types'

export function PlanetPage(): React.JSX.Element {
  const { selectedPlanetId, navigate, refresh, token, handleApiError } = useApp()
  const [error, setError] = useState<string | null>(null)
  const detail = useCampaignAsync<PlanetDetail | null>(
    () => (selectedPlanetId ? api.getPlanet(selectedPlanetId) : Promise.resolve(null)),
    [selectedPlanetId, token]
  )

  if (!selectedPlanetId) {
    return (
      <div>
        <h2>Planet</h2>
        <p className="notice">Pick a planet from a system view first.</p>
        <button onClick={() => navigate('system')}>Go to Systems</button>
      </div>
    )
  }

  async function build(buildingType: string): Promise<void> {
    if (!selectedPlanetId) return
    setError(null)
    try {
      await api.buildBuilding({ planetId: selectedPlanetId, buildingType })
      detail.reload()
      refresh()
    } catch (e) {
      const msg = handleApiError(e)
      if (msg) setError(msg)
    }
  }

  const d = detail.data
  return (
    <div>
      <h2>{d ? d.name : 'Planet'}</h2>
      <StatusBanner error={error ?? detail.error} loading={detail.loading && !d} />

      {d && (
        <>
          <div className="form-line">
            <button onClick={() => navigate('system', { systemId: d.systemId, planetId: d.id })}>
              ← {d.systemName}
            </button>
            <span className="tag">{d.planetType}</span>
          </div>

          <div className="stat-grid">
            <StatCard label="Habitability" value={d.habitability.toFixed(2)} />
            <StatCard label="Mineral Richness" value={d.mineralRichness.toFixed(2)} />
            <StatCard label="Fertility" value={d.fertility.toFixed(2)} />
            <StatCard label="Energy Potential" value={d.energyPotential.toFixed(2)} />
            <StatCard label="Population" value={d.population.toLocaleString()} />
          </div>

          <div className="panel" style={{ marginTop: 16 }}>
            <h3>Buildings on Planet</h3>
            <DataTable<PlanetBuildingView>
              rows={d.buildings}
              rowKey={(b) => b.id}
              empty="No buildings here yet."
              columns={[
                { key: 'name', header: 'Building', render: (b) => b.definitionName },
                { key: 'id', header: 'Id', render: (b) => <span className="mono">{b.id}</span> }
              ]}
            />
          </div>

          <div className="panel">
            <h3>Construct Building</h3>
            <DataTable<BuildableView>
              rows={d.buildable}
              rowKey={(b) => b.definitionId}
              columns={[
                { key: 'name', header: 'Building', render: (b) => b.name },
                { key: 'cost', header: 'Cost', numeric: true, render: (b) => `${b.buildCost.toLocaleString()} cr` },
                {
                  key: 'mat',
                  header: 'Materials',
                  render: (b) =>
                    b.buildMaterials.length === 0
                      ? '—'
                      : b.buildMaterials.map((m) => `${m.quantity}× ${m.itemId}`).join(', ')
                },
                {
                  key: 'act',
                  header: '',
                  render: (b) => (
                    <button disabled={!b.affordable} onClick={() => void build(b.definitionId)}>
                      Build
                    </button>
                  )
                }
              ]}
            />
            <p className="muted">
              Building consumes credits and materials from this planet&apos;s local system inventory.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
