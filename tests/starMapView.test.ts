import { describe, expect, it } from 'vitest'
import { acceptContract } from '../src/simulation/progression.js'
import { createTransportJob } from '../src/simulation/logistics.js'
import { runTick } from '../src/simulation/tick.js'
import {
  buildStarMapView,
  recordRegionalTradesForMap
} from '../src/simulation/starMapView.js'
import { FACTION_MAP_COLORS } from '../src/shared/starMap.js'
import { homeSystemId, newGame, otherSystemId, playerShip } from './helpers.js'

describe('buildStarMapView', () => {
  it('marks home system and assigns faction colors', () => {
    const state = newGame()
    const map = buildStarMapView(state)
    const home = homeSystemId(state)

    expect(map.homeSystemId).toBe(home)
    expect(map.currentTick).toBe(0)
    const homeView = map.systems.find((s) => s.id === home)
    expect(homeView?.isHome).toBe(true)
    expect(homeView?.distanceFromHome).toBe(0)

    const helion = map.systems.find((s) => s.id === 'sys_helion')
    expect(helion?.controllingFactionName).toBe('Helion Consortium')
    expect(helion?.factionColor).toBe(FACTION_MAP_COLORS['faction_consortium'])
  })

  it('includes running transport arcs with progress', () => {
    const state = newGame()
    const ship = playerShip(state)
    const dest = otherSystemId(state)
    createTransportJob(state, {
      shipId: ship.id,
      destinationSystemId: dest,
      itemId: 'ore',
      quantity: 5
    })
    state.transportJobs[0]!.progress = state.transportJobs[0]!.distance * 0.5

    const map = buildStarMapView(state)
    expect(map.transportArcs).toHaveLength(1)
    expect(map.transportArcs[0]!.progressFraction).toBeCloseTo(0.5, 5)
  })

  it('builds distance-weighted lanes', () => {
    const state = newGame()
    const map = buildStarMapView(state)
    expect(map.lanes.length).toBeGreaterThan(0)
    for (const lane of map.lanes) {
      expect(lane.distance).toBeGreaterThan(0)
      expect(lane.opacity).toBeGreaterThan(0)
      expect(lane.strokeWidth).toBeGreaterThan(0)
    }
  })

  it('assigns economy heat from stockpile ratios', () => {
    const state = newGame()
    const map = buildStarMapView(state)
    for (const sys of map.systems) {
      expect(['surplus', 'stable', 'shortage']).toContain(sys.economyHeat)
    }
  })

  it('records NPC convoys after tick and exposes on map view', () => {
    const state = newGame()
    runTick(state)
    const map = buildStarMapView(state)
    expect(map.currentTick).toBe(1)
    if (map.npcConvoys.length > 0) {
      expect(map.npcConvoys[0]!.ticksAgo).toBe(0)
    }
  })

  it('recordRegionalTradesForMap trims old convoys', () => {
    const state = newGame()
    recordRegionalTradesForMap(state, 1, [])
    recordRegionalTradesForMap(state, 5, [
      {
        itemId: 'food',
        fromMarketId: 'm1',
        toMarketId: 'm2',
        fromSystemId: 'sys_helion',
        toSystemId: 'sys_vesper',
        quantity: 10
      }
    ])
    expect(state.recentRegionalTrades.every((r) => r.tick >= 3)).toBe(true)
  })

  it('highlights accepted contract destination systems', () => {
    const state = newGame()
    runTick(state)
    const offer = state.progression.activeContracts[0]
    if (!offer) return
    if (offer.type === 'deliver_item' && offer.params.systemId) {
      acceptContract(state, offer.id)
      const map = buildStarMapView(state)
      const target = map.systems.find((s) => s.id === offer.params.systemId)
      expect(target?.contractHighlight).toBe(offer.title)
    }
  })

  it('counts player ships and buildings per system', () => {
    const state = newGame()
    const home = homeSystemId(state)
    const map = buildStarMapView(state)
    const homeView = map.systems.find((s) => s.id === home)

    expect(homeView!.shipCount).toBeGreaterThanOrEqual(1)
    expect(homeView!.buildingCount).toBeGreaterThan(0)
  })
})
