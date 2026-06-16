import { describe, expect, it } from 'vitest'
import { buildActionSuggestions } from '../src/simulation/actionSuggestions.js'
import { newGame } from './helpers.js'

describe('actionSuggestions', () => {
  it('suggests an idle building and an affordable ship when applicable', () => {
    const state = newGame()
    state.corporation.credits = 45_000
    const suggestions = buildActionSuggestions(state)
    // Data-driven: any owned building with no job is reported as idle.
    expect(suggestions.some((s) => /is idle\.$/.test(s))).toBe(true)
    // Most expensive affordable, not-yet-owned ship (Hauler II at 39,500 cr).
    expect(suggestions.some((s) => s.includes('Hauler II'))).toBe(true)
  })

  it('suggests production runs when enough inputs are available', () => {
    const state = newGame()
    const suggestions = buildActionSuggestions(state)
    // Vanilla starts with ore on hand, so the refinery can run metal smelting.
    expect(suggestions.some((s) => /run \d+ .+ jobs\./i.test(s))).toBe(true)
  })
})
