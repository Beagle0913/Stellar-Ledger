import { describe, expect, it } from 'vitest'
import { buildBuilding } from '../src/simulation/buildings.js'
import { getPlayerCorporation } from '../src/simulation/corporations.js'
import { GameError } from '../src/shared/errors.js'
import { getHomePlanetId, newGame } from './helpers.js'

describe('buildings', () => {
  it('constructs an affordable building on a valid planet', () => {
    const state = newGame()
    const planetId = getHomePlanetId()
    const def = state.definitions.buildings.find((b) => b.id === 'mine')!
    const corp = getPlayerCorporation(state)
    corp.credits = def.buildCost + 10_000

    const instance = buildBuilding(state, planetId, 'mine')
    expect(instance.planetId).toBe(planetId)
    expect(instance.definitionId).toBe('mine')
    expect(state.buildings.some((b) => b.id === instance.id)).toBe(true)
  })

  it('rejects unknown planet', () => {
    const state = newGame()
    expect(() => buildBuilding(state, 'no_such_planet', 'mine')).toThrow(GameError)
  })

  it('rejects when player cannot afford build cost', () => {
    const state = newGame()
    const planetId = getHomePlanetId()
    getPlayerCorporation(state).credits = 0
    expect(() => buildBuilding(state, planetId, 'mine')).toThrow(GameError)
  })
})
