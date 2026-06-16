import { DEFAULT_CORP_ID } from '../shared/constants.js'
import { GameError } from '../shared/errors.js'
import { NPC_OWNER } from '../shared/types/state.js'
import type { Corporation, CorporationId, GameState } from '../shared/types.js'

/** Player corporation for the active campaign. */
export function getPlayerCorporation(state: GameState): Corporation {
  const corp = state.corporations.find((c) => c.id === state.playerCorporationId)
  if (!corp) {
    throw new GameError(
      'INTERNAL',
      `Player corporation "${state.playerCorporationId}" not found in corporations[].`
    )
  }
  return corp
}

export function getPlayerCorporationId(state: GameState): CorporationId {
  return state.playerCorporationId
}

export function getCorporationById(state: GameState, corporationId: CorporationId): Corporation | undefined {
  return state.corporations.find((c) => c.id === corporationId)
}

export function isPlayerCorporation(state: GameState, corporationId: CorporationId): boolean {
  return state.playerCorporationId === corporationId
}

/** Non-player corporations (empty until Phase 3B seeds NPC defs). */
export function getNpcCorporations(state: GameState): Corporation[] {
  return state.corporations.filter((c) => c.id !== state.playerCorporationId)
}

/** All corporations in the save (player + NPC). */
export function getAllCorporations(state: GameState): Corporation[] {
  return state.corporations
}

export function assertDefaultPlayerCorporationId(id: CorporationId): void {
  if (id !== DEFAULT_CORP_ID) {
    throw new GameError('INTERNAL', `Expected player corporation id "${DEFAULT_CORP_ID}", got "${id}".`)
  }
}

/** Validates multi-corporation state shape (Phase 3A+). */
export function assertGameStateInvariants(state: GameState): void {
  if (state.corporations.length === 0) {
    throw new GameError('INTERNAL', 'GameState must contain at least one corporation.')
  }

  const ids = new Set<string>()
  for (const corp of state.corporations) {
    if (ids.has(corp.id)) {
      throw new GameError('INTERNAL', `Duplicate corporation id "${corp.id}".`)
    }
    ids.add(corp.id)
  }

  if (!ids.has(state.playerCorporationId)) {
    throw new GameError(
      'INTERNAL',
      `playerCorporationId "${state.playerCorporationId}" is not in corporations[].`
    )
  }

  const playerCorps = state.corporations.filter((c) => c.id === state.playerCorporationId)
  if (playerCorps.length !== 1) {
    throw new GameError('INTERNAL', 'Exactly one player corporation must exist.')
  }

  for (const row of state.inventories) {
    if (row.ownerId !== NPC_OWNER && !ids.has(row.ownerId)) {
      throw new GameError(
        'INTERNAL',
        `Inventory owner "${row.ownerId}" is not a known corporation.`
      )
    }
  }

  for (const building of state.buildings) {
    if (!ids.has(building.ownerId)) {
      throw new GameError(
        'INTERNAL',
        `Building owner "${building.ownerId}" is not a known corporation.`
      )
    }
  }

  const openCorpOrderKeys = new Set<string>()
  for (const order of state.orders) {
    if (order.ownerId === NPC_OWNER || order.ownerId === state.playerCorporationId) continue
    if (order.remainingQuantity <= 0) continue
    const key = `${order.ownerId}:${order.marketId}:${order.itemId}:${order.side}`
    if (openCorpOrderKeys.has(key)) {
      throw new GameError(
        'INTERNAL',
        `Duplicate open NPC corp order for ${key}.`
      )
    }
    openCorpOrderKeys.add(key)
  }
}
