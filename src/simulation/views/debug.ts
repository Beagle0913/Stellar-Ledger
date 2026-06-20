import type { DebugStateView, GameState } from '../../shared/types.js'
import { getNpcCorporations } from '../corporations.js'
import {
  resolveBuildingName,
  resolveItemName,
  resolvePlanetName,
  resolveSystemName
} from '../resolveNames.js'

export function buildDebugStateView(state: GameState): DebugStateView {
  const npcCorporations = getNpcCorporations(state)
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((corp) => {
      const inventory = state.inventories
        .filter((row) => row.ownerId === corp.id && row.quantity > 0)
        .map((row) => ({
          systemId: row.systemId,
          systemName: resolveSystemName(state, row.systemId),
          itemId: row.itemId,
          itemName: resolveItemName(state, row.itemId),
          quantity: row.quantity
        }))
        .sort(
          (a, b) =>
            a.systemName.localeCompare(b.systemName) || a.itemName.localeCompare(b.itemName)
        )
      const buildings = state.buildings
        .filter((b) => b.ownerId === corp.id)
        .map((b) => ({
          id: b.id,
          planetId: b.planetId,
          planetName: resolvePlanetName(state, b.planetId),
          definitionName: resolveBuildingName(state, b.definitionId)
        }))
        .sort((a, b) => a.planetName.localeCompare(b.planetName))
      const ships = state.ships
        .filter((s) => s.ownerId === corp.id)
        .map((s) => ({
          id: s.id,
          name: s.name,
          currentSystemId: s.currentSystemId,
          systemName: resolveSystemName(state, s.currentSystemId)
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
      const orders = state.orders
        .filter((o) => o.ownerId === corp.id && o.remainingQuantity > 0)
        .map((o) => ({
          marketId: o.marketId,
          itemId: o.itemId,
          side: o.side,
          price: o.price,
          remainingQuantity: o.remainingQuantity
        }))
        .sort(
          (a, b) =>
            a.marketId.localeCompare(b.marketId) ||
            a.itemId.localeCompare(b.itemId) ||
            a.side.localeCompare(b.side)
        )
      const corpBuildingIds = new Set(
        state.buildings.filter((b) => b.ownerId === corp.id).map((b) => b.id)
      )
      const productionJobs = state.productionJobs
        .filter((j) => corpBuildingIds.has(j.buildingId))
        .map((j) => ({
          buildingId: j.buildingId,
          recipeId: j.recipeId,
          status: j.status,
          quantity: j.quantity,
          progress: j.progress,
          duration: j.duration
        }))
        .sort((a, b) => a.buildingId.localeCompare(b.buildingId))
      const transportJobs = state.transportJobs
        .filter((j) => j.ownerId === corp.id)
        .map((j) => ({
          id: j.id,
          itemId: j.itemId,
          quantity: j.quantity,
          status: j.status,
          originSystemName: resolveSystemName(state, j.originSystemId),
          destinationSystemName: resolveSystemName(state, j.destinationSystemId)
        }))
        .sort((a, b) => a.id.localeCompare(b.id))
      return {
        id: corp.id,
        name: corp.name,
        credits: Math.round(corp.credits),
        homeSystemId: corp.homeSystemId,
        homeSystemName: resolveSystemName(state, corp.homeSystemId),
        aiProfile: corp.aiProfile ?? null,
        inventory,
        buildings,
        ships,
        orders,
        productionJobs,
        transportJobs
      }
    })

  return {
    npcCorporations,
    localStockpiles: state.localStockpiles,
    npcOrders: state.orders
      .filter((o) => o.ownerId === 'npc')
      .map((o) => ({
        marketId: o.marketId,
        itemId: o.itemId,
        side: o.side,
        price: o.price,
        remainingQuantity: o.remainingQuantity
      })),
    recentPrices: state.priceHistory.slice(-50)
  }
}
