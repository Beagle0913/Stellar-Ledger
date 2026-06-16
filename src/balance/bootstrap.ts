import { join } from 'node:path'
import { loadModFromDir } from '../mods/modLoader.js'
import { mergeMods } from '../mods/mergeMods.js'
import { buildInitialState } from '../simulation/bootstrap.js'
import type { GameDefinitions, GameState } from '../shared/types.js'

export const VANILLA_DIR = join(process.cwd(), 'data', 'vanilla')

/** Load merged vanilla game definitions (no database). */
export function loadVanillaDefs(): GameDefinitions {
  const vanilla = loadModFromDir(VANILLA_DIR, 'builtin')
  return mergeMods([vanilla])
}

/** Create a fresh in-memory campaign for balance runs. */
export function createCampaignState(
  defs: GameDefinitions = loadVanillaDefs(),
  campaignName = 'Balance Run'
): GameState {
  return buildInitialState(defs, campaignName)
}
