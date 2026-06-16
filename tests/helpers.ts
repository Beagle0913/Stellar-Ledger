import { join } from 'node:path'
import { loadModFromDir } from '../src/mods/modLoader.js'
import { mergeMods } from '../src/mods/mergeMods.js'
import { buildInitialState } from '../src/database/saveManager.js'
import { getPlayerCorporation, getPlayerCorporationId } from '../src/simulation/corporations.js'
import { resolveScenario, STANDARD_SCENARIO_ID } from '../src/shared/scenarios.js'
import type { GameDefinitions, GameState } from '../src/shared/types.js'

// Shared test utilities. Tests run headlessly under Node against the real vanilla
// data and pure in-memory GameState — no Electron, no SQLite required.

export const VANILLA_DIR = join(process.cwd(), 'data', 'vanilla')

export function loadVanillaDefs(): GameDefinitions {
  const vanilla = loadModFromDir(VANILLA_DIR, 'builtin')
  return mergeMods([vanilla])
}

export function standardScenario(defs: GameDefinitions = loadVanillaDefs()) {
  return resolveScenario(defs, STANDARD_SCENARIO_ID)
}

export function newGame(): GameState {
  return buildInitialState(loadVanillaDefs(), 'Test Campaign')
}

export { getPlayerCorporation, getPlayerCorporationId } from '../src/simulation/corporations.js'

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

export function playerShip(state: GameState) {
  const ship = state.ships.find((s) => s.ownerId === getPlayerCorporationId(state))
  if (!ship) throw new Error('Test setup: no player ship.')
  return ship
}
