import { newId } from '../shared/ids.js'
import type { Corporation, GameState, ItemId, MarketOrder, OrderSide } from '../shared/types.js'
import { NPC_OWNER } from '../shared/types/state.js'
import { getCorporationById } from './corporations.js'
import {
  availableQuantity,
  findInventory,
  referencePrice,
  releaseReservation,
  reserveInventory
} from './economyMath.js'
import {
  npcMarketBuyPriceMult,
  npcMarketMaxOrderQty,
  npcMarketMinOrderQty,
  npcMarketSellPriceMult,
  npcMarketShortageFraction,
  npcMarketSurplusFraction,
  npcStockTarget,
  sortedNpcCorporations,
  systemsForCorp
} from './npc/shared.js'
import { marketById, marketBySystemId } from './stateIndex.js'

function openCorpOrder(
  state: GameState,
  corpId: string,
  marketId: string,
  itemId: ItemId,
  side: OrderSide
): MarketOrder | undefined {
  return state.orders.find(
    (o) =>
      o.ownerId === corpId &&
      o.marketId === marketId &&
      o.itemId === itemId &&
      o.side === side &&
      o.remainingQuantity > 0
  )
}

function cancelCorpOrder(state: GameState, order: MarketOrder): void {
  const market = marketById(state, order.marketId)
  const corp = getCorporationById(state, order.ownerId)
  if (!market || !corp) return
  if (order.side === 'sell') {
    releaseReservation(state, order.ownerId, market.systemId, order.itemId, order.remainingQuantity)
  } else {
    corp.credits += order.remainingQuantity * order.price
  }
  state.orders = state.orders.filter((o) => o.id !== order.id)
}

function placeCorpOrder(
  state: GameState,
  corp: Corporation,
  systemId: string,
  itemId: ItemId,
  side: OrderSide,
  quantity: number,
  tick: number
): boolean {
  const market = marketBySystemId(state, systemId)
  const minOrderQty = npcMarketMinOrderQty(state)
  if (!market || quantity < minOrderQty) return false

  const ref = referencePrice(state, market.id, itemId)
  const price =
    side === 'sell'
      ? Math.max(1, Math.round(ref * npcMarketSellPriceMult(state)))
      : Math.max(1, Math.round(ref * npcMarketBuyPriceMult(state)))

  const existing = openCorpOrder(state, corp.id, market.id, itemId, side)
  if (existing) cancelCorpOrder(state, existing)

  if (side === 'sell') {
    if (!reserveInventory(state, corp.id, systemId, itemId, quantity)) return false
  } else {
    const cost = quantity * price
    if (corp.credits < cost) return false
    corp.credits -= cost
  }

  state.orders.push({
    id: newId('order'),
    marketId: market.id,
    itemId,
    side,
    quantity,
    remainingQuantity: quantity,
    price,
    ownerId: corp.id,
    createdAt: tick
  })
  return true
}

/** Place or refresh at most one buy/sell order per corp/system/item (deterministic). */
export function processNpcMarketAI(state: GameState): number {
  const tick = state.meta.tick
  let actions = 0
  const maxOrderQty = npcMarketMaxOrderQty(state)
  const minOrderQty = npcMarketMinOrderQty(state)
  const surplusFraction = npcMarketSurplusFraction(state)
  const shortageFraction = npcMarketShortageFraction(state)

  for (const corp of sortedNpcCorporations(state)) {
    if (corp.aiProfile === 'trader') continue

    for (const systemId of systemsForCorp(state, corp, { requirePositiveQuantity: true })) {
      const market = marketBySystemId(state, systemId)
      if (!market) continue

      for (const item of state.definitions.items.slice().sort((a, b) => a.id.localeCompare(b.id))) {
        const qty = availableQuantity(findInventory(state, corp.id, systemId, item.id))
        const target = npcStockTarget(state, item.id)
        const sellExisting = openCorpOrder(state, corp.id, market.id, item.id, 'sell')
        const buyExisting = openCorpOrder(state, corp.id, market.id, item.id, 'buy')

        const surplus = qty - target * (1 + surplusFraction)
        if (surplus >= minOrderQty) {
          if (buyExisting) cancelCorpOrder(state, buyExisting)
          const sellQty = Math.min(Math.floor(surplus), maxOrderQty)
          if (placeCorpOrder(state, corp, systemId, item.id, 'sell', sellQty, tick)) actions += 1
          continue
        }

        const shortage = target * shortageFraction - qty
        if (shortage >= minOrderQty) {
          if (sellExisting) cancelCorpOrder(state, sellExisting)
          const buyQty = Math.min(Math.floor(shortage), maxOrderQty)
          if (placeCorpOrder(state, corp, systemId, item.id, 'buy', buyQty, tick)) actions += 1
          continue
        }

        if (sellExisting) cancelCorpOrder(state, sellExisting)
        if (buyExisting) cancelCorpOrder(state, buyExisting)
      }
    }
  }

  return actions
}

/** Count open NPC corporation orders (for balance gates / invariants). */
export function countOpenNpcCorpOrders(state: GameState): number {
  const playerId = state.playerCorporationId
  return state.orders.filter(
    (o) => o.ownerId !== NPC_OWNER && o.ownerId !== playerId && o.remainingQuantity > 0
  ).length
}
