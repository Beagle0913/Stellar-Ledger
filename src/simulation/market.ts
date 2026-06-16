import { NPC_ORDER_QUANTITY, TRADE_PRICE_RULE } from '../shared/constants.js'
import { GameError } from '../shared/errors.js'
import { newId } from '../shared/ids.js'
import {
  GameState,
  Market,
  MarketOrder,
  NPC_OWNER,
  OrderSide,
  PriceHistoryRow
} from '../shared/types.js'
import { getPlayerCorporation } from './corporations.js'
import {
  addInventory,
  availableQuantity,
  consumeReserved,
  findInventory,
  itemLabel,
  pushPriceRow,
  referencePrice,
  releaseReservation,
  reserveInventory
} from './economyMath.js'
import { itemById, marketById, marketBySystemId } from './stateIndex.js'

// Order book market, one per star system. Buy orders escrow credits; sell orders
// reserve inventory. Matching pairs the highest buy with the lowest sell and
// settles each trade at the MIDPOINT of the two crossing prices (documented in
// ECONOMY.md). NPC orders provide baseline liquidity and have unlimited backing.

export interface Trade {
  marketId: string
  itemId: string
  quantity: number
  price: number
  buyOrderId: string
  sellOrderId: string
  /** When the player traded against NPC liquidity this tick. */
  playerSide?: 'buy' | 'sell'
}

function marketBySystem(state: GameState, systemId: string): Market {
  const m = marketBySystemId(state, systemId)
  if (!m) throw new GameError('NOT_FOUND', `No market in system "${systemId}".`)
  return m
}

/**
 * Create a market order on behalf of the player.
 *  - sell: reserves the player's inventory in the market's system
 *  - buy:  escrows credits (quantity * price) from the player
 */
export function createMarketOrder(
  state: GameState,
  args: {
    systemId: string
    itemId: string
    side: OrderSide
    quantity: number
    price: number
    tick: number
  }
): MarketOrder {
  const { systemId, itemId, side, quantity, price, tick } = args
  if (quantity <= 0) throw new GameError('VALIDATION', 'Quantity must be positive.')
  if (price <= 0) throw new GameError('VALIDATION', 'Price must be positive.')
  if (!itemById(state, itemId)) {
    throw new GameError('NOT_FOUND', `Unknown item "${itemId}".`)
  }
  const market = marketBySystem(state, systemId)
  const corp = getPlayerCorporation(state)

  if (side === 'sell') {
    const have = availableQuantity(findInventory(state, corp.id, systemId, itemId))
    if (!reserveInventory(state, corp.id, systemId, itemId, quantity)) {
      throw new GameError(
        'VALIDATION',
        `Not enough ${itemLabel(state, itemId)} to sell here: need ${quantity}, have ${have} available.`
      )
    }
  } else {
    const cost = quantity * price
    if (corp.credits < cost) {
      throw new GameError(
        'VALIDATION',
        `Not enough credits to escrow this buy order: need ${cost.toLocaleString()} cr, have ${Math.round(
          corp.credits
        ).toLocaleString()} cr.`
      )
    }
    // Escrow credits up front; difference is refunded when trades settle cheaper.
    corp.credits -= cost
  }

  const order: MarketOrder = {
    id: newId('order'),
    marketId: market.id,
    itemId,
    side,
    quantity,
    remainingQuantity: quantity,
    price,
    ownerId: corp.id,
    createdAt: tick
  }
  state.orders.push(order)
  return order
}

/** Update NPC order prices around the current reference price for one item. */
export function refreshNpcOrderPrices(
  state: GameState,
  marketId: string,
  itemId: string
): void {
  const ref = referencePrice(state, marketId, itemId)
  for (const order of state.orders) {
    if (order.marketId !== marketId || order.itemId !== itemId || order.ownerId !== NPC_OWNER) {
      continue
    }
    if (order.side === 'sell') {
      order.price = Math.round(ref * 1.1)
    } else {
      order.price = Math.max(1, Math.round(ref * 0.9))
    }
  }
}
/** Seed NPC buy/sell liquidity around each item's reference price. */
export function seedNpcOrders(state: GameState, tick: number): void {
  for (const market of state.markets) {
    for (const item of state.definitions.items) {
      const ref = referencePrice(state, market.id, item.id)
      state.orders.push({
        id: newId('npc'),
        marketId: market.id,
        itemId: item.id,
        side: 'sell',
        quantity: NPC_ORDER_QUANTITY,
        remainingQuantity: NPC_ORDER_QUANTITY,
        price: Math.round(ref * 1.1),
        ownerId: NPC_OWNER,
        createdAt: tick
      })
      state.orders.push({
        id: newId('npc'),
        marketId: market.id,
        itemId: item.id,
        side: 'buy',
        quantity: NPC_ORDER_QUANTITY,
        remainingQuantity: NPC_ORDER_QUANTITY,
        price: Math.max(1, Math.round(ref * 0.9)),
        ownerId: NPC_OWNER,
        createdAt: tick
      })
    }
  }
}

function settlePlayerBuy(
  state: GameState,
  order: MarketOrder,
  systemId: string,
  itemId: string,
  qty: number,
  tradePrice: number
): void {
  // Player receives goods; refund the escrow difference (escrowed at order price).
  const corp = getPlayerCorporation(state)
  addInventory(state, corp.id, systemId, itemId, qty)
  const refund = (order.price - tradePrice) * qty
  if (refund > 0) corp.credits += refund
}

function settlePlayerSell(
  state: GameState,
  systemId: string,
  itemId: string,
  qty: number,
  tradePrice: number
): void {
  // Player delivers reserved goods and is paid the trade price.
  const corp = getPlayerCorporation(state)
  consumeReserved(state, corp.id, systemId, itemId, qty)
  corp.credits += tradePrice * qty
}

function executeTrade(
  state: GameState,
  market: Market,
  buy: MarketOrder,
  sell: MarketOrder,
  qty: number
): Trade {
  // Trade price rule: MIDPOINT of crossing prices (TRADE_PRICE_RULE === 'midpoint').
  const tradePrice =
    TRADE_PRICE_RULE === 'midpoint'
      ? Math.round((buy.price + sell.price) / 2)
      : sell.price

  if (buy.ownerId !== NPC_OWNER) {
    settlePlayerBuy(state, buy, market.systemId, sell.itemId, qty, tradePrice)
  }
  if (sell.ownerId !== NPC_OWNER) {
    settlePlayerSell(state, market.systemId, sell.itemId, qty, tradePrice)
  }

  buy.remainingQuantity -= qty
  sell.remainingQuantity -= qty

  const corpId = getPlayerCorporation(state).id
  let playerSide: Trade['playerSide']
  if (buy.ownerId === corpId && sell.ownerId === NPC_OWNER) {
    playerSide = 'buy'
  } else if (sell.ownerId === corpId && buy.ownerId === NPC_OWNER) {
    playerSide = 'sell'
  }

  return {
    marketId: market.id,
    itemId: sell.itemId,
    quantity: qty,
    price: tradePrice,
    buyOrderId: buy.id,
    sellOrderId: sell.id,
    ...(playerSide ? { playerSide } : {})
  }
}

/**
 * Match all crossing orders in every market and return the trades executed.
 * Highest buy price meets lowest sell price; ties broken by creation order.
 */
export function matchMarket(state: GameState): Trade[] {
  const trades: Trade[] = []

  // Index the order book in a single pass: marketId -> itemId -> { buys, sells }.
  // Item iteration order matches first-appearance in state.orders (same as the
  // previous `new Set(...)` behaviour), keeping matching fully deterministic.
  interface Book {
    buys: MarketOrder[]
    sells: MarketOrder[]
  }
  const byMarket = new Map<string, Map<string, Book>>()
  for (const order of state.orders) {
    if (order.remainingQuantity <= 0) continue
    let items = byMarket.get(order.marketId)
    if (!items) {
      items = new Map()
      byMarket.set(order.marketId, items)
    }
    let book = items.get(order.itemId)
    if (!book) {
      book = { buys: [], sells: [] }
      items.set(order.itemId, book)
    }
    if (order.side === 'buy') book.buys.push(order)
    else book.sells.push(order)
  }

  for (const market of state.markets) {
    const items = byMarket.get(market.id)
    if (!items) continue

    for (const book of items.values()) {
      const buys = book.buys.sort((a, b) => b.price - a.price || a.createdAt - b.createdAt)
      const sells = book.sells.sort((a, b) => a.price - b.price || a.createdAt - b.createdAt)

      let i = 0
      let j = 0
      while (i < buys.length && j < sells.length) {
        const buy = buys[i]!
        const sell = sells[j]!
        if (buy.price < sell.price) break // best buy can't meet best sell -> done
        const qty = Math.min(buy.remainingQuantity, sell.remainingQuantity)
        trades.push(executeTrade(state, market, buy, sell, qty))
        if (buy.remainingQuantity === 0) i += 1
        if (sell.remainingQuantity === 0) j += 1
      }
    }
  }

  // Drop fully-filled player orders (NPC orders are kept for liquidity).
  state.orders = state.orders.filter(
    (o) => o.remainingQuantity > 0 || o.ownerId === NPC_OWNER
  )
  return trades
}

export { replenishNpcLiquidity } from './npcLiquidity.js'

/** Record one price-history row per traded item using the executed trade price. */
export function recordPriceHistory(state: GameState, trades: Trade[], tick: number): void {
  const seen = new Map<string, PriceHistoryRow>()
  for (const t of trades) {
    // Keep the last trade price per market+item for this tick.
    seen.set(`${t.marketId}:${t.itemId}`, {
      marketId: t.marketId,
      itemId: t.itemId,
      tick,
      price: t.price,
      reason: 'trade'
    })
  }
  for (const row of seen.values()) pushPriceRow(state, row)
}

/** Release escrow/reservations for a player order before removing it (cancel). */
export function cancelOrder(state: GameState, orderId: string): void {
  const order = state.orders.find((o) => o.id === orderId)
  if (!order || order.ownerId === NPC_OWNER) return
  const market = marketById(state, order.marketId)
  if (!market) return
  const corp = getPlayerCorporation(state)
  if (order.side === 'sell') {
    releaseReservation(state, corp.id, market.systemId, order.itemId, order.remainingQuantity)
  } else {
    corp.credits += order.remainingQuantity * order.price
  }
  state.orders = state.orders.filter((o) => o.id !== orderId)
}

/** True if the item has any free (sellable) inventory in the system. */
export function hasSellableInventory(
  state: GameState,
  systemId: string,
  itemId: string
): boolean {
  return availableQuantity(findInventory(state, getPlayerCorporation(state).id, systemId, itemId)) > 0
}
