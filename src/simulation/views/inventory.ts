import type { GameState, InventoryView } from '../../shared/types.js'
import { getPlayerCorporation } from '../corporations.js'
import { resolveItemName, resolveSystemName } from '../resolveNames.js'

export function buildInventoryView(state: GameState): InventoryView[] {
  return state.inventories
    .filter((r) => r.ownerId === getPlayerCorporation(state).id && r.quantity > 0)
    .map((r) => ({
      systemId: r.systemId,
      systemName: resolveSystemName(state, r.systemId),
      itemId: r.itemId,
      itemName: resolveItemName(state, r.itemId),
      quantity: r.quantity,
      reserved: r.reserved
    }))
    .sort((a, b) => a.systemName.localeCompare(b.systemName) || a.itemName.localeCompare(b.itemName))
}
