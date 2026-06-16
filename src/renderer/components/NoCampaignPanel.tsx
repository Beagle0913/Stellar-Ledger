import React from 'react'
import { useApp } from '../context'

/** Friendly empty state when a campaign-dependent view has no loaded save. */
export function NoCampaignPanel(): React.JSX.Element {
  const { recoverNoCampaign } = useApp()
  return (
    <div className="welcome panel">
      <h2>No campaign loaded</h2>
      <p className="muted">Create or load a campaign to begin.</p>
      <button className="primary" onClick={recoverNoCampaign}>
        Go to Save / Load
      </button>
    </div>
  )
}
