import { buildInitialState } from '../simulation/bootstrap.js'
import { loadVanillaDefinitions } from '../shared/vanillaLoader.js'
import type { GameDefinitions, GameState } from '../shared/types.js'

export { loadVanillaDefinitions as loadVanillaDefs, VANILLA_DIR } from '../shared/vanillaLoader.js'

/** Create a fresh in-memory campaign for balance runs. */
export function createCampaignState(
  defs: GameDefinitions = loadVanillaDefinitions(),
  campaignName = 'Balance Run'
): GameState {
  return buildInitialState(defs, campaignName)
}
