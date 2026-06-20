import type { Corporation, GameState, ItemId, SystemId } from '../../shared/types.js'
import { getNpcCorporations } from '../corporations.js'

export function sortedNpcCorporations(state: GameState): Corporation[] {
  return getNpcCorporations(state).slice().sort((a, b) => a.id.localeCompare(b.id))
}

export function systemsForCorp(
  state: GameState,
  corp: Corporation,
  options?: { requirePositiveQuantity?: boolean }
): SystemId[] {
  const systems = new Set<string>([corp.homeSystemId])
  for (const row of state.inventories) {
    if (row.ownerId !== corp.id) continue
    if (options?.requirePositiveQuantity && row.quantity <= 0) continue
    systems.add(row.systemId)
  }
  return [...systems].sort((a, b) => a.localeCompare(b))
}

export function npcStockTarget(state: GameState, itemId: ItemId): number {
  const config = state.definitions.economyConfig
  return config.npcStockTargets[itemId] ?? config.npcDefaultStockTarget
}

export function npcMarketMaxOrderQty(state: GameState): number {
  return state.definitions.economyConfig.npcMarketMaxOrderQty
}

export function npcMarketMinOrderQty(state: GameState): number {
  return state.definitions.economyConfig.npcMarketMinOrderQty
}

export function npcMarketSurplusFraction(state: GameState): number {
  return state.definitions.economyConfig.npcMarketSurplusFraction
}

export function npcMarketShortageFraction(state: GameState): number {
  return state.definitions.economyConfig.npcMarketShortageFraction
}

export function npcMarketSellPriceMult(state: GameState): number {
  return state.definitions.economyConfig.npcMarketSellPriceMult
}

export function npcMarketBuyPriceMult(state: GameState): number {
  return state.definitions.economyConfig.npcMarketBuyPriceMult
}

export function npcLogisticsMaxQty(state: GameState): number {
  return state.definitions.economyConfig.npcLogisticsMaxQty
}

export function npcLogisticsMinSurplus(state: GameState): number {
  return state.definitions.economyConfig.npcLogisticsMinSurplus
}

export function npcLogisticsMinShortage(state: GameState): number {
  return state.definitions.economyConfig.npcLogisticsMinShortage
}

export function npcLogisticsSurplusFraction(state: GameState): number {
  return state.definitions.economyConfig.npcLogisticsSurplusFraction
}

export function npcLogisticsShortageFraction(state: GameState): number {
  return state.definitions.economyConfig.npcLogisticsShortageFraction
}

export function npcBalancedOreThreshold(state: GameState): number {
  return state.definitions.economyConfig.npcBalancedOreThreshold
}

export function npcBalancedOreItemId(state: GameState): ItemId {
  return state.definitions.economyConfig.npcBalancedOreItemId
}

export function npcMaxProductionRunsPerBuilding(state: GameState): number {
  return state.definitions.economyConfig.npcMaxProductionRunsPerBuilding
}
