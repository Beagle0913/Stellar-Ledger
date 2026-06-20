import { VANILLA_MOD_ID } from '../../shared/constants.js'
import { errorMessage, GameError } from '../../shared/errors.js'
import type {
  DefinitionCounts,
  GameDefinitions,
  ModInfo,
  ModsView
} from '../../shared/types.js'
import { detectModConflicts, modLoadOrder } from '../../mods/modDiagnostics.js'
import { logSystem } from '../log.js'
import type { CampaignSession } from '../campaignSession.js'
import type { ModCatalog } from '../modCatalog.js'

export interface ModServiceDeps {
  session: CampaignSession
  modCatalog: ModCatalog
}

export function definitionCountsFrom(defs: GameDefinitions): DefinitionCounts {
  return {
    items: defs.items.length,
    recipes: defs.recipes.length,
    buildings: defs.buildings.length,
    systems: defs.systems.length,
    planets: defs.planets.length,
    factions: defs.factions.length,
    events: defs.events.length,
    economicProfiles: defs.economicProfiles.length,
    ships: defs.ships.length,
    objectives: defs.objectives.length,
    contractTemplates: defs.contractTemplates.length,
    scenarios: defs.scenarios.length,
    npcCorporations: defs.npcCorporations.length
  }
}

export function createModService(deps: ModServiceDeps) {
  const { session, modCatalog } = deps

  function getMods(): ModsView {
    const { mods, defs, errors } = modCatalog.load()
    const newCampaignCounts = definitionCountsFrom(defs)
    const frozenCounts = session.hasCampaign
      ? definitionCountsFrom(session.require().state.definitions)
      : newCampaignCounts
    const modInfos: ModInfo[] = mods.map((m) => ({
      id: m.manifest.id,
      name: m.manifest.name,
      version: m.manifest.version,
      author: m.manifest.author,
      description: m.manifest.description,
      enabled: m.enabled,
      source: m.manifest.id === VANILLA_MOD_ID ? 'builtin' : m.source
    }))
    return {
      mods: modInfos,
      enabledModIds: mods.filter((m) => m.enabled).map((m) => m.manifest.id),
      loadOrder: modLoadOrder(mods),
      conflicts: detectModConflicts(mods),
      hasActiveCampaign: session.hasCampaign,
      definitionCounts: frozenCounts,
      newCampaignDefinitionCounts: newCampaignCounts,
      validationErrors: errors
    }
  }

  return {
    getMods,

    reloadModData(): ModsView {
      modCatalog.invalidate()
      logSystem('Reloaded mod data from disk')
      return getMods()
    },

    setModEnabled(modId: string, enabled: boolean): ModsView {
      if (modId === VANILLA_MOD_ID) {
        throw new GameError('VALIDATION', 'The vanilla mod cannot be disabled.')
      }
      try {
        modCatalog.setModEnabled(modId, enabled)
      } catch (err) {
        throw new GameError('NOT_FOUND', errorMessage(err))
      }
      logSystem(`Mod "${modId}" ${enabled ? 'enabled' : 'disabled'}`)
      return getMods()
    }
  }
}

export type ModService = ReturnType<typeof createModService>
