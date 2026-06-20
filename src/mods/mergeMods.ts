import type { GameDefinitions, ObjectiveDefinition } from '../shared/types.js'
import { mergeEconomyConfig } from '../shared/economyConfig.js'
import { mergeCampaignStartConfig } from '../shared/campaignStartConfig.js'
import { LoadedMod } from './modTypes.js'
import { assertUnique, validateMergedDefinitions } from './mergeValidation.js'
import { resolveLoadOrder } from './validateMods.js'

// Merge a set of loaded+ordered mods into one GameDefinitions set, enforcing all
// uniqueness and reference-integrity rules from the spec.

/**
 * Merge enabled mods into a single, fully validated GameDefinitions.
 *
 * Validation enforced here:
 *  - unique item / recipe / building / system / planet / faction / event ids
 *  - recipe input & output item ids must exist
 *  - recipe.buildingType must reference an existing building definition
 *  - planet.systemId must reference an existing system
 *  - event item references (trigger/effect) must exist
 */
export function mergeMods(mods: LoadedMod[]): GameDefinitions {
  const enabled = mods.filter((m) => m.enabled)
  const ordered = resolveLoadOrder(enabled)

  const defs: GameDefinitions = {
    items: [],
    recipes: [],
    buildings: [],
    systems: [],
    planets: [],
    factions: [],
    events: [],
    economicProfiles: [],
    ships: [],
    objectives: [],
    contractTemplates: [],
    economyConfig: mergeEconomyConfig(undefined),
    campaignStartConfig: mergeCampaignStartConfig(undefined),
    scenarios: [],
    npcCorporations: []
  }

  const scenarioOwners = new Map<string, string>()
  const npcCorpOwners = new Map<string, string>()
  const itemOwners = new Map<string, string>()
  const recipeOwners = new Map<string, string>()
  const buildingOwners = new Map<string, string>()
  const systemOwners = new Map<string, string>()
  const planetOwners = new Map<string, string>()
  const factionOwners = new Map<string, string>()
  const eventOwners = new Map<string, string>()
  const profileOwners = new Map<string, string>()
  const shipOwners = new Map<string, string>()
  const objectiveOwners = new Map<string, string>()
  const contractTemplateOwners = new Map<string, string>()

  for (const mod of ordered) {
    const modId = mod.manifest.id
    for (const item of mod.items) {
      assertUnique('item', item.id, itemOwners, modId)
      defs.items.push(item)
    }
    for (const building of mod.buildings) {
      assertUnique('building', building.id, buildingOwners, modId)
      defs.buildings.push(building)
    }
    for (const recipe of mod.recipes) {
      assertUnique('recipe', recipe.id, recipeOwners, modId)
      defs.recipes.push(recipe)
    }
    for (const system of mod.systems) {
      assertUnique('system', system.id, systemOwners, modId)
      defs.systems.push(system)
    }
    for (const planet of mod.planets) {
      assertUnique('planet', planet.id, planetOwners, modId)
      defs.planets.push(planet)
    }
    for (const faction of mod.factions) {
      assertUnique('faction', faction.id, factionOwners, modId)
      defs.factions.push(faction)
    }
    for (const event of mod.events) {
      assertUnique('event', event.id, eventOwners, modId)
      defs.events.push(event)
    }
    for (const profile of mod.economicProfiles) {
      assertUnique('economic profile', profile.id, profileOwners, modId)
      defs.economicProfiles.push(profile)
    }
    for (const ship of mod.ships) {
      assertUnique('ship', ship.id, shipOwners, modId)
      defs.ships.push(ship)
    }
    for (const objective of mod.objectives) {
      assertUnique('objective', objective.id, objectiveOwners, modId)
      defs.objectives.push(objective)
    }
    for (const template of mod.contractTemplates) {
      assertUnique('contract template', template.id, contractTemplateOwners, modId)
      defs.contractTemplates.push(template)
    }
    for (const scenario of mod.scenarios) {
      assertUnique('scenario', scenario.id, scenarioOwners, modId)
      defs.scenarios.push(scenario)
    }
    for (const npc of mod.npcCorporations) {
      assertUnique('NPC corporation', npc.id, npcCorpOwners, modId)
      defs.npcCorporations.push(npc)
    }
    defs.economyConfig = mergeEconomyConfig({ ...defs.economyConfig, ...mod.economyConfig })
    defs.campaignStartConfig = mergeCampaignStartConfig({
      ...defs.campaignStartConfig,
      ...mod.campaignStartConfig,
      startingStock: {
        ...defs.campaignStartConfig.startingStock,
        ...mod.campaignStartConfig.startingStock
      }
    })
  }

  validateMergedDefinitions(defs)
  return defs
}

export { assertUnique, assertNoObjectiveDependencyCycles, validateMergedDefinitions } from './mergeValidation.js'
