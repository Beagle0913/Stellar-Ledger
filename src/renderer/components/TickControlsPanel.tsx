import React from 'react'

export interface TickControlsPanelProps {
  ticking: boolean
  onRunTick: () => void
  onRunWeek: () => void
  onRunSmartProduction: () => void
  onRunSmartTransport: () => void
  onRunSmartChanges: () => void
}

/** Shared tick advance controls for Dashboard and Star Map pages. */
export function TickControlsPanel({
  ticking,
  onRunTick,
  onRunWeek,
  onRunSmartProduction,
  onRunSmartTransport,
  onRunSmartChanges
}: TickControlsPanelProps): React.JSX.Element {
  return (
    <div className="panel">
      <div className="form-line">
        <button className="primary" disabled={ticking} onClick={onRunTick}>
          {ticking ? 'Running…' : 'Run 1 Day Tick'}
        </button>
        <button disabled={ticking} onClick={onRunWeek}>
          {ticking ? 'Running…' : 'Run 7 Days'}
        </button>
        <button disabled={ticking} onClick={onRunSmartProduction}>
          Advance to next production
        </button>
        <button disabled={ticking} onClick={onRunSmartTransport}>
          Advance to next transport
        </button>
        <button disabled={ticking} onClick={onRunSmartChanges}>
          Advance until something changes
        </button>
      </div>
      <p className="muted">
        Smart advance caps at 30 days. Production/transport jump to the next completion;
        &quot;until something changes&quot; stops on trades, jobs, deliveries, or events.
      </p>
    </div>
  )
}
