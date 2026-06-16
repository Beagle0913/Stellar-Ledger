import { describe, expect, it } from 'vitest'
import {
  getAllCorporations,
  getNpcCorporations,
  getPlayerCorporation,
  getPlayerCorporationId,
  isPlayerCorporation
} from '../src/simulation/corporations.js'
import { DEFAULT_CORP_ID } from '../src/shared/constants.js'
import { newGame } from './helpers.js'

describe('corporation helpers', () => {
  it('getPlayerCorporation returns player entry from corporations[]', () => {
    const state = newGame()
    expect(getPlayerCorporation(state).id).toBe(DEFAULT_CORP_ID)
    expect(getPlayerCorporation(state)).toBe(state.corporations[0])
    expect(state.playerCorporationId).toBe(DEFAULT_CORP_ID)
  })

  it('getPlayerCorporationId matches default player id', () => {
    const state = newGame()
    expect(getPlayerCorporationId(state)).toBe(DEFAULT_CORP_ID)
    expect(isPlayerCorporation(state, DEFAULT_CORP_ID)).toBe(true)
    expect(isPlayerCorporation(state, 'other')).toBe(false)
  })

  it('getNpcCorporations is empty before Phase 3B', () => {
    expect(getNpcCorporations(newGame())).toEqual([])
  })

  it('getAllCorporations returns single player corp', () => {
    const state = newGame()
    expect(getAllCorporations(state)).toHaveLength(1)
    expect(getAllCorporations(state)[0]!.id).toBe(DEFAULT_CORP_ID)
  })
})
