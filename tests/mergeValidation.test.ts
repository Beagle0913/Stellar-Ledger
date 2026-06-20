import { describe, expect, it } from 'vitest'
import { ModValidationError } from '../src/mods/modTypes.js'
import { assertNoObjectiveDependencyCycles, validateMergedDefinitions } from '../src/mods/mergeValidation.js'
import { mergeEconomyConfig } from '../src/shared/economyConfig.js'
import { mergeCampaignStartConfig } from '../src/shared/campaignStartConfig.js'
import type { GameDefinitions } from '../src/shared/types.js'

function minimalDefs(overrides: Partial<GameDefinitions> = {}): GameDefinitions {
  return {
    items: [{ id: 'ore', name: 'Ore', category: 'raw', baseValue: 1, volume: 1 }],
    recipes: [],
    buildings: [],
    systems: [{ id: 'sys_a', name: 'A', x: 0, y: 0 }],
    planets: [
      {
        id: 'p_a',
        name: 'A',
        systemId: 'sys_a',
        planetType: 'barren',
        habitability: 0.2,
        mineralRichness: 0.5,
        fertility: 0.1,
        energyPotential: 0.1,
        population: 0,
        modifiers: {}
      }
    ],
    factions: [],
    events: [],
    economicProfiles: [],
    ships: [],
    objectives: [],
    contractTemplates: [],
    economyConfig: mergeEconomyConfig(undefined),
    campaignStartConfig: mergeCampaignStartConfig(undefined),
    scenarios: [],
    npcCorporations: [],
    ...overrides
  }
}

describe('mergeValidation', () => {
  it('detects objective dependency cycles', () => {
    expect(() =>
      assertNoObjectiveDependencyCycles([
        {
          id: 'x',
          title: 'X',
          description: '',
          type: 'stockpile',
          itemId: 'ore',
          target: 1,
          dependsOnObjectiveId: 'y'
        },
        {
          id: 'y',
          title: 'Y',
          description: '',
          type: 'stockpile',
          itemId: 'ore',
          target: 1,
          dependsOnObjectiveId: 'x'
        }
      ] as GameDefinitions['objectives'])
    ).toThrow(ModValidationError)
  })

  it('rejects recipes referencing unknown items', () => {
    const defs = minimalDefs({
      recipes: [
        {
          id: 'bad',
          name: 'Bad',
          buildingType: 'mine',
          duration: 1,
          inputs: [{ itemId: 'missing', quantity: 1 }],
          outputs: [{ itemId: 'ore', quantity: 1 }]
        }
      ],
      buildings: [{ id: 'mine', name: 'Mine', buildCost: 0, buildMaterials: [] }]
    })
    expect(() => validateMergedDefinitions(defs)).toThrow(ModValidationError)
  })
})
