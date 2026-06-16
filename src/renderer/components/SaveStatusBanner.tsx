import React, { useCallback, useState } from 'react'
import { api } from '../api'
import { useApp } from '../context'
import type { SaveStatus } from '../../shared/types'

interface SaveStatusBannerProps {
  saveStatus: SaveStatus
  saveError: string | null
}

export function SaveStatusBanner({
  saveStatus,
  saveError
}: SaveStatusBannerProps): React.JSX.Element | null {
  const { refresh } = useApp()
  const [retrying, setRetrying] = useState(false)

  const retry = useCallback(async () => {
    setRetrying(true)
    try {
      await api.saveCurrent()
      refresh()
    } catch {
      /* handleApiError on pages if needed */
    } finally {
      setRetrying(false)
    }
  }, [refresh])

  if (saveStatus === 'saved') {
    return (
      <div className="save-status save-status--saved" role="status">
        Saved
      </div>
    )
  }

  if (saveStatus === 'saving') {
    return (
      <div className="save-status save-status--saving" role="status" aria-live="polite">
        Saving…
      </div>
    )
  }

  return (
    <div className="save-status save-status--error" role="alert">
      <span>Save failed{saveError ? `: ${saveError}` : ''}</span>
      <button type="button" onClick={() => void retry()} disabled={retrying}>
        {retrying ? 'Retrying…' : 'Retry save'}
      </button>
    </div>
  )
}
