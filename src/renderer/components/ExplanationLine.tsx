import React from 'react'
import type { Explanation } from '../../shared/explanations/types'

interface ExplanationLineProps {
  explanation: Explanation
  /** When true, show title + message; when false, message only. */
  showTitle?: boolean
  className?: string
}

/** Compact player-facing "why" line derived from shared explanation builders. */
export function ExplanationLine({
  explanation,
  showTitle = false,
  className = 'explanation-line muted'
}: ExplanationLineProps): React.JSX.Element {
  const severityClass =
    explanation.severity === 'critical'
      ? 'explanation-critical'
      : explanation.severity === 'warning'
        ? 'explanation-warning'
        : 'explanation-info'

  return (
    <p className={`${className} ${severityClass}`} title={explanation.code}>
      {showTitle ? (
        <>
          <strong>{explanation.title}</strong>
          {' — '}
          {explanation.message}
        </>
      ) : (
        explanation.message
      )}
    </p>
  )
}
