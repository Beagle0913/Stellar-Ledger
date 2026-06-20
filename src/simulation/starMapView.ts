import type {
  EventDefinition,
  GameState,
  StarMapEconomyHeat,
  StarMapFactionLegendEntry,
  StarMapLaneView,
  StarMapNpcConvoyArc,
  StarMapRegionalTradeRow,
  StarMapSystemView,
  StarMapTransportArc,
  StarMapView,
  SystemId
} from '../shared/types.js'
import {
  MAP_CONVOY_VISIBLE_TICKS,
  MAP_EVENT_PULSE_TICKS,
  factionMapColor
} from '../shared/starMap.js'
import { getPlayerCorporation } from './corporations.js'
import { itemLabel, referencePrice, systemDistance } from './economyMath.js'
import { aggregateMarketRules, getRegionalStockpile } from './localEconomy.js'
import type { RegionalTrade } from './npcRegionalTrade.js'

/**
 * Star map read-model (no vanilla UI). Builds a `StarMapView` DTO from live
 * `GameState` for optional mod overlays or external tools via `getStarMap` IPC.
 * System x/y coordinates come from frozen system definitions in mod JSON.
 */
function inventoryValueInSystem(
  state: GameState,
  ownerId: string,
  systemId: string
): number {
  const market = state.markets.find((m) => m.systemId === systemId)
  if (!market) return 0
  let total = 0
  for (const row of state.inventories) {
    if (row.ownerId !== ownerId || row.systemId !== systemId || row.quantity <= 0) continue
    total += row.quantity * referencePrice(state, market.id, row.itemId)
  }
  return Math.round(total)
}

function economyHeatForSystem(state: GameState, systemId: string): StarMapEconomyHeat {
  const market = state.markets.find((m) => m.systemId === systemId)
  if (!market) return 'stable'
  const rules = aggregateMarketRules(state, systemId)
  if (rules.length === 0) return 'stable'

  let ratioSum = 0
  let count = 0
  for (const rule of rules) {
    if (rule.targetStockpile <= 0) continue
    const stock = getRegionalStockpile(state, market.id, rule.itemId, rule.targetStockpile)
    ratioSum += stock / rule.targetStockpile
    count += 1
  }
  if (count === 0) return 'stable'
  const avg = ratioSum / count
  if (avg >= 1.15) return 'surplus'
  if (avg <= 0.85) return 'shortage'
  return 'stable'
}

function topShortageForSystem(
  state: GameState,
  systemId: string
): { itemName: string; severity: number } | null {
  const market = state.markets.find((m) => m.systemId === systemId)
  if (!market) return null
  let worst: { itemName: string; severity: number } | null = null
  for (const rule of aggregateMarketRules(state, systemId)) {
    if (rule.targetStockpile <= 0) continue
    const stock = getRegionalStockpile(state, market.id, rule.itemId, rule.targetStockpile)
    const ratio = stock / rule.targetStockpile
    if (ratio >= 0.85) continue
    const severity = 1 - ratio
    const itemName = itemLabel(state, rule.itemId)
    if (!worst || severity > worst.severity) {
      worst = { itemName, severity }
    }
  }
  return worst
}

function systemsAffectedByEvent(def: EventDefinition, state: GameState): SystemId[] {
  const ids = new Set<SystemId>()
  if (def.effect.type === 'stockpileShock') {
    for (const market of state.markets) ids.add(market.systemId)
    return [...ids]
  }
  if (def.trigger.type === 'stockpileShortage') {
    const { itemId, threshold } = def.trigger
    for (const market of state.markets) {
      const stock =
        state.localStockpiles.find((s) => s.marketId === market.id && s.itemId === itemId)
          ?.quantity ?? 0
      if (stock < threshold) ids.add(market.systemId)
    }
  }
  return [...ids]
}

/** Days since the most recent regional event per system (within MAP_EVENT_PULSE_TICKS). */
function eventTicksAgoBySystem(state: GameState): Map<SystemId, number> {
  const map = new Map<SystemId, number>()
  const minTick = state.meta.tick - MAP_EVENT_PULSE_TICKS
  for (const entry of state.eventsLog) {
    if (entry.tick < minTick) continue
    const def = state.definitions.events.find((e) => e.id === entry.eventId)
    if (!def) continue
    const ticksAgo = state.meta.tick - entry.tick
    for (const systemId of systemsAffectedByEvent(def, state)) {
      const prev = map.get(systemId)
      if (prev == null || ticksAgo < prev) map.set(systemId, ticksAgo)
    }
  }
  return map
}

function contractHighlightsBySystem(state: GameState): Map<SystemId, string> {
  const map = new Map<SystemId, string>()
  for (const contract of state.progression.activeContracts) {
    if (!contract.accepted) continue
    const systemId = contract.params.systemId
    if (!systemId) continue
    if (contract.type === 'deliver_item' || contract.type === 'sell_in_faction') {
      map.set(systemId, contract.title)
    }
  }
  return map
}

function systemCoords(state: GameState, systemId: string): { x: number; y: number } {
  const sys = state.definitions.systems.find((s) => s.id === systemId)
  return { x: sys?.x ?? 0, y: sys?.y ?? 0 }
}

function buildLanes(state: GameState, systems: StarMapSystemView[]): StarMapLaneView[] {
  if (systems.length < 2) return []

  const byId = new Map(systems.map((s) => [s.id, s]))
  const dist = (a: StarMapSystemView, b: StarMapSystemView) =>
    systemDistance(state, a.id, b.id)

  // Minimum spanning tree guarantees connectivity.
  const edgeKeys = new Set<string>()
  const lanePairs: Array<[StarMapSystemView, StarMapSystemView]> = []
  const addEdge = (a: StarMapSystemView, b: StarMapSystemView) => {
    const key = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`
    if (edgeKeys.has(key)) return
    edgeKeys.add(key)
    lanePairs.push([a, b])
  }

  const inTree = new Set<string>([systems[0]!.id])
  while (inTree.size < systems.length) {
    let best: { a: StarMapSystemView; b: StarMapSystemView; distance: number } | null = null
    for (const uId of inTree) {
      const u = byId.get(uId)!
      for (const v of systems) {
        if (inTree.has(v.id)) continue
        const distance = dist(u, v)
        if (!best || distance < best.distance) best = { a: u, b: v, distance }
      }
    }
    if (!best) break
    inTree.add(best.b.id)
    addEdge(best.a, best.b)
  }

  // k-nearest neighbors for local density (k=3).
  const k = 3
  for (const sys of systems) {
    const neighbors = systems
      .filter((other) => other.id !== sys.id)
      .map((other) => ({ other, distance: dist(sys, other) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, k)
    for (const { other } of neighbors) addEdge(sys, other)
  }

  let maxDistance = 1
  for (const [a, b] of lanePairs) {
    const d = dist(a, b)
    if (d > maxDistance) maxDistance = d
  }

  return lanePairs.map(([a, b]) => {
    const distance = dist(a, b)
    const t = maxDistance > 0 ? distance / maxDistance : 0
    return {
      systemAId: a.id,
      systemBId: b.id,
      x1: a.x,
      y1: a.y,
      x2: b.x,
      y2: b.y,
      distance,
      opacity: 0.85 - t * 0.55,
      strokeWidth: 2.2 - t * 1.2
    }
  })
}

/** Append NPC convoys from the latest tick; trim entries older than MAP_CONVOY_VISIBLE_TICKS. */
export function recordRegionalTradesForMap(
  state: GameState,
  tick: number,
  trades: RegionalTrade[]
): void {
  if (!state.recentRegionalTrades) state.recentRegionalTrades = []
  for (const rt of trades) {
    state.recentRegionalTrades.push({
      tick,
      fromSystemId: rt.fromSystemId,
      toSystemId: rt.toSystemId,
      itemId: rt.itemId,
      itemName: itemLabel(state, rt.itemId),
      quantity: rt.quantity
    })
  }
  const minTick = tick - MAP_CONVOY_VISIBLE_TICKS + 1
  state.recentRegionalTrades = state.recentRegionalTrades.filter((r) => r.tick >= minTick)
}

/** Build the enriched star map read model for the renderer. */
export function buildStarMapView(state: GameState): StarMapView {
  const corp = getPlayerCorporation(state)
  const corpId = corp.id
  const homeSystemId = corp.homeSystemId
  const eventAgo = eventTicksAgoBySystem(state)
  const contractHighlights = contractHighlightsBySystem(state)

  const factionIdsSeen = new Set<string>()
  const systems: StarMapSystemView[] = state.definitions.systems.map((s, index) => {
    const faction =
      s.controllingFactionId != null
        ? state.definitions.factions.find((f) => f.id === s.controllingFactionId)
        : undefined
    if (s.controllingFactionId) factionIdsSeen.add(s.controllingFactionId)

    const shortage = topShortageForSystem(state, s.id)
    const planetIds = new Set(
      state.definitions.planets.filter((p) => p.systemId === s.id).map((p) => p.id)
    )

    return {
      id: s.id,
      name: s.name,
      x: s.x,
      y: s.y,
      planetCount: planetIds.size,
      isHome: s.id === homeSystemId,
      controllingFactionId: s.controllingFactionId ?? null,
      controllingFactionName: faction?.name ?? null,
      factionColor: factionMapColor(s.controllingFactionId, index),
      distanceFromHome:
        s.id === homeSystemId ? 0 : systemDistance(state, homeSystemId, s.id),
      inventoryValueEstimate: inventoryValueInSystem(state, corpId, s.id),
      buildingCount: state.buildings.filter(
        (b) => b.ownerId === corpId && planetIds.has(b.planetId)
      ).length,
      shipCount: state.ships.filter(
        (ship) => ship.ownerId === corpId && ship.currentSystemId === s.id
      ).length,
      topShortageItemName: shortage?.itemName ?? null,
      topShortageSeverity: shortage?.severity ?? null,
      economyHeat: economyHeatForSystem(state, s.id),
      eventTicksAgo: eventAgo.get(s.id) ?? null,
      contractHighlight: contractHighlights.get(s.id) ?? null
    }
  })

  const lanes = buildLanes(state, systems)

  const transportArcs: StarMapTransportArc[] = state.transportJobs
    .filter((j) => j.status === 'running')
    .map((j) => {
      const origin = systemCoords(state, j.originSystemId)
      const dest = systemCoords(state, j.destinationSystemId)
      const frac = j.distance > 0 ? Math.min(1, Math.max(0, j.progress / j.distance)) : 0
      return {
        jobId: j.id,
        originSystemId: j.originSystemId,
        originX: origin.x,
        originY: origin.y,
        destinationSystemId: j.destinationSystemId,
        destinationX: dest.x,
        destinationY: dest.y,
        progressFraction: frac,
        itemName: itemLabel(state, j.itemId),
        quantity: j.quantity
      }
    })

  const recentTrades = state.recentRegionalTrades ?? []
  const npcConvoys: StarMapNpcConvoyArc[] = recentTrades.map((rt) => {
    const from = systemCoords(state, rt.fromSystemId)
    const to = systemCoords(state, rt.toSystemId)
    return {
      tick: rt.tick,
      fromSystemId: rt.fromSystemId,
      toSystemId: rt.toSystemId,
      fromX: from.x,
      fromY: from.y,
      toX: to.x,
      toY: to.y,
      itemName: rt.itemName,
      quantity: rt.quantity,
      ticksAgo: state.meta.tick - rt.tick
    }
  })

  const factions: StarMapFactionLegendEntry[] = state.definitions.factions
    .filter((f) => factionIdsSeen.has(f.id))
    .map((f, index) => ({
      factionId: f.id,
      factionName: f.name,
      color: factionMapColor(f.id, index)
    }))

  return {
    homeSystemId,
    currentTick: state.meta.tick,
    systems,
    lanes,
    transportArcs,
    npcConvoys,
    factions
  }
}

// Re-export for tests / consumers that need the row type alias
export type { StarMapRegionalTradeRow }
