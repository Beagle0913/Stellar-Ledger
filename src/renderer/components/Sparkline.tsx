import React from 'react'
import type { PricePoint } from '../../shared/types'

interface SparklineProps {
  points: PricePoint[]
  width?: number
  height?: number
}

/**
 * Minimal inline SVG price chart. Intentionally simple (a single polyline plus
 * min/max/last labels) — no charting library, fitting the spreadsheet aesthetic.
 */
export function Sparkline({ points, width = 260, height = 56 }: SparklineProps): React.JSX.Element {
  if (points.length === 0) {
    return <p className="muted">No trades recorded yet. Prices appear after orders match on a tick.</p>
  }

  const prices = points.map((p) => p.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1
  const pad = 4
  const innerW = width - pad * 2
  const innerH = height - pad * 2

  // Map each point to an (x, y) coordinate; a single point renders as a flat dot.
  const coords = points.map((p, i) => {
    const x = pad + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW)
    const y = pad + innerH - ((p.price - min) / range) * innerH
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })

  const last = points[points.length - 1]!

  return (
    <div className="sparkline">
      <svg width={width} height={height} role="img" aria-label="price history">
        <polyline
          points={coords.join(' ')}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={1.5}
        />
        {points.length === 1 && (
          <circle cx={pad + innerW / 2} cy={pad + innerH / 2} r={2.5} fill="var(--accent)" />
        )}
      </svg>
      <div className="sparkline-meta mono">
        <span>min {min}</span>
        <span>max {max}</span>
        <span>last {last.price} (day {last.tick})</span>
      </div>
    </div>
  )
}
