import { DEFAULT_CORP_ID } from '../shared/constants.js'
import { GameError } from '../shared/errors.js'
import type { Corporation, CorporationId, GameState } from '../shared/types.js'

/** Player corporation (today: sole entry in state; Phase 3A adds corporations[]). */
export function getPlayerCorporation(state: GameState): Corporation {
  if (state.playerCorporationId && state.corporations?.length) {
    const corp = state.corporations.find((c) => c.id === state.playerCorporationId)
    if (corp) return corp
    throw new GameError('INTERNAL', `Player corporation "${state.playerCorporationId}" not found.`)
  }
  return state.corporation
}

export function getPlayerCorporationId(state: GameState): CorporationId {
  return state.playerCorporationId ?? state.corporation.id
}

export function getCorporationById(state: GameState, corporationId: CorporationId): Corporation | undefined {
  if (state.corporations?.length) {
    return state.corporations.find((c) => c.id === corporationId)
  }
  if (state.corporation.id === corporationId) return state.corporation
  return undefined
}

export function isPlayerCorporation(state: GameState, corporationId: CorporationId): boolean {
  return getPlayerCorporationId(state) === corporationId
}

/** Non-player corporations (empty until Phase 3B seeds NPC defs). */
export function getNpcCorporations(state: GameState): Corporation[] {
  const playerId = getPlayerCorporationId(state)
  if (state.corporations?.length) {
    return state.corporations.filter((c) => c.id !== playerId)
  }
  return []
}

/** All corporations in the save (player + NPC). */
export function getAllCorporations(state: GameState): Corporation[] {
  if (state.corporations?.length) return state.corporations
  return [state.corporation]
}

export function assertDefaultPlayerCorporationId(id: CorporationId): void {
  if (id !== DEFAULT_CORP_ID) {
    throw new GameError('INTERNAL', `Expected player corporation id "${DEFAULT_CORP_ID}", got "${id}".`)
  }
}
