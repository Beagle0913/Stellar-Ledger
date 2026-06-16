import { describe, expect, it } from 'vitest'
import { explainAffordability } from '../src/simulation/economyMath.js'
import { homeSystemId, newGame } from './helpers.js'

describe('explainAffordability', () => {
  it('returns null when credits and materials are sufficient', () => {
    const state = newGame()
    const home = homeSystemId(state)
    const result = explainAffordability(state, state.corporation.id, home, 5000, [
      { itemId: 'machinery', quantity: 2 }
    ])
    expect(result).toBeNull()
  })

  it('names insufficient credits clearly', () => {
    const state = newGame()
    state.corporation.credits = 100
    const result = explainAffordability(state, state.corporation.id, homeSystemId(state), 5000, [])
    expect(result).toMatch(/Not enough credits to build/)
    expect(result).toMatch(/need 5,000 cr/)
  })

  it('names insufficient materials clearly', () => {
    const state = newGame()
    const home = homeSystemId(state)
    const result = explainAffordability(state, state.corporation.id, home, 0, [
      { itemId: 'machinery', quantity: 9999 }
    ])
    expect(result).toMatch(/Not enough Machinery to build/)
    expect(result).toMatch(/need 9999, have/)
  })
})
