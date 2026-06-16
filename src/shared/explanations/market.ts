import type {
  ItemPriceDiagnostics,
  MarketChangeEntry,
  PriceMovementReason,
  PriceTrend
} from '../types.js'
import { buildExplanation } from './text.js'
import type { Explanation, MarketExplanationCode, StockpileContext } from './types.js'

/** Map price movement reason + trend to a stable explanation code. */
export function marketExplanationCode(
  reason: PriceMovementReason,
  trend: PriceTrend
): MarketExplanationCode {
  if (reason === 'trade') return 'market.price.changed.trade'
  if (reason === 'stable' || trend === 'stable') return 'market.price.stable'
  if (trend === 'rising') {
    return reason === 'npc_demand' ? 'market.price.rising.npc_demand' : 'market.price.rising.shortage'
  }
  if (trend === 'falling') {
    return reason === 'npc_supply' ? 'market.price.falling.npc_supply' : 'market.price.falling.surplus'
  }
  // unknown trend — infer from reason
  switch (reason) {
    case 'npc_demand':
      return 'market.price.rising.npc_demand'
    case 'npc_supply':
      return 'market.price.falling.npc_supply'
    case 'surplus':
      return 'market.price.falling.surplus'
    case 'shortage':
      return 'market.price.rising.shortage'
    default:
      return 'market.price.stable'
  }
}

function stockpileParams(ctx?: StockpileContext) {
  if (!ctx || ctx.targetStockpile <= 0) return {}
  const percentOfTarget = Math.round((ctx.stockpile / ctx.targetStockpile) * 100)
  return {
    stockpile: ctx.stockpile,
    targetStockpile: ctx.targetStockpile,
    percentOfTarget
  }
}

/** Explain a tick market change row (Dashboard tick report). */
export function explainMarketChange(
  entry: MarketChangeEntry,
  stockpileContext?: StockpileContext
): Explanation {
  const code = marketExplanationCode(entry.reason, entry.trend)
  return buildExplanation(
    code,
    {
      systemName: entry.systemName,
      itemName: entry.itemName,
      ...stockpileParams(stockpileContext)
    },
    {
      relatedSystemId: entry.systemId,
      relatedItemId: entry.itemId,
      details: {
        price: entry.price,
        priceChange: entry.priceChange ?? 0,
        reason: entry.reason
      }
    }
  )
}

/** Explain current item price diagnostics (Market page). Returns null when no history. */
export function explainPriceDiagnostics(
  diagnostics: ItemPriceDiagnostics,
  systemId: string,
  itemId: string,
  systemName: string,
  itemName: string,
  stockpileContext?: StockpileContext
): Explanation | null {
  if (diagnostics.currentPrice === null || diagnostics.latestReason === null) return null
  const code = marketExplanationCode(diagnostics.latestReason, diagnostics.trend)
  return buildExplanation(
    code,
    {
      systemName,
      itemName,
      ...stockpileParams(stockpileContext)
    },
    {
      relatedSystemId: systemId,
      relatedItemId: itemId,
      details: {
        price: diagnostics.currentPrice,
        priceChange: diagnostics.priceChange ?? 0,
        reason: diagnostics.latestReason
      }
    }
  )
}
