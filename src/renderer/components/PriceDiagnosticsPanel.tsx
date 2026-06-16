import React from 'react'
import {
  formatPriceChange,
  formatTrendLabel,
  trendTagClass
} from '../../shared/economyDiagnostics'
import type { Explanation } from '../../shared/explanations/types'
import type { ItemPriceDiagnostics } from '../../shared/types'
import { ExplanationLine } from './ExplanationLine'
import { StatCard } from './StatCard'

interface Props {
  itemName: string
  diagnostics: ItemPriceDiagnostics
  explanation?: Explanation
}

/** Compact price/stock diagnostics for one market item. */
export function PriceDiagnosticsPanel({ itemName, diagnostics: d, explanation }: Props): React.JSX.Element {
  if (d.currentPrice === null) {
    return (
      <p className="muted">
        No price history for {itemName} yet. Run a tick or place orders to establish a reference
        price.
      </p>
    )
  }

  return (
    <>
      <div className="stat-grid">
        <StatCard label="Current price" value={`${d.currentPrice} cr`} />
        <StatCard
          label="Previous price"
          value={d.previousPrice === null ? '—' : `${d.previousPrice} cr`}
        />
        <StatCard
          label="Change"
          value={formatPriceChange(d.priceChange, d.priceChangePercent)}
        />
        <StatCard label="Trend" value={formatTrendLabel(d.trend)} />
        <StatCard label="Latest reason" value={d.latestReasonLabel ?? '—'} />
        <StatCard
          label="Regional NPC stock"
          value={d.npcStockpile === null ? '—' : d.npcStockpile.toLocaleString()}
        />
      </div>
      <div className="badges" style={{ marginTop: 8 }}>
        <span className={trendTagClass(d.trend)}>{formatTrendLabel(d.trend)}</span>
        {d.latestReasonLabel && <span className="tag">{d.latestReasonLabel}</span>}
      </div>
      {explanation && <ExplanationLine explanation={explanation} />}
    </>
  )
}

/** Short explainer for how regional markets relate to player inventory. */
export function MarketEconomyGuide(): React.JSX.Element {
  return (
    <div className="panel economy-guide">
      <h3>How this market works</h3>
      <ul className="economy-guide-list muted">
        <li>
          <strong>Regional NPC stockpile</strong> is the local market&apos;s simulated supply — not
          your inventory.
        </li>
        <li>Buying from NPCs reduces regional stock; selling to NPCs increases it.</li>
        <li>Shortages and surpluses push future reference prices up or down each day.</li>
        <li>Recent trades can become the latest reference price on the next tick.</li>
      </ul>
    </div>
  )
}
