import { describe, expect, it } from 'vitest'
import {
  buildingDefById,
  itemById,
  marketBySystemId,
  planetById,
  planetsInSystem,
  recipeById,
  systemById
} from '../src/simulation/stateIndex.js'
import { resolveItemName, resolveSystemName } from '../src/simulation/resolveNames.js'
import { getHomePlanetId, getHomeSystemId, newGame } from './helpers.js'

describe('stateIndex', () => {
  it('resolves definition lookups in O(1) maps', () => {
    const state = newGame()
    const homeSystemId = getHomeSystemId()
    const homePlanetId = getHomePlanetId()

    expect(systemById(state, homeSystemId)?.id).toBe(homeSystemId)
    expect(planetById(state, homePlanetId)?.id).toBe(homePlanetId)
    expect(itemById(state, 'ore')?.id).toBe('ore')
    expect(recipeById(state, state.definitions.recipes[0]!.id)).toBeDefined()
    expect(buildingDefById(state, 'mine')?.id).toBe('mine')
    expect(marketBySystemId(state, homeSystemId)?.systemId).toBe(homeSystemId)
    expect(planetsInSystem(state, homeSystemId).length).toBeGreaterThan(0)
  })

  it('resolveNames uses indexed lookups', () => {
    const state = newGame()
    const homeSystemId = getHomeSystemId()
    const system = systemById(state, homeSystemId)!
    expect(resolveSystemName(state, homeSystemId)).toBe(system.name)
    expect(resolveItemName(state, 'ore')).toBe('Ore')
    expect(resolveItemName(state, 'missing_item')).toBe('missing_item')
  })

  it('reuses cache for the same GameState object', () => {
    const state = newGame()
    const first = systemById(state, getHomeSystemId())
    const second = systemById(state, getHomeSystemId())
    expect(first).toBe(second)
  })
})
