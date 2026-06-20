import React from 'react'
import { api } from '../api'
import { useApp } from '../App'
import { useCampaignAsync } from '../hooks'
import { DataTable } from '../components/DataTable'
import { StatusBanner } from '../components/StatusBanner'
import { LinkButton } from '../components/LinkButton'
import { SystemPicker } from '../components/SystemPicker'
import type { PlanetSummary, RouteView, SystemBuildingView, SystemDetail, SystemSummary } from '../../shared/types'

export function SystemPage(): React.JSX.Element {
  const { selectedSystemId, navigate, token } = useApp()
  const systems = useCampaignAsync<SystemSummary[]>(() => api.getSystems(), [token])
  const detail = useCampaignAsync<SystemDetail | null>(
    () => (selectedSystemId ? api.getSystem(selectedSystemId) : Promise.resolve(null)),
    [selectedSystemId, token]
  )

  if (!selectedSystemId) {
    return (
      <div>
        <h2>System</h2>
        <p className="notice">Select a system:</p>
        <div className="panel">
          <SystemPicker
            systems={systems.data ?? []}
            value={null}
            onChange={(systemId) => navigate('system', { systemId })}
            id="system-page-picker"
          />
        </div>
      </div>
    )
  }

  const d = detail.data
  return (
    <div>
      <h2>{d ? d.name : 'System'}</h2>
      <StatusBanner error={detail.error ?? systems.error} loading={detail.loading && !d} />
      {d?.controllingFactionName && (
        <p className="notice">
          Controlled by <strong>{d.controllingFactionName}</strong>
          {d.factionPriceBias != null && d.factionPriceBias !== 1
            ? ` — regional prices ×${d.factionPriceBias.toFixed(2)}`
            : ''}
        </p>
      )}
      <div className="form-line">
        <button onClick={() => navigate('market', { systemId: selectedSystemId })}>
          Open Local Market
        </button>
      </div>

      <div className="panel">
        <h3>Planets</h3>
        <DataTable<PlanetSummary>
          rows={d?.planets ?? []}
          rowKey={(p) => p.id}
          columns={[
            {
              key: 'name',
              header: 'Planet',
              render: (p) => (
                <LinkButton onClick={() => navigate('planet', { planetId: p.id })}>{p.name}</LinkButton>
              )
            },
            { key: 'type', header: 'Type', render: (p) => <span className="tag">{p.planetType}</span> },
            { key: 'hab', header: 'Habitability', numeric: true, render: (p) => p.habitability.toFixed(2) },
            { key: 'min', header: 'Minerals', numeric: true, render: (p) => p.mineralRichness.toFixed(2) },
            { key: 'fer', header: 'Fertility', numeric: true, render: (p) => p.fertility.toFixed(2) },
            { key: 'eng', header: 'Energy', numeric: true, render: (p) => p.energyPotential.toFixed(2) },
            { key: 'pop', header: 'Population', numeric: true, render: (p) => p.population.toLocaleString() },
            { key: 'bld', header: 'Buildings', numeric: true, render: (p) => p.buildingCount }
          ]}
        />
      </div>

      <div className="panel">
        <h3>Local Market (top items)</h3>
        <DataTable
          rows={(d?.marketItems ?? []).slice(0, 8)}
          rowKey={(m) => m.itemId}
          columns={[
            { key: 'item', header: 'Item', render: (m) => m.itemName },
            {
              key: 'price',
              header: 'Last Price',
              numeric: true,
              render: (m) => (m.lastPrice === null ? '—' : `${m.lastPrice} cr`)
            },
            { key: 'buys', header: 'Buy Orders', numeric: true, render: (m) => m.buyOrders.length },
            { key: 'sells', header: 'Sell Orders', numeric: true, render: (m) => m.sellOrders.length }
          ]}
        />
      </div>

      {(d?.foreignBuildings.length ?? 0) > 0 && (
        <div className="panel">
          <h3>Other corporation facilities</h3>
          <DataTable<SystemBuildingView>
            rows={d?.foreignBuildings ?? []}
            rowKey={(b) => b.id}
            columns={[
              { key: 'owner', header: 'Owner', render: (b) => b.ownerName },
              { key: 'planet', header: 'Planet', render: (b) => b.planetName },
              { key: 'building', header: 'Building', render: (b) => b.definitionName }
            ]}
          />
        </div>
      )}

      <div className="panel">
        <h3>Routes</h3>
        <DataTable<RouteView>
          rows={d?.routes ?? []}
          rowKey={(r) => r.toSystemId}
          columns={[
            {
              key: 'to',
              header: 'Destination',
              render: (r) => (
                <LinkButton onClick={() => navigate('system', { systemId: r.toSystemId })}>
                  {r.toName}
                </LinkButton>
              )
            },
            { key: 'dist', header: 'Distance', numeric: true, render: (r) => r.distance }
          ]}
        />
      </div>
    </div>
  )
}
