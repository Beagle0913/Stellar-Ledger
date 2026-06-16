import { describe, expect, it } from 'vitest'
import { openDatabase } from '../src/database/db.js'
import { createCampaign, loadCampaign } from '../src/database/saveManager.js'
import { GameError } from '../src/shared/errors.js'
import {
  applyScenarioToDefinitions,
  resolveScenario,
  STANDARD_SCENARIO_ID
} from '../src/shared/scenarios.js'
import { DEFAULT_CAMPAIGN_START_CONFIG } from '../src/shared/campaignStartConfig.js'
import { getPlayerCorporation, loadVanillaDefs, standardScenario } from './helpers.js'

describe('scenarios', () => {
  const defs = loadVanillaDefs()

  it('loads vanilla scenarios including standard', () => {
    expect(defs.scenarios.length).toBeGreaterThanOrEqual(4)
    expect(defs.scenarios.some((s) => s.id === STANDARD_SCENARIO_ID)).toBe(true)
  })

  it('standard scenario matches previous default campaign start', () => {
    const standard = standardScenario(defs)
    const applied = applyScenarioToDefinitions(defs, standard)
    expect(applied.campaignStartConfig.startingCredits).toBe(
      DEFAULT_CAMPAIGN_START_CONFIG.startingCredits
    )
    expect(applied.campaignStartConfig.startingBuildingTypes).toEqual(
      DEFAULT_CAMPAIGN_START_CONFIG.startingBuildingTypes
    )
  })

  it('easy scenario starts with more credits than hard', () => {
    const easy = resolveScenario(defs, 'prospector_easy')
    const hard = resolveScenario(defs, 'barebones_hard')
    const easyApplied = applyScenarioToDefinitions(defs, easy)
    const hardApplied = applyScenarioToDefinitions(defs, hard)
    expect(easyApplied.campaignStartConfig.startingCredits).toBeGreaterThan(
      hardApplied.campaignStartConfig.startingCredits
    )
  })

  it('rejects invalid scenario id', () => {
    expect(() => resolveScenario(defs, 'no_such_scenario')).toThrow(GameError)
  })

  it('snapshots scenario into new save metadata', () => {
    const db = openDatabase(':memory:')
    const scenario = resolveScenario(defs, 'prospector_easy')
    const state = createCampaign(db, defs, 'Easy Run', scenario)
    expect(state.meta.scenario?.id).toBe('prospector_easy')
    expect(getPlayerCorporation(state).credits).toBe(52_000)

    const reloaded = loadCampaign(db)
    expect(reloaded.meta.scenario?.id).toBe('prospector_easy')
    expect(reloaded.meta.scenario?.config.id).toBe('prospector_easy')
    db.close()
  })

  it('old save without scenario config loads with standard defaults', () => {
    const db = openDatabase(':memory:')
    createCampaign(db, defs, 'Legacy', standardScenario(defs))
    db.prepare('UPDATE campaign_meta SET scenario_config_json = NULL').run()
    const loaded = loadCampaign(db)
    expect(loaded.meta.scenario?.id).toBe('standard')
    db.close()
  })
})
