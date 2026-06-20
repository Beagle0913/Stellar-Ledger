import { join } from 'node:path'
import { buildInitialState } from '../src/database/saveManager.js'
import { getPlayerCorporation, getPlayerCorporationId } from '../src/simulation/corporations.js'
import { DEFAULT_CORP_ID } from '../src/shared/constants.js'
import { getGalaxyMeta } from '../src/shared/galaxyMeta.js'
import { marketIdForSystem } from '../src/shared/ids.js'
import { resolveScenario, STANDARD_SCENARIO_ID } from '../src/shared/scenarios.js'
import { loadVanillaDefinitions, VANILLA_DIR } from '../src/shared/vanillaLoader.js'
import type { GameDefinitions, GameState } from '../src/shared/types.js'

// Shared test utilities. Tests run headlessly under Node against the real vanilla
// data and pure in-memory GameState — no Electron, no SQLite required.

export { VANILLA_DIR, loadVanillaDefinitions }

export function loadVanillaDefs(): GameDefinitions {
  return loadVanillaDefinitions()
}

export function standardScenario(defs: GameDefinitions = loadVanillaDefs()) {
  return resolveScenario(defs, STANDARD_SCENARIO_ID)
}

export function newGame(): GameState {
  return buildInitialState(loadVanillaDefs(), 'Test Campaign')
}

export { getPlayerCorporation, getPlayerCorporationId } from '../src/simulation/corporations.js'

function requireGalaxyMeta() {
  const meta = getGalaxyMeta(VANILLA_DIR)
  if (!meta) throw new Error('galaxy-meta.json missing — run pnpm generate:galaxy')
  return meta
}

/** Home system id from committed galaxy-meta.json. */
export function getHomeSystemId(): string {
  return requireGalaxyMeta().homeSystemId
}

/** Home planet id from committed galaxy-meta.json. */
export function getHomePlanetId(): string {
  return requireGalaxyMeta().homePlanetId
}

/** First planet id using the given economic profile. */
export function getFirstPlanetWithProfile(profileId: string): string {
  const planet = loadVanillaDefs().planets.find((p) => p.economicProfileId === profileId)
  if (!planet) throw new Error(`Test setup: no planet with profile ${profileId}.`)
  return planet.id
}

/** First system controlled by the given faction. */
export function getSystemByFaction(factionId: string): string {
  const system = loadVanillaDefs().systems.find((s) => s.controllingFactionId === factionId)
  if (!system) throw new Error(`Test setup: no system for faction ${factionId}.`)
  return system.id
}

/** NPC corp placement from galaxy-meta.json. */
export function getGeneratedNpcCorp(corpId: string): { homeSystemId: string; planetId: string } {
  const corp = requireGalaxyMeta().npcCorps[corpId]
  if (!corp) throw new Error(`Test setup: unknown NPC corp ${corpId}.`)
  return corp
}

/** Any system that is not the campaign home system. */
export function getSampleNonHomeSystemId(): string {
  const home = getHomeSystemId()
  const other = loadVanillaDefs().systems.find((s) => s.id !== home)
  if (!other) throw new Error('Test setup: no second system in vanilla data.')
  return other.id
}

export function homeMarketId(): string {
  return marketIdForSystem(getHomeSystemId())
}

/** First system id that is not the corporation's home system. */
export function otherSystemId(state: GameState): string {
  const home = getPlayerCorporation(state).homeSystemId
  const other = state.definitions.systems.find((s) => s.id !== home)
  if (!other) throw new Error('Test setup: no second system in vanilla data.')
  return other.id
}

export function homeSystemId(state: GameState): string {
  return getPlayerCorporation(state).homeSystemId
}

export function playerShips(state: GameState) {
  return state.ships.filter((s) => s.ownerId === getPlayerCorporationId(state))
}

export function playerShip(state: GameState) {
  const ship = playerShips(state)[0]
  if (!ship) throw new Error('Test setup: no player ship.')
  return ship
}

/** Strip NPC runtime rows to simulate a pre-Phase-3B single-corp save. */
export function stripNpcRuntimeState(state: GameState): void {
  state.corporations = state.corporations.filter((c) => c.id === DEFAULT_CORP_ID)
  const playerId = getPlayerCorporationId(state)
  state.inventories = state.inventories.filter((i) => i.ownerId === playerId)
  state.buildings = state.buildings.filter((b) => b.ownerId === playerId)
  state.ships = state.ships.filter((s) => s.ownerId === playerId)
  state.orders = state.orders.filter((o) => o.ownerId === playerId || o.ownerId === 'npc')
  state.transportJobs = state.transportJobs.filter((j) => j.ownerId === playerId)
  state.productionJobs = state.productionJobs.filter((j) => {
    const building = state.buildings.find((b) => b.id === j.buildingId)
    return building?.ownerId === playerId
  })
}

export function sortCorporations<T extends { id: string }>(corps: T[]): T[] {
  return [...corps].sort((a, b) => a.id.localeCompare(b.id))
}
