import type {
  CorporationId,
  GameState,
  InventoryRow,
  ItemId,
  MarketId,
  PriceHistoryRow,
  SystemId
} from '../shared/types.js'
import { itemById, marketBySystemId, systemById } from './stateIndex.js'

// Pure economy math + inventory bookkeeping helpers used throughout the
// simulation. No I/O, no randomness — fully deterministic.

/** Straight-line distance between two systems on the abstract star map. */
export function systemDistance(state: GameState, a: SystemId, b: SystemId): number {
  if (a === b) return 0
  const sa = systemById(state, a)
  const sb = systemById(state, b)
  if (!sa || !sb) return 0
  const dx = sa.x - sb.x
  const dy = sa.y - sb.y
  // Scale down map units into a friendlier "distance" number.
  return Math.round(Math.sqrt(dx * dx + dy * dy) / 10)
}

/** Human-readable name for an item id, looked up from the loaded definitions.
 * Used to build clear, player-facing error messages without hardcoding names.
 */
export function itemLabel(state: GameState, itemId: ItemId): string {
  return itemById(state, itemId)?.name ?? itemId
}

/**
 * Return a player-facing reason when credits or materials are insufficient,
 * or `null` when the player can afford the cost. Used by building construction
 * and any future spend checks that need a clear error message.
 */
export function explainAffordability(
  state: GameState,
  ownerId: CorporationId,
  systemId: SystemId,
  creditCost: number,
  materials: Array<{ itemId: ItemId; quantity: number }>
): string | null {
  if (state.corporation.credits < creditCost) {
    return `Not enough credits to build: need ${creditCost.toLocaleString()} cr, have ${Math.round(
      state.corporation.credits
    ).toLocaleString()} cr.`
  }
  for (const mat of materials) {
    const row = findInventory(state, ownerId, systemId, mat.itemId)
    const have = availableQuantity(row)
    if (have < mat.quantity) {
      return `Not enough ${itemLabel(state, mat.itemId)} to build: need ${mat.quantity}, have ${have}.`
    }
  }
  return null
}

// Inventory lookup index keyed by `${ownerId}:${systemId}:${itemId}` -> live row.
// Rows are only ever created (never spliced out) — addInventory keeps the index
// current; quantity/reserved mutate in place. Guards on array identity so it
// rebuilds when state.inventories is replaced wholesale (e.g. loaded from disk).
interface InventoryIndex {
  array: InventoryRow[]
  map: Map<string, InventoryRow>
}
const inventoryIndex = new WeakMap<GameState, InventoryIndex>()

function inventoryKey(ownerId: CorporationId, systemId: SystemId, itemId: ItemId): string {
  return `${ownerId}:${systemId}:${itemId}`
}

function inventoryMap(state: GameState): Map<string, InventoryRow> {
  let idx = inventoryIndex.get(state)
  if (!idx || idx.array !== state.inventories) {
    const map = new Map<string, InventoryRow>()
    for (const row of state.inventories) map.set(inventoryKey(row.ownerId, row.systemId, row.itemId), row)
    idx = { array: state.inventories, map }
    inventoryIndex.set(state, idx)
  }
  return idx.map
}

/** Find an existing inventory row, if any. */
export function findInventory(
  state: GameState,
  ownerId: CorporationId,
  systemId: SystemId,
  itemId: ItemId
): InventoryRow | undefined {
  return inventoryMap(state).get(inventoryKey(ownerId, systemId, itemId))
}

/** Quantity that is free to use (not reserved by pending orders/transports). */
export function availableQuantity(row: InventoryRow | undefined): number {
  if (!row) return 0
  return Math.max(0, row.quantity - row.reserved)
}

/** Total free quantity of an item across all of an owner's systems. */
export function totalAvailable(
  state: GameState,
  ownerId: CorporationId,
  itemId: ItemId
): number {
  return state.inventories
    .filter((r) => r.ownerId === ownerId && r.itemId === itemId)
    .reduce((sum, r) => sum + availableQuantity(r), 0)
}

/** Add quantity to inventory, creating the row if needed. */
export function addInventory(
  state: GameState,
  ownerId: CorporationId,
  systemId: SystemId,
  itemId: ItemId,
  quantity: number
): void {
  const row = findInventory(state, ownerId, systemId, itemId)
  if (row) {
    row.quantity += quantity
  } else {
    const created: InventoryRow = { ownerId, systemId, itemId, quantity, reserved: 0 }
    state.inventories.push(created)
    inventoryMap(state).set(inventoryKey(ownerId, systemId, itemId), created)
  }
}

/**
 * Remove free (non-reserved) quantity. Returns false and changes nothing if
 * there is not enough available.
 */
export function removeInventory(
  state: GameState,
  ownerId: CorporationId,
  systemId: SystemId,
  itemId: ItemId,
  quantity: number
): boolean {
  const row = findInventory(state, ownerId, systemId, itemId)
  if (availableQuantity(row) < quantity || !row) return false
  row.quantity -= quantity
  return true
}

/** Reserve free inventory (e.g. for a sell order or transport). */
export function reserveInventory(
  state: GameState,
  ownerId: CorporationId,
  systemId: SystemId,
  itemId: ItemId,
  quantity: number
): boolean {
  const row = findInventory(state, ownerId, systemId, itemId)
  if (availableQuantity(row) < quantity || !row) return false
  row.reserved += quantity
  return true
}

/** Release a previous reservation without removing the goods. */
export function releaseReservation(
  state: GameState,
  ownerId: CorporationId,
  systemId: SystemId,
  itemId: ItemId,
  quantity: number
): void {
  const row = findInventory(state, ownerId, systemId, itemId)
  if (!row) return
  row.reserved = Math.max(0, row.reserved - quantity)
}

/** Consume previously reserved goods (reduces both quantity and reserved). */
export function consumeReserved(
  state: GameState,
  ownerId: CorporationId,
  systemId: SystemId,
  itemId: ItemId,
  quantity: number
): void {
  const row = findInventory(state, ownerId, systemId, itemId)
  if (!row) return
  row.quantity = Math.max(0, row.quantity - quantity)
  row.reserved = Math.max(0, row.reserved - quantity)
}

// ---------------------------------------------------------------------------
// Latest-price index. A DERIVED, in-memory structure (never persisted, not part
// of the save schema): per GameState, the most recent price row per
// (marketId, itemId). Lazily built from state.priceHistory on first use and
// kept current by routing every priceHistory push through pushPriceRow() /
// notePriceRow(). Makes referencePrice O(1) instead of O(|priceHistory|).
// ---------------------------------------------------------------------------

type LatestPrice = { tick: number; price: number }

const latestPriceIndex = new WeakMap<GameState, Map<string, LatestPrice>>()

function priceKey(marketId: MarketId, itemId: ItemId): string {
  return `${marketId}:${itemId}`
}

function indexFor(state: GameState): Map<string, LatestPrice> {
  let idx = latestPriceIndex.get(state)
  if (!idx) {
    idx = new Map()
    for (const row of state.priceHistory) {
      const key = priceKey(row.marketId, row.itemId)
      const cur = idx.get(key)
      if (!cur || row.tick >= cur.tick) idx.set(key, { tick: row.tick, price: row.price })
    }
    latestPriceIndex.set(state, idx)
  }
  return idx
}

/** Record a price row in the latest-price index (call whenever a row is added). */
export function notePriceRow(state: GameState, row: PriceHistoryRow): void {
  const idx = indexFor(state)
  const key = priceKey(row.marketId, row.itemId)
  const cur = idx.get(key)
  if (!cur || row.tick >= cur.tick) idx.set(key, { tick: row.tick, price: row.price })
}

/** Append a price-history row AND keep the latest-price index in sync.
 * All simulation code must add price rows through this helper. */
export function pushPriceRow(state: GameState, row: PriceHistoryRow): void {
  state.priceHistory.push(row)
  notePriceRow(state, row)
}

/**
 * Reference price for an item in a market: the most recent recorded price, or
 * the item's data-driven baseValue if it has never traded. O(1) via the
 * latest-price index above.
 */
export function referencePrice(
  state: GameState,
  marketId: MarketId,
  itemId: ItemId
): number {
  const latest = indexFor(state).get(priceKey(marketId, itemId))
  if (latest) return latest.price
  const item = itemById(state, itemId)
  return item ? item.baseValue : 0
}

/**
 * Rough valuation of an owner's entire inventory using each item's reference
 * price in the local market of the system where the goods sit.
 */
export function estimateInventoryValue(state: GameState, ownerId: CorporationId): number {
  let total = 0
  for (const row of state.inventories) {
    if (row.ownerId !== ownerId) continue
    const market = marketBySystemId(state, row.systemId)
    const price = market ? referencePrice(state, market.id, row.itemId) : 0
    total += row.quantity * price
  }
  return Math.round(total)
}
