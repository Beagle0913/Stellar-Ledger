import React from 'react'

interface StatusBannerProps {
  error?: string | null
  notice?: string | null
  loading?: boolean
  loadingLabel?: string
}

/** Shared error / notice / loading row for campaign pages. */
export function StatusBanner({
  error,
  notice,
  loading,
  loadingLabel = 'Loading…'
}: StatusBannerProps): React.JSX.Element | null {
  if (!error && !notice && !loading) return null
  return (
    <>
      {loading && (
        <p className="muted" role="status" aria-live="polite">
          {loadingLabel}
        </p>
      )}
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="notice" role="status" aria-live="polite">
          {notice}
        </div>
      )}
    </>
  )
}
