import { buildItemPriceDiagnostics } from '../shared/economyDiagnostics.js'
import { explainPriceDiagnostics } from '../shared/explanations/index.js'
import {
  explainEventLogSubline,
  explainIdleBuilding,
  explainQueuedJobBlock,
  explainTransportInTransit
} from '../shared/explanations/index.js'
import { GameError } from '../shared/errors.js'
import type {
  DashboardData,
  DebugStateView,
  GameState,
  InventoryView,
  EventLogView,
  LogisticsView,
  MarketItemView,
  MarketView,
  PlanetDetail,
  PriceHistoryArgs,
  PricePoint,
  ProductionView,
  ProductionPlanArgs,
  ProductionPlanView,
  SystemDetail,
  SystemSummary
} from '../shared/types.js'
import { estimateInventoryValue, explainAffordability, referencePrice, systemDistance } from './economyMath.js'
import { aggregateMarketRules, factionPriceBias } from './localEconomy.js'
import { planetPopulation } from './planetPopulation.js'
import {
  buildActionSuggestions
} from './actionSuggestions.js'
import {
  buildContractViews,
  buildFactionReputationViews,
  buildObjectiveViews
} from './progression.js'
import { recipesForBuildingType, canStartProduction } from './production.js'
import { planChain } from './productionPlanner.js'
import { canAffordShip } from './ships.js'

function itemName(state: GameState, id: string): string {
  return state.definitions.items.find((i) => i.id === id)?.name ?? id
}

function buildingName(state: GameState, id: string): string {
  return state.definitions.buildings.find((b) => b.id === id)?.name ?? id
}

function buildingNameForInstance(state: GameState, instanceId: string): string {
  const inst = state.buildings.find((b) => b.id === instanceId)
  return inst ? buildingName(state, inst.definitionId) : instanceId
}

function recipeName(state: GameState, id: string): string {
  return state.definitions.recipes.find((r) => r.id === id)?.name ?? id
}

function systemName(state: GameState, id: string): string {
  return state.definitions.systems.find((s) => s.id === id)?.name ?? id
}

function planetName(state: GameState, id: string): string {
  return state.definitions.planets.find((p) => p.id === id)?.name ?? id
}

export function buildMarketItems(state: GameState, systemId: string): MarketItemView[] {
  const market = state.markets.find((m) => m.systemId === systemId)
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
        systemName(state, systemId),
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

export function buildDashboard(state: GameState): DashboardData {
  const openJobs = state.productionJobs.filter(
    (j) => j.status === 'running' || j.status === 'queued'
  )
  return {
    campaignName: state.meta.name,
    credits: Math.round(state.corporation.credits),
    tick: state.meta.tick,
    systemCount: state.definitions.systems.length,
    planetCount: state.definitions.planets.length,
    inventoryValueEstimate: estimateInventoryValue(state, state.corporation.id),
    activeProductionJobs: state.productionJobs.filter((j) => j.status === 'running').length,
    activeTransportJobs: state.transportJobs.filter((j) => j.status === 'running').length,
    productionJobs: openJobs.map((j) => ({
      id: j.id,
      recipeName: recipeName(state, j.recipeId),
      buildingName: buildingNameForInstance(state, j.buildingId),
      progress: j.progress,
      duration: j.duration,
      status: j.status
    })),
    objectives: buildObjectiveViews(state),
    contracts: buildContractViews(state),
    factionReputation: buildFactionReputationViews(state),
    actionSuggestions: buildActionSuggestions(state),
    saveStatus: 'saved',
    lastSavedTick: state.meta.tick,
    saveError: null
  }
}

export function buildSystemSummaries(state: GameState): SystemSummary[] {
  return state.definitions.systems.map((s) => ({
    id: s.id,
    name: s.name,
    x: s.x,
    y: s.y,
    planetCount: state.definitions.planets.filter((p) => p.systemId === s.id).length
  }))
}

export function buildSystemDetail(state: GameState, id: string): SystemDetail {
  const system = state.definitions.systems.find((s) => s.id === id)
  if (!system) throw new GameError('NOT_FOUND', `Unknown system "${id}".`)
  const planets = state.definitions.planets
    .filter((p) => p.systemId === id)
    .map((p) => ({
      id: p.id,
      name: p.name,
      planetType: p.planetType,
      habitability: p.habitability,
      mineralRichness: p.mineralRichness,
      fertility: p.fertility,
      energyPotential: p.energyPotential,
      population: planetPopulation(state, p.id),
      buildingCount: state.buildings.filter((b) => b.planetId === p.id).length
    }))
  const routes = state.definitions.systems
    .filter((s) => s.id !== id)
    .map((s) => ({ toSystemId: s.id, toName: s.name, distance: systemDistance(state, id, s.id) }))
  const faction =
    system.controllingFactionId != null
      ? state.definitions.factions.find((f) => f.id === system.controllingFactionId)
      : undefined
  return {
    id: system.id,
    name: system.name,
    controllingFactionId: system.controllingFactionId ?? null,
    controllingFactionName: faction?.name ?? null,
    factionPriceBias: system.controllingFactionId ? factionPriceBias(state, system.id) : null,
    planets,
    marketItems: buildMarketItems(state, id),
    routes
  }
}

export function buildPlanetDetail(state: GameState, id: string): PlanetDetail {
  const p = state.definitions.planets.find((x) => x.id === id)
  if (!p) throw new GameError('NOT_FOUND', `Unknown planet "${id}".`)
  const system = state.definitions.systems.find((s) => s.id === p.systemId)
  const buildings = state.buildings
    .filter((b) => b.planetId === id)
    .map((b) => ({
      id: b.id,
      definitionId: b.definitionId,
      definitionName: buildingName(state, b.definitionId)
    }))
  const buildable = state.definitions.buildings.map((def) => ({
    definitionId: def.id,
    name: def.name,
    buildCost: def.buildCost,
    buildMaterials: def.buildMaterials,
    affordable: explainAffordability(
      state,
      state.corporation.id,
      p.systemId,
      def.buildCost,
      def.buildMaterials
    ) === null
  }))
  return {
    id: p.id,
    name: p.name,
    systemId: p.systemId,
    systemName: system?.name ?? p.systemId,
    planetType: p.planetType,
    habitability: p.habitability,
    mineralRichness: p.mineralRichness,
    fertility: p.fertility,
    energyPotential: p.energyPotential,
    population: planetPopulation(state, p.id),
    modifiers: p.modifiers,
    buildings,
    buildable
  }
}

export function buildMarketView(state: GameState, systemId: string): MarketView {
  const system = state.definitions.systems.find((s) => s.id === systemId)
  if (!system) throw new GameError('NOT_FOUND', `Unknown system "${systemId}".`)
  return { systemId, systemName: system.name, items: buildMarketItems(state, systemId) }
}

export function buildInventoryView(state: GameState): InventoryView[] {
  return state.inventories
    .filter((r) => r.ownerId === state.corporation.id && r.quantity > 0)
    .map((r) => ({
      systemId: r.systemId,
      systemName: systemName(state, r.systemId),
      itemId: r.itemId,
      itemName: itemName(state, r.itemId),
      quantity: r.quantity,
      reserved: r.reserved
    }))
    .sort((a, b) => a.systemName.localeCompare(b.systemName) || a.itemName.localeCompare(b.itemName))
}

export function buildProductionView(state: GameState): ProductionView {
  const corpId = state.corporation.id
  const buildings = state.buildings.map((b) => {
    const busy = state.productionJobs.some(
      (j) =>
        j.buildingId === b.id && (j.status === 'running' || j.status === 'queued')
    )
    const explanation =
      b.ownerId === corpId && !busy
        ? explainIdleBuilding(buildingName(state, b.definitionId))
        : undefined
    return {
      id: b.id,
      definitionId: b.definitionId,
      definitionName: buildingName(state, b.definitionId),
      planetId: b.planetId,
      planetName: planetName(state, b.planetId),
      availableRecipes: recipesForBuildingType(state, b.definitionId),
      explanation
    }
  })
  const jobs = state.productionJobs.map((j) => {
    let explanation
    if (j.status === 'queued') {
      const check = canStartProduction(state, j.buildingId, j.recipeId, j.quantity)
      if (!check.ok) explanation = explainQueuedJobBlock(check.reason)
    }
    return {
      ...j,
      recipeName: recipeName(state, j.recipeId),
      buildingName: buildingNameForInstance(state, j.buildingId),
      explanation
    }
  })
  return { buildings, jobs }
}

export function buildLogisticsView(state: GameState): LogisticsView {
  return {
    ships: state.ships,
    jobs: state.transportJobs.map((j) => {
      let explanation
      if (j.status === 'running') {
        explanation = explainTransportInTransit(
          j,
          systemName(state, j.originSystemId),
          systemName(state, j.destinationSystemId)
        )
      }
      return { ...j, itemName: itemName(state, j.itemId), explanation }
    }),
    purchasableShips: state.definitions.ships.map((def) => ({
      ...def,
      affordable: canAffordShip(state, def.id)
    }))
  }
}

export function buildEventLogViews(state: GameState): EventLogView[] {
  return state.eventsLog.map((entry) => ({
    ...entry,
    explanation: explainEventLogSubline(state, entry.eventId)
  }))
}

export function buildDebugStateView(state: GameState): DebugStateView {
  return {
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

export function buildPriceHistory(state: GameState, args: PriceHistoryArgs): PricePoint[] {
  const market = state.markets.find((m) => m.systemId === args.systemId)
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

export function buildProductionPlanView(state: GameState, args: ProductionPlanArgs): ProductionPlanView {
  const plan = planChain(state, args)
  return {
    feasible: plan.feasible,
    targetItemId: plan.targetItemId,
    targetQty: plan.targetQty,
    estimatedDays: plan.estimatedDays,
    requiredInputs: plan.requiredInputs.map((l) => ({
      ...l,
      itemName: itemName(state, l.itemId)
    })),
    requiredBuildings: plan.requiredBuildings.map((b) => ({
      ...b,
      buildingName: buildingName(state, b.buildingTypeId)
    })),
    bottlenecks: plan.bottlenecks,
    warnings: plan.warnings
  }
}
