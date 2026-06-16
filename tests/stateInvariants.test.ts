import { describe, expect, it } from 'vitest'
import { openDatabase } from '../src/database/db.js'
import { createCampaign, loadCampaign, saveState } from '../src/database/saveManager.js'
import {
  assertGameStateInvariants,
  getAllCorporations,
  getNpcCorporations,
  getPlayerCorporation,
  getPlayerCorporationId
} from '../src/simulation/corporations.js'
import { DEFAULT_CORP_ID } from '../src/shared/constants.js'
import { loadVanillaDefs, newGame, sortCorporations, standardScenario } from './helpers.js'

describe('GameState invariants (Phase 3A)', () => {
  it('new game satisfies multi-corporation invariants', () => {
    const state = newGame()
    expect(state.corporations).toHaveLength(3)
    expect(state.playerCorporationId).toBe(DEFAULT_CORP_ID)
    expect(getPlayerCorporationId(state)).toBe(DEFAULT_CORP_ID)
    expect(getNpcCorporations(state)).toHaveLength(2)
    assertGameStateInvariants(state)
  })

  it('save/load round-trip preserves corporations and playerCorporationId', () => {
    const db = openDatabase(':memory:')
    const defs = loadVanillaDefs()
    const state = createCampaign(db, defs, 'Invariant RT', standardScenario(defs))
    assertGameStateInvariants(state)

    saveState(db, state)
    const loaded = loadCampaign(db)
    expect(sortCorporations(loaded.corporations)).toEqual(sortCorporations(state.corporations))
    expect(loaded.playerCorporationId).toBe(state.playerCorporationId)
    expect(getAllCorporations(loaded)).toHaveLength(3)
    assertGameStateInvariants(loaded)
    db.close()
  })

  it('assertGameStateInvariants rejects missing playerCorporationId target', () => {
    const state = newGame()
    state.playerCorporationId = 'missing'
    expect(() => assertGameStateInvariants(state)).toThrow(/not in corporations\[\]/)
  })

  it('helpers expose player corp via corporations[]', () => {
    const state = newGame()
    expect(getPlayerCorporation(state)).toBe(state.corporations[0])
    expect(getPlayerCorporation(state).id).toBe(DEFAULT_CORP_ID)
  })

  it('rejects duplicate open NPC corp market orders', () => {
    const state = newGame()
    const helion = getNpcCorporations(state)[0]!
    const marketId = state.markets[0]!.id
    state.orders.push(
      {
        id: 'dup_a',
        marketId,
        itemId: 'ore',
        side: 'sell',
        quantity: 10,
        remainingQuantity: 10,
        price: 50,
        ownerId: helion.id,
        createdAt: 0
      },
      {
        id: 'dup_b',
        marketId,
        itemId: 'ore',
        side: 'sell',
        quantity: 10,
        remainingQuantity: 10,
        price: 51,
        ownerId: helion.id,
        createdAt: 1
      }
    )
    expect(() => assertGameStateInvariants(state)).toThrow(/Duplicate open NPC corp order/)
  })
})
