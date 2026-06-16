import { TRADE_PRICE_RULE } from '../shared/constants.js'
import { GameError } from '../shared/errors.js'
import type { GameState, MarketOrder, MarketTradePreview, PreviewMarketTradeArgs } from '../shared/types.js'
import { availableQuantity, findInventory, itemLabel } from './economyMath.js'
import { createMarketOrder, matchMarket, recordPriceHistory } from './market.js'
import { applyTradesToLocalStockpiles } from './localEconomy.js'
import { replenishNpcLiquidity } from './npcLiquidity.js'
import { applyTradesToProgression } from './progression.js'
import { itemById, systemById } from './stateIndex.js'

function marketBySystem(state: GameState, systemId: string) {
  const m = state.markets.find((x) => x.systemId === systemId)
  if (!m) throw new GameError('NOT_FOUND', `No market in system "${systemId}".`)
  return m
}

// previewMarketTrade resolves systems/items via the cached definition index;
// see stateIndex. marketBySystem stays a direct lookup as it is rarely called.

function midpointPrice(buyPrice: number, sellPrice: number): number {
  return TRADE_PRICE_RULE === 'midpoint'
    ? Math.round((buyPrice + sellPrice) / 2)
    : sellPrice
}

function sortedBuyOrders(state: GameState, marketId: string, itemId: string): MarketOrder[] {
  return state.orders
    .filter(
      (o) => o.marketId === marketId && o.itemId === itemId && o.side === 'buy' && o.remainingQuantity > 0
    )
    .sort((a, b) => b.price - a.price || a.createdAt - b.createdAt)
}

function sortedSellOrders(state: GameState, marketId: string, itemId: string): MarketOrder[] {
  return state.orders
    .filter(
      (o) => o.marketId === marketId && o.itemId === itemId && o.side === 'sell' && o.remainingQuantity > 0
    )
    .sort((a, b) => a.price - b.price || a.createdAt - b.createdAt)
}

function resolveQuantity(state: GameState, args: PreviewMarketTradeArgs): number {
  if (args.action === 'buy_amount') {
    const qty = args.quantity ?? 0
    if (qty <= 0) throw new GameError('VALIDATION', 'Quantity must be positive.')
    return qty
  }
  const row = findInventory(state, state.corporation.id, args.systemId, args.itemId)
  const available = availableQuantity(row)
  if (available <= 0) {
    throw new GameError(
      'VALIDATION',
      `No available ${itemLabel(state, args.itemId)} to sell in this system.`
    )
  }
  if (args.action === 'sell_max') return available
  const qty = args.quantity ?? 0
  if (qty <= 0) throw new GameError('VALIDATION', 'Quantity must be positive.')
  if (qty > available) {
    throw new GameError(
      'VALIDATION',
      `Not enough ${itemLabel(state, args.itemId)} to sell: need ${qty}, have ${available} available.`
    )
  }
  return qty
}

/** Read-only simulation of matching against the current order book. */
export function previewMarketTrade(state: GameState, args: PreviewMarketTradeArgs): MarketTradePreview {
  const system = systemById(state, args.systemId)
  if (!system) throw new GameError('NOT_FOUND', `Unknown system "${args.systemId}".`)
  const item = itemById(state, args.itemId)
  if (!item) throw new GameError('NOT_FOUND', `Unknown item "${args.itemId}".`)

  const market = marketBySystem(state, args.systemId)
  const quantity = resolveQuantity(state, args)
  const fills: MarketTradePreview['fills'] = []
  let remaining = quantity

  if (args.action === 'buy_amount') {
    const sells = sortedSellOrders(state, market.id, args.itemId)
    const planned: Array<{ sell: MarketOrder; qty: number }> = []
    for (const sell of sells) {
      if (remaining <= 0) break
      const qty = Math.min(remaining, sell.remainingQuantity)
      planned.push({ sell, qty })
      remaining -= qty
    }
    const maxAsk =
      planned.length > 0 ? Math.max(...planned.map((p) => p.sell.price)) : 0
    for (const { sell, qty } of planned) {
      fills.push({
        orderId: sell.id,
        quantity: qty,
        price: midpointPrice(maxAsk, sell.price)
      })
    }
    if (remaining > 0) {
      throw new GameError(
        'VALIDATION',
        `Not enough ${item.name} liquidity on the market: need ${quantity}, only ${quantity - remaining} available at current asks.`
      )
    }
    const totalCost = fills.reduce((sum, f) => sum + f.quantity * f.price, 0)
    const filled = fills.reduce((sum, f) => sum + f.quantity, 0)
    return {
      action: args.action,
      systemId: args.systemId,
      systemName: system.name,
      itemId: args.itemId,
      itemName: item.name,
      quantity: filled,
      estimatedCost: totalCost,
      averagePrice: filled > 0 ? totalCost / filled : 0,
      fills,
      fillCount: fills.length
    }
  }

  const buys = sortedBuyOrders(state, market.id, args.itemId)
  if (buys.length === 0) {
    throw new GameError('VALIDATION', `No buy orders for ${item.name} in ${system.name}.`)
  }
  const planned: Array<{ buy: MarketOrder; qty: number }> = []
  for (const buy of buys) {
    if (remaining <= 0) break
    const qty = Math.min(remaining, buy.remainingQuantity)
    planned.push({ buy, qty })
    remaining -= qty
  }
  const minBid = planned.length > 0 ? Math.min(...planned.map((p) => p.buy.price)) : 0
  for (const { buy, qty } of planned) {
    fills.push({
      orderId: buy.id,
      quantity: qty,
      price: midpointPrice(buy.price, minBid)
    })
  }
  if (remaining > 0) {
    throw new GameError(
      'VALIDATION',
      `Not enough buy liquidity for ${item.name}: need ${quantity}, only ${quantity - remaining} available at current bids.`
    )
  }
  const totalRevenue = fills.reduce((sum, f) => sum + f.quantity * f.price, 0)
  const filled = fills.reduce((sum, f) => sum + f.quantity, 0)
  return {
    action: args.action,
    systemId: args.systemId,
    systemName: system.name,
    itemId: args.itemId,
    itemName: item.name,
    quantity: filled,
    estimatedRevenue: totalRevenue,
    averagePrice: filled > 0 ? totalRevenue / filled : 0,
    fills,
    fillCount: fills.length
  }
}

/** Place crossing orders and match immediately (no tick advance). */
export function executeMarketTrade(state: GameState, args: PreviewMarketTradeArgs): MarketTradePreview {
  const preview = previewMarketTrade(state, args)
  const tick = state.meta.tick

  if (args.action === 'buy_amount') {
    const worstAsk = Math.max(...preview.fills.map((f) => f.price))
    createMarketOrder(state, {
      systemId: args.systemId,
      itemId: args.itemId,
      side: 'buy',
      quantity: preview.quantity,
      price: worstAsk,
      tick
    })
  } else {
    const worstBid = Math.min(...preview.fills.map((f) => f.price))
    createMarketOrder(state, {
      systemId: args.systemId,
      itemId: args.itemId,
      side: 'sell',
      quantity: preview.quantity,
      price: worstBid,
      tick
    })
  }
  const trades = matchMarket(state)
  // Apply the same post-match side effects the daily tick does, so an instant
  // trade between ticks leaves the world in a consistent state instead of
  // deferring stockpile/price/liquidity updates to the next runTick():
  //  - regional stockpiles shift with the player's buy/sell,
  //  - price history records the executed trade price,
  //  - NPC order depth is rescaled to the new stockpiles.
  applyTradesToLocalStockpiles(state, trades)
  applyTradesToProgression(state, trades)
  recordPriceHistory(state, trades, tick)
  replenishNpcLiquidity(state)
  return preview
}
