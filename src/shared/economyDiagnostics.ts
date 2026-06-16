import type {
  GameState,
  ItemPriceDiagnostics,
  MarketChangeEntry,
  PriceMovementReason,
  PricePoint,
  PriceTrend
} from './types.js'

/** Player-facing labels for price movement reason codes. */
export const PRICE_REASON_LABELS: Record<PriceMovementReason, string> = {
  shortage: 'Shortage',
  surplus: 'Surplus',
  stable: 'Stable',
  npc_demand: 'NPC demand',
  npc_supply: 'NPC supply',
  trade: 'Recent trade'
}

export function formatPriceReason(reason: PriceMovementReason | undefined | null): string | null {
  if (!reason) return null
  return PRICE_REASON_LABELS[reason] ?? reason
}

export function computePriceTrend(current: number | null, previous: number | null): PriceTrend {
  if (current === null || previous === null) return 'unknown'
  if (current > previous) return 'rising'
  if (current < previous) return 'falling'
  return 'stable'
}

export function computePriceDelta(
  current: number | null,
  previous: number | null
): { change: number | null; percentChange: number | null } {
  if (current === null || previous === null) return { change: null, percentChange: null }
  const change = current - previous
  const percentChange = previous === 0 ? null : (change / previous) * 100
  return { change, percentChange }
}

export function formatPriceChange(change: number | null, percentChange: number | null): string {
  if (change === null) return '—'
  const sign = change > 0 ? '+' : ''
  if (percentChange === null) return `${sign}${change} cr`
  return `${sign}${change} cr (${sign}${percentChange.toFixed(1)}%)`
}

export function formatTrendLabel(trend: PriceTrend): string {
  switch (trend) {
    case 'rising':
      return 'Rising'
    case 'falling':
      return 'Falling'
    case 'stable':
      return 'Stable'
    case 'unknown':
      return '—'
  }
}

export function trendTagClass(trend: PriceTrend): string {
  if (trend === 'rising') return 'tag green'
  if (trend === 'falling') return 'tag red'
  return 'tag'
}

const EMPTY_DIAGNOSTICS: ItemPriceDiagnostics = {
  currentPrice: null,
  previousPrice: null,
  priceChange: null,
  priceChangePercent: null,
  trend: 'unknown',
  latestReason: null,
  latestReasonLabel: null,
  npcStockpile: null
}

/** Build price diagnostics from ordered history points and optional regional stockpile. */
export function buildItemPriceDiagnostics(
  historyPoints: PricePoint[],
  npcStockpile: number | null | undefined
): ItemPriceDiagnostics {
  if (historyPoints.length === 0) {
    return { ...EMPTY_DIAGNOSTICS, npcStockpile: npcStockpile ?? null }
  }
  const sorted = [...historyPoints].sort((a, b) => a.tick - b.tick)
  const latest = sorted[sorted.length - 1]!
  const previous = sorted.length > 1 ? sorted[sorted.length - 2]! : null
  const { change, percentChange } = computePriceDelta(latest.price, previous?.price ?? null)
  return {
    currentPrice: latest.price,
    previousPrice: previous?.price ?? null,
    priceChange: change,
    priceChangePercent: percentChange,
    trend: computePriceTrend(latest.price, previous?.price ?? null),
    latestReason: latest.reason ?? null,
    latestReasonLabel: formatPriceReason(latest.reason),
    npcStockpile: npcStockpile ?? null
  }
}

/** True when a tick's price movement is worth showing in the dashboard report. */
export function isNotableMarketChange(
  reason: PriceMovementReason | undefined,
  priceChange: number | null
): boolean {
  if (reason === 'stable') return false
  if (priceChange !== null && priceChange !== 0) return true
  return reason !== undefined
}

/** Collect human-readable market changes recorded on a specific tick (newest tick only). */
export function collectMarketChangesForTick(state: GameState, tick: number): MarketChangeEntry[] {
  const out: MarketChangeEntry[] = []

  // Single pass over price history: gather this tick's rows and, for each
  // market+item, the most recent price strictly before this tick. The previous
  // version re-filtered/-sorted the whole history for every row, which was
  // O(rows-at-tick x total-history) and quadratic on large galaxies.
  const rowsAtTick: typeof state.priceHistory = []
  const priorByKey = new Map<string, { tick: number; price: number }>()
  for (const row of state.priceHistory) {
    if (row.tick === tick) {
      rowsAtTick.push(row)
    } else if (row.tick < tick) {
      const key = `${row.marketId}:${row.itemId}`
      const cur = priorByKey.get(key)
      if (!cur || row.tick > cur.tick) priorByKey.set(key, { tick: row.tick, price: row.price })
    }
  }

  const marketById = new Map(state.markets.map((m) => [m.id, m]))
  const itemById = new Map(state.definitions.items.map((i) => [i.id, i]))
  const systemById = new Map(state.definitions.systems.map((s) => [s.id, s]))

  for (const row of rowsAtTick) {
    const market = marketById.get(row.marketId)
    if (!market) continue
    const item = itemById.get(row.itemId)
    if (!item) continue

    const previousPrice = priorByKey.get(`${row.marketId}:${row.itemId}`)?.price ?? null
    const { change, percentChange } = computePriceDelta(row.price, previousPrice)

    if (!isNotableMarketChange(row.reason, change)) continue

    const system = systemById.get(market.systemId)
    out.push({
      systemId: market.systemId,
      systemName: system?.name ?? market.systemId,
      itemId: row.itemId,
      itemName: item.name,
      price: row.price,
      previousPrice,
      priceChange: change,
      priceChangePercent: percentChange,
      reason: row.reason ?? 'stable',
      reasonLabel: formatPriceReason(row.reason) ?? 'Stable',
      trend: computePriceTrend(row.price, previousPrice)
    })
  }

  return out.sort((a, b) => {
    const absA = Math.abs(a.priceChangePercent ?? 0)
    const absB = Math.abs(b.priceChangePercent ?? 0)
    if (absB !== absA) return absB - absA
    return a.systemName.localeCompare(b.systemName) || a.itemName.localeCompare(b.itemName)
  })
}
