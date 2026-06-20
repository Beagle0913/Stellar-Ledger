import { buildItemPriceDiagnostics } from '../../shared/economyDiagnostics.js'
import { explainPriceDiagnostics } from '../../shared/explanations/index.js'
import { GameError } from '../../shared/errors.js'
import type { GameState, MarketItemView, MarketView, PriceHistoryArgs, PricePoint } from '../../shared/types.js'
import { referencePrice } from '../economyMath.js'
import { aggregateMarketRules } from '../localEconomy.js'
import { resolveSystemName } from '../resolveNames.js'
import { marketBySystemId, systemById } from '../stateIndex.js'

export function buildMarketItems(state: GameState, systemId: string): MarketItemView[] {
  const market = marketBySystemId(state, systemId)
  if (!market) return []
  const hasHistory = (itemId: string): boolean =>
    state.priceHistory.some((h) => h.marketId === market.id && h.itemId === itemId)
  return state.definitions.items.map((item) => {
    const orders = state.orders.filter((o) => o.marketId === market.id && o.itemId === item.id)
    const history = state.priceHistory
      .filter((h) => h.marketId === market.id && h.itemId === item.id)
      .map((h) => ({ tick: h.tick, price: h.price, ...(h.reason ? { reason: h.reason } : {}) }))
    const stock = state.localStockpiles.find(
      (s) => s.marketId === market.id && s.itemId === item.id
    )
    const diagnostics = buildItemPriceDiagnostics(history, stock?.quantity)
    const rules = aggregateMarketRules(state, systemId)
    const rule = rules.find((r) => r.itemId === item.id)
    const stockpileContext =
      stock && rule && rule.targetStockpile > 0
        ? { stockpile: stock.quantity, targetStockpile: rule.targetStockpile }
        : undefined
    const explanation =
      explainPriceDiagnostics(
        diagnostics,
        systemId,
        item.id,
        resolveSystemName(state, systemId),
        item.name,
        stockpileContext
      ) ?? undefined
    return {
      itemId: item.id,
      itemName: item.name,
      lastPrice: hasHistory(item.id) ? referencePrice(state, market.id, item.id) : null,
      diagnostics,
      explanation,
      buyOrders: orders
        .filter((o) => o.side === 'buy')
        .map((o) => ({ ...o, itemName: item.name }))
        .sort((a, b) => b.price - a.price),
      sellOrders: orders
        .filter((o) => o.side === 'sell')
        .map((o) => ({ ...o, itemName: item.name }))
        .sort((a, b) => a.price - b.price)
    }
  })
}

export function buildMarketView(state: GameState, systemId: string): MarketView {
  const system = systemById(state, systemId)
  if (!system) throw new GameError('NOT_FOUND', `Unknown system "${systemId}".`)
  return { systemId, systemName: system.name, items: buildMarketItems(state, systemId) }
}

export function buildPriceHistory(state: GameState, args: PriceHistoryArgs): PricePoint[] {
  const market = marketBySystemId(state, args.systemId)
  if (!market) return []
  let rows = state.priceHistory.filter((h) => h.marketId === market.id && h.itemId === args.itemId)
  if (args.sinceTick !== undefined) {
    rows = rows.filter((h) => h.tick >= args.sinceTick!)
  }
  let points: PricePoint[] = rows
    .map((h) => ({ tick: h.tick, price: h.price, ...(h.reason ? { reason: h.reason } : {}) }))
    .sort((a, b) => a.tick - b.tick)
  if (args.limit !== undefined && points.length > args.limit) {
    points = points.slice(-args.limit)
  }
  return points
}
