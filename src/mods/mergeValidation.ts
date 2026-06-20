import type { GameDefinitions, ObjectiveDefinition } from '../shared/types.js'
import { ModValidationError } from './modTypes.js'

export function assertUnique(
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
export function assertNoObjectiveDependencyCycles(objectives: ObjectiveDefinition[]): void {
  const byId = new Map(objectives.map((o) => [o.id, o]))
  for (const start of objectives) {
    const seen = new Set<string>()
    let cur: string | undefined = start.id
    while (cur) {
      const next: string | undefined = byId.get(cur)?.dependsOnObjectiveId
      if (!next) break
      if (seen.has(next)) {
        throw new ModValidationError(`Objective dependency cycle detected involving "${next}".`)
      }
      seen.add(cur)
      cur = next
    }
  }
}

/** Cross-reference integrity checks after all mods are merged. */
export function validateMergedDefinitions(defs: GameDefinitions): void {
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
        throw new ModValidationError(`Objective "${objective.id}" cannot depend on itself.`)
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

  for (const npc of defs.npcCorporations) {
    if (npc.id === 'player') {
      throw new ModValidationError(`NPC corporation id "${npc.id}" is reserved for the player.`)
    }
    if (!systemIds.has(npc.homeSystemId)) {
      throw new ModValidationError(
        `NPC corporation "${npc.id}" references unknown homeSystemId "${npc.homeSystemId}".`
      )
    }
    if (npc.factionId && !factionIds.has(npc.factionId)) {
      throw new ModValidationError(
        `NPC corporation "${npc.id}" references unknown faction "${npc.factionId}".`
      )
    }
    for (const itemId of Object.keys(npc.startingStock)) {
      if (!itemIds.has(itemId)) {
        throw new ModValidationError(
          `NPC corporation "${npc.id}" startingStock references unknown item "${itemId}".`
        )
      }
    }
    for (const b of npc.buildings) {
      const planet = defs.planets.find((p) => p.id === b.planetId)
      if (!planet) {
        throw new ModValidationError(
          `NPC corporation "${npc.id}" building references unknown planet "${b.planetId}".`
        )
      }
      if (!buildingIds.has(b.buildingType)) {
        throw new ModValidationError(
          `NPC corporation "${npc.id}" building references unknown buildingType "${b.buildingType}".`
        )
      }
    }
    for (const ship of npc.ships ?? []) {
      if (!defs.ships.some((s) => s.id === ship.definitionId)) {
        throw new ModValidationError(
          `NPC corporation "${npc.id}" ship references unknown definition "${ship.definitionId}".`
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
    throw new ModValidationError(`campaign_start homeSystemId "${homeId}" is not a defined system.`)
  }
}
