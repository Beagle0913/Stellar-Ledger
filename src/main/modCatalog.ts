import { errorMessage } from '../shared/errors.js'
import type { GameDefinitions } from '../shared/types.js'
import { mergeEconomyConfig } from '../shared/economyConfig.js'
import { mergeCampaignStartConfig } from '../shared/campaignStartConfig.js'
import { defaultStandardScenario } from '../shared/scenarios.js'
import { discoverMods, loadModFromDir } from '../mods/modLoader.js'
import { mergeMods } from '../mods/mergeMods.js'
import {
  applyModSettings,
  loadModSettings,
  saveModSettings,
  settingsFromMods
} from '../mods/modSettings.js'
import type { LoadedMod } from '../mods/modTypes.js'

export interface ModCatalogConfig {
  baseDir: string
  vanillaDir: string
  modsDir: string
}

export interface ModCatalogResult {
  mods: LoadedMod[]
  defs: GameDefinitions
  errors: string[]
}

const EMPTY_DEFS = (): GameDefinitions => ({
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
  scenarios: [defaultStandardScenario()]
})

/**
 * Loads and caches vanilla + external mods with settings applied.
 */
export class ModCatalog {
  private cache: ModCatalogResult | null = null

  constructor(private readonly config: ModCatalogConfig) {}

  load(): ModCatalogResult {
    if (!this.cache) this.cache = this.reload()
    return this.cache
  }

  reload(): ModCatalogResult {
    const errors: string[] = []
    const mods: LoadedMod[] = []
    try {
      mods.push(loadModFromDir(this.config.vanillaDir, 'builtin'))
    } catch (err) {
      errors.push(`vanilla: ${errorMessage(err)}`)
    }
    try {
      mods.push(...discoverMods(this.config.modsDir))
    } catch (err) {
      errors.push(`external mods: ${errorMessage(err)}`)
    }

    applyModSettings(mods, loadModSettings(this.config.baseDir))

    let defs = EMPTY_DEFS()
    try {
      defs = mergeMods(mods)
    } catch (err) {
      errors.push(errorMessage(err))
    }
    this.cache = { mods, defs, errors }
    return this.cache
  }

  invalidate(): void {
    this.cache = null
  }

  setModEnabled(modId: string, enabled: boolean): void {
    const { mods } = this.reload()
    const mod = mods.find((m) => m.manifest.id === modId)
    if (!mod) throw new Error(`Unknown mod "${modId}"`)
    mod.enabled = enabled
    saveModSettings(this.config.baseDir, settingsFromMods(mods))
    this.cache = null
  }
}
