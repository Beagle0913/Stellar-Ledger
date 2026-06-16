import React, { useMemo, useState } from 'react'
import type { PricePoint } from '../../shared/types'

export type PriceChartRange = 7 | 30 | 90 | 'all'

export interface PriceChartProps {
  points: PricePoint[]
  width?: number
  height?: number
  loading?: boolean
}

function filterByRange(points: PricePoint[], range: PriceChartRange): PricePoint[] {
  if (range === 'all' || points.length === 0) return points
  const maxTick = points[points.length - 1]!.tick
  const minTick = maxTick - range + 1
  return points.filter((p) => p.tick >= minTick)
}

/** Interactive SVG price chart with range controls and hover tooltip. */
export function PriceChart({
  points,
  width = 520,
  height = 160,
  loading = false
}: PriceChartProps): React.JSX.Element {
  const [range, setRange] = useState<PriceChartRange>(30)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  const filtered = useMemo(() => filterByRange(points, range), [points, range])

  if (loading) {
    return <p className="muted">Loading price history…</p>
  }

  if (points.length === 0) {
    return (
      <p className="muted">
        No recorded prices yet for this item in this system. Run a tick or place orders to establish
        history.
      </p>
    )
  }

  const prices = filtered.map((p) => p.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const rangePx = max - min || 1
  const pad = { left: 8, right: 8, top: 8, bottom: 24 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom

  const coords = filtered.map((p, i) => {
    const x =
      pad.left + (filtered.length === 1 ? innerW / 2 : (i / (filtered.length - 1)) * innerW)
    const y = pad.top + innerH - ((p.price - min) / rangePx) * innerH
    return { x, y, point: p }
  })

  const hover = hoverIdx !== null ? coords[hoverIdx] : null

  return (
    <div className="price-chart">
      <div className="badges" style={{ marginBottom: 8 }}>
        {([7, 30, 90, 'all'] as const).map((r) => (
          <button
            key={String(r)}
            type="button"
            className={range === r ? 'tag primary' : 'tag'}
            onClick={() => setRange(r)}
          >
            {r === 'all' ? 'All' : `${r}d`}
          </button>
        ))}
      </div>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label="price history chart"
        onMouseLeave={() => setHoverIdx(null)}
      >
        {coords.map((c, i) => (
          <circle
            key={`${c.point.tick}-${i}`}
            cx={c.x}
            cy={c.y}
            r={hoverIdx === i ? 4 : 2.5}
            fill="var(--accent)"
            opacity={hoverIdx === null || hoverIdx === i ? 1 : 0.35}
            onMouseEnter={() => setHoverIdx(i)}
          />
        ))}
        {coords.length > 1 && (
          <polyline
            points={coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ')}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={1.5}
          />
        )}
      </svg>
      {hover && (
        <div className="sparkline-meta mono" style={{ marginTop: 4 }}>
          <span>Day {hover.point.tick}</span>
          <span>{hover.point.price} cr</span>
          {hover.point.reason && <span>{hover.point.reason}</span>}
        </div>
      )}
      <div className="sparkline-meta mono">
        <span>min {min}</span>
        <span>max {max}</span>
        <span>
          last {filtered[filtered.length - 1]!.price} (day {filtered[filtered.length - 1]!.tick})
        </span>
        <span>{filtered.length} points</span>
      </div>
    </div>
  )
}
