import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import { useApp } from '../App'
import { useCampaignAsync } from '../hooks'
import { DataTable } from '../components/DataTable'
import { StarMapNetwork } from '../components/StarMapNetwork'
import { StatusBanner } from '../components/StatusBanner'
import {
  CONTRACT_HIGHLIGHT_COLOR,
  ECONOMY_HEAT_COLORS,
  HOME_RING_COLOR,
  NPC_CONVOY_COLOR
} from '../../shared/starMap'
import type { StarMapSystemView, StarMapView, StarMapTransportArc } from '../../shared/types'

function heatLabel(heat: StarMapSystemView['economyHeat']): string {
  if (heat === 'surplus') return 'Surplus'
  if (heat === 'shortage') return 'Shortage'
  return 'Stable'
}

function transportsForSystem(
  arcs: StarMapTransportArc[],
  systemId: string
): StarMapTransportArc[] {
  return arcs.filter(
    (a) => a.originSystemId === systemId || a.destinationSystemId === systemId
  )
}

export function StarMapPage(): React.JSX.Element {
  const { selectedSystemId, navigate, token } = useApp()
  const mapState = useCampaignAsync<StarMapView>(() => api.getStarMap(), [token])

  const [showLanes, setShowLanes] = useState(true)
  const [showTransportArcs, setShowTransportArcs] = useState(true)
  const [showNpcConvoys, setShowNpcConvoys] = useState(true)
  const [showAllLabels, setShowAllLabels] = useState(false)

  const map = mapState.data
  const highlightedSystemId = selectedSystemId ?? map?.homeSystemId ?? null
  const selectedSystem = useMemo(
    () =>
      selectedSystemId
        ? (map?.systems.find((s) => s.id === selectedSystemId) ?? null)
        : null,
    [map, selectedSystemId]
  )

  useEffect(() => {
    if (!map || selectedSystemId) return
    navigate('starmap', { systemId: map.homeSystemId })
  }, [map, selectedSystemId, navigate])

  function selectSystem(systemId: string): void {
    navigate('starmap', { systemId })
  }

  const activeTransports =
    map && selectedSystemId
      ? transportsForSystem(map.transportArcs, selectedSystemId)
      : []

  return (
    <div className="star-map-page" data-testid="star-map-page">
      <h2>Star Map</h2>
      <StatusBanner
        error={mapState.error}
        loading={mapState.loading && !map}
        loadingLabel="Loading star map…"
      />

      {map && map.systems.length === 0 && (
        <p className="notice">No star systems available.</p>
      )}

      {map && map.systems.length > 0 && (
        <>
          <div className="panel star-map-toolbar">
            <span className="subhead" style={{ margin: 0 }}>
              Overlays
            </span>
            <label className="star-map-toggle">
              <input type="checkbox" checked={showLanes} onChange={(e) => setShowLanes(e.target.checked)} />
              Lanes
            </label>
            <label className="star-map-toggle">
              <input
                type="checkbox"
                checked={showTransportArcs}
                onChange={(e) => setShowTransportArcs(e.target.checked)}
              />
              Player transports
            </label>
            <label className="star-map-toggle">
              <input
                type="checkbox"
                checked={showNpcConvoys}
                onChange={(e) => setShowNpcConvoys(e.target.checked)}
              />
              NPC convoys
            </label>
            <label className="star-map-toggle">
              <input
                type="checkbox"
                checked={showAllLabels}
                onChange={(e) => setShowAllLabels(e.target.checked)}
              />
              Show all labels
            </label>
          </div>

          <div className="star-map-layout">
            <div className="panel star-map-canvas-panel">
              <StarMapNetwork
                map={map}
                selectedSystemId={highlightedSystemId}
                showLanes={showLanes}
                showTransportArcs={showTransportArcs}
                showNpcConvoys={showNpcConvoys}
                showAllLabels={showAllLabels}
                onSelectSystem={selectSystem}
              />
              <div className="star-map-legend">
                <span className="star-map-legend-item">
                  <span className="star-map-swatch" style={{ background: HOME_RING_COLOR }} />
                  Home
                </span>
                {(['surplus', 'stable', 'shortage'] as const).map((heat) => (
                  <span key={heat} className="star-map-legend-item">
                    <span
                      className="star-map-swatch"
                      style={{ background: ECONOMY_HEAT_COLORS[heat] }}
                    />
                    {heatLabel(heat)}
                  </span>
                ))}
                <span className="star-map-legend-item">
                  <span className="star-map-swatch" style={{ background: NPC_CONVOY_COLOR }} />
                  NPC convoy
                </span>
                <span className="star-map-legend-item">
                  <span
                    className="star-map-swatch"
                    style={{ background: CONTRACT_HIGHLIGHT_COLOR }}
                  />
                  Contract
                </span>
                {map.factions.map((f) => (
                  <span key={f.factionId} className="star-map-legend-item">
                    <span className="star-map-swatch" style={{ background: f.color }} />
                    {f.factionName}
                  </span>
                ))}
              </div>
            </div>

            <div className="panel star-map-detail-panel" data-testid="star-map-detail-panel">
              {selectedSystem ? (
                <>
                  <h3>{selectedSystem.name}</h3>
                  {selectedSystem.isHome && <p className="tag">Home system</p>}
                  {selectedSystem.controllingFactionName && (
                    <p className="notice">
                      Controlled by <strong>{selectedSystem.controllingFactionName}</strong>
                    </p>
                  )}
                  <dl className="star-map-stats">
                    <dt>Distance from home</dt>
                    <dd>{selectedSystem.distanceFromHome}</dd>
                    <dt>Planets</dt>
                    <dd>{selectedSystem.planetCount}</dd>
                    <dt>Economy</dt>
                    <dd>{heatLabel(selectedSystem.economyHeat)}</dd>
                    {selectedSystem.topShortageItemName && (
                      <>
                        <dt>Top shortage</dt>
                        <dd>
                          {selectedSystem.topShortageItemName}
                          {selectedSystem.topShortageSeverity != null &&
                            ` (${(selectedSystem.topShortageSeverity * 100).toFixed(0)}%)`}
                        </dd>
                      </>
                    )}
                    <dt>Inventory value</dt>
                    <dd>{selectedSystem.inventoryValueEstimate.toLocaleString()} cr</dd>
                    <dt>Buildings</dt>
                    <dd>{selectedSystem.buildingCount}</dd>
                    <dt>Ships docked</dt>
                    <dd>{selectedSystem.shipCount}</dd>
                    {selectedSystem.contractHighlight && (
                      <>
                        <dt>Contract</dt>
                        <dd>{selectedSystem.contractHighlight}</dd>
                      </>
                    )}
                  </dl>
                  {activeTransports.length > 0 && (
                    <>
                      <h4>Active transports</h4>
                      <ul className="star-map-transport-list">
                        {activeTransports.map((arc) => (
                          <li key={arc.jobId}>
                            {arc.itemName} ×{arc.quantity} (
                            {Math.round(arc.progressFraction * 100)}% en route)
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  <div className="form-line">
                    <button onClick={() => navigate('system', { systemId: selectedSystem.id })}>
                      Open System
                    </button>
                    <button onClick={() => navigate('market', { systemId: selectedSystem.id })}>
                      Open Market
                    </button>
                    <button onClick={() => navigate('logistics')}>Logistics</button>
                  </div>
                </>
              ) : (
                <p className="notice">Select a system on the map or in the table below.</p>
              )}
            </div>
          </div>

          <div className="panel">
            <h3>All systems</h3>
            <DataTable<StarMapSystemView>
              rows={map.systems}
              rowKey={(s) => s.id}
              onRowClick={(s) => selectSystem(s.id)}
              columns={[
                { key: 'name', header: 'System', render: (s) => s.name },
                {
                  key: 'faction',
                  header: 'Faction',
                  render: (s) => s.controllingFactionName ?? '—'
                },
                {
                  key: 'heat',
                  header: 'Economy',
                  render: (s) => <span className="tag">{heatLabel(s.economyHeat)}</span>
                },
                { key: 'ships', header: 'Ships', numeric: true, render: (s) => s.shipCount },
                {
                  key: 'buildings',
                  header: 'Buildings',
                  numeric: true,
                  render: (s) => s.buildingCount
                },
                {
                  key: 'inv',
                  header: 'Inventory',
                  numeric: true,
                  render: (s) => s.inventoryValueEstimate.toLocaleString()
                },
                {
                  key: 'shortage',
                  header: 'Shortage',
                  render: (s) => s.topShortageItemName ?? '—'
                },
                {
                  key: 'contract',
                  header: 'Contract',
                  render: (s) => s.contractHighlight ?? '—'
                }
              ]}
            />
          </div>
        </>
      )}
    </div>
  )
}
