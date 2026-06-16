import { GameError } from '../shared/errors.js'
import { mergeCampaignStartConfig } from './campaignStartConfig.js'
import { mergeEconomyConfig } from './economyConfig.js'
import type { GameDefinitions, ScenarioDefinition } from './types/definitions.js'

export const STANDARD_SCENARIO_ID = 'standard'

/** Built-in fallback when no scenarios.json is present. */
export function defaultStandardScenario(): ScenarioDefinition {
  return {
    id: STANDARD_SCENARIO_ID,
    name: 'Standard',
    description: 'Balanced industrial start matching vanilla defaults.',
    difficulty: 'normal',
    campaignStart: {}
  }
}

export function findScenario(defs: GameDefinitions, scenarioId: string): ScenarioDefinition | undefined {
  return defs.scenarios.find((s) => s.id === scenarioId)
}

export function resolveScenario(defs: GameDefinitions, scenarioId: string): ScenarioDefinition {
  const scenario = findScenario(defs, scenarioId)
  if (!scenario) {
    throw new GameError('VALIDATION', `Unknown scenario "${scenarioId}".`)
  }
  return scenario
}

/** Apply a scenario preset onto merged mod definitions (new campaigns only). */
export function applyScenarioToDefinitions(
  defs: GameDefinitions,
  scenario: ScenarioDefinition
): GameDefinitions {
  const campaignStartConfig = mergeCampaignStartConfig({
    ...defs.campaignStartConfig,
    ...scenario.campaignStart,
    startingStock: {
      ...defs.campaignStartConfig.startingStock,
      ...scenario.campaignStart.startingStock
    }
  })
  const economyConfig = mergeEconomyConfig({
    ...defs.economyConfig,
    ...scenario.economyConfigOverrides
  })
  let objectives = defs.objectives
  if (scenario.startingObjectiveIds?.length) {
    const allowed = new Set(scenario.startingObjectiveIds)
    for (const o of defs.objectives) {
      if (o.dependsOnObjectiveId) allowed.add(o.dependsOnObjectiveId)
    }
    objectives = defs.objectives.filter((o) => allowed.has(o.id))
  }
  return {
    ...defs,
    campaignStartConfig,
    economyConfig,
    objectives
  }
}

export function scenarioSnapshotFrom(scenario: ScenarioDefinition): {
  id: string
  name: string
  difficulty: ScenarioDefinition['difficulty']
  config: ScenarioDefinition
} {
  return {
    id: scenario.id,
    name: scenario.name,
    difficulty: scenario.difficulty,
    config: structuredClone(scenario)
  }
}

/** Reconstruct bootstrap defs from frozen scenario snapshot stored in save. */
export function definitionsFromScenarioSnapshot(
  defs: GameDefinitions,
  snapshot: ScenarioDefinition
): GameDefinitions {
  return applyScenarioToDefinitions(defs, snapshot)
}

/** Default scenario for legacy saves missing scenario metadata. */
export function legacyStandardScenarioSnapshot(): ScenarioDefinition {
  return defaultStandardScenario()
}
