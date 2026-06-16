import type { GameDefinitions, ObjectiveDefinition } from '../shared/types.js'
import { mergeEconomyConfig } from '../shared/economyConfig.js'
import { mergeCampaignStartConfig } from '../shared/campaignStartConfig.js'
import { LoadedMod, ModValidationError } from './modTypes.js'
import { resolveLoadOrder } from './validateMods.js'

// Merge a set of loaded+ordered mods into one GameDefinitions set, enforcing all
// uniqueness and reference-integrity rules from the spec.

function assertUnique(
  kind: string,
  id: string,
  owners: Map<string, string>,
  modId: string
): void {
  const existing = owners.get(id)
  if (existing !== undefined) {
    throw new ModValidationError(
      `Duplicate ${kind} id "${id}": defined by both "${existing}" and "${modId}".`
    )
  }
  owners.set(id, modId)
}

/** Reject dependsOnObjectiveId chains that loop (e.g. A → B → C → A). */
function assertNoObjectiveDependencyCycles(objectives: ObjectiveDefinition[]): void {
  const byId = new Map(objectives.map((o) => [o.id, o]))
  for (const start of objectives) {
    const seen = new Set<string>()
    let cur: string | undefined = start.id
    while (cur) {
      const next: string | undefined = byId.get(cur)?.dependsOnObjectiveId
      if (!next) break
      if (seen.has(next)) {
        throw new ModValidationError(
          `Objective dependency cycle detected involving "${next}".`
        )
      }
      seen.add(cur)
      cur = next
    }
  }
}

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
    scenarios: []
  }

  const scenarioOwners = new Map<string, string>()
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

  const profileIds = new Set(defs.economicProfiles.map((p) => p.id))
  const itemIds = new Set(defs.items.map((i) => i.id))
  const buildingIds = new Set(defs.buildings.map((b) => b.id))
  const systemIds = new Set(defs.systems.map((s) => s.id))
  const factionIds = new Set(defs.factions.map((f) => f.id))

  for (const recipe of defs.recipes) {
    if (!buildingIds.has(recipe.buildingType)) {
      throw new ModValidationError(
        `Recipe "${recipe.id}" references unknown buildingType "${recipe.buildingType}".`
      )
    }
    for (const io of [...recipe.inputs, ...recipe.outputs]) {
      if (!itemIds.has(io.itemId)) {
        throw new ModValidationError(
          `Recipe "${recipe.id}" references unknown item "${io.itemId}".`
        )
      }
    }
  }

  for (const building of defs.buildings) {
    for (const io of building.buildMaterials) {
      if (!itemIds.has(io.itemId)) {
        throw new ModValidationError(
          `Building "${building.id}" build material references unknown item "${io.itemId}".`
        )
      }
    }
  }

  for (const planet of defs.planets) {
    if (!systemIds.has(planet.systemId)) {
      throw new ModValidationError(
        `Planet "${planet.id}" references unknown system "${planet.systemId}".`
      )
    }
    if (planet.economicProfileId && !profileIds.has(planet.economicProfileId)) {
      throw new ModValidationError(
        `Planet "${planet.id}" references unknown economic profile "${planet.economicProfileId}".`
      )
    }
  }

  for (const system of defs.systems) {
    if (system.economicProfileId && !profileIds.has(system.economicProfileId)) {
      throw new ModValidationError(
        `System "${system.id}" references unknown economic profile "${system.economicProfileId}".`
      )
    }
    if (system.controllingFactionId && !factionIds.has(system.controllingFactionId)) {
      throw new ModValidationError(
        `System "${system.id}" references unknown faction "${system.controllingFactionId}".`
      )
    }
  }

  for (const profile of defs.economicProfiles) {
    for (const rule of profile.items) {
      if (!itemIds.has(rule.itemId)) {
        throw new ModValidationError(
          `Economic profile "${profile.id}" references unknown item "${rule.itemId}".`
        )
      }
    }
  }

  const objectiveIds = new Set(defs.objectives.map((o) => o.id))

  for (const event of defs.events) {
    if (
      (event.trigger.type === 'lowStock' || event.trigger.type === 'stockpileShortage') &&
      !itemIds.has(event.trigger.itemId)
    ) {
      throw new ModValidationError(
        `Event "${event.id}" trigger references unknown item "${event.trigger.itemId}".`
      )
    }
    if (
      (event.effect.type === 'priceShock' || event.effect.type === 'stockpileShock') &&
      !itemIds.has(event.effect.itemId)
    ) {
      throw new ModValidationError(
        `Event "${event.id}" effect references unknown item "${event.effect.itemId}".`
      )
    }
    if (event.requiresCompletedObjectiveId && !objectiveIds.has(event.requiresCompletedObjectiveId)) {
      throw new ModValidationError(
        `Event "${event.id}" requiresCompletedObjectiveId references unknown objective "${event.requiresCompletedObjectiveId}".`
      )
    }
  }

  for (const objective of defs.objectives) {
    if (objective.itemId && !itemIds.has(objective.itemId)) {
      throw new ModValidationError(
        `Objective "${objective.id}" references unknown item "${objective.itemId}".`
      )
    }
    if (objective.dependsOnObjectiveId) {
      if (objective.dependsOnObjectiveId === objective.id) {
        throw new ModValidationError(
          `Objective "${objective.id}" cannot depend on itself.`
        )
      }
      if (!objectiveIds.has(objective.dependsOnObjectiveId)) {
        throw new ModValidationError(
          `Objective "${objective.id}" dependsOnObjectiveId references unknown objective "${objective.dependsOnObjectiveId}".`
        )
      }
    }
  }
  assertNoObjectiveDependencyCycles(defs.objectives)

  for (const template of defs.contractTemplates) {
    if (!factionIds.has(template.factionId)) {
      throw new ModValidationError(
        `Contract template "${template.id}" references unknown faction "${template.factionId}".`
      )
    }
    for (const tier of template.tiers) {
      if (tier.itemId && !itemIds.has(tier.itemId)) {
        throw new ModValidationError(
          `Contract template "${template.id}" tier references unknown item "${tier.itemId}".`
        )
      }
      if (tier.shipDefinitionId && !defs.ships.some((s) => s.id === tier.shipDefinitionId)) {
        throw new ModValidationError(
          `Contract template "${template.id}" tier references unknown ship "${tier.shipDefinitionId}".`
        )
      }
    }
  }

  if (!itemIds.has(defs.economyConfig.populationFoodItemId)) {
    throw new ModValidationError(
      `economy_config populationFoodItemId "${defs.economyConfig.populationFoodItemId}" is not a defined item.`
    )
  }
  if (!itemIds.has(defs.economyConfig.fuelItemId)) {
    throw new ModValidationError(
      `economy_config fuelItemId "${defs.economyConfig.fuelItemId}" is not a defined item.`
    )
  }
  if (defs.economyConfig.npcLiquidityMinFraction > defs.economyConfig.npcLiquidityMaxFraction) {
    throw new ModValidationError(
      'economy_config npcLiquidityMinFraction must be <= npcLiquidityMaxFraction.'
    )
  }

  for (const itemId of Object.keys(defs.campaignStartConfig.startingStock)) {
    if (!itemIds.has(itemId)) {
      throw new ModValidationError(
        `campaign_start startingStock references unknown item "${itemId}".`
      )
    }
  }
  for (const buildingId of defs.campaignStartConfig.startingBuildingTypes) {
    if (!buildingIds.has(buildingId)) {
      throw new ModValidationError(
        `campaign_start startingBuildingTypes references unknown building "${buildingId}".`
      )
    }
  }
  const homeId = defs.campaignStartConfig.homeSystemId
  if (homeId && !systemIds.has(homeId)) {
    throw new ModValidationError(
      `campaign_start homeSystemId "${homeId}" is not a defined system.`
    )
  }

  return defs
}
