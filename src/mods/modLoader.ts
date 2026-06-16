import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { z, ZodTypeAny } from 'zod'
import {
  buildingsFileSchema,
  economicProfilesFileSchema,
  eventsFileSchema,
  factionsFileSchema,
  itemsFileSchema,
  manifestSchema,
  planetsFileSchema,
  recipesFileSchema,
  shipsFileSchema,
  systemsFileSchema,
  objectivesFileSchema,
  contractTemplatesFileSchema,
  economyConfigSchema,
  campaignStartConfigSchema,
  scenariosFileSchema,
  npcCorporationsFileSchema
} from './modSchemas.js'
import { errorMessage } from '../shared/errors.js'
import { LoadedMod, ModManifest, ModValidationError } from './modTypes.js'

// The mod loader reads mod folders from disk and validates each JSON file with
// Zod. It performs NO cross-mod reference checks (that is validateMods + mergeMods).
// It only guarantees each file is structurally valid.

function readJson(path: string): unknown {
  const raw = readFileSync(path, 'utf-8')
  try {
    return JSON.parse(raw)
  } catch (err) {
    throw new ModValidationError(`Invalid JSON in ${path}: ${errorMessage(err)}`)
  }
}

function parseOptionalFile<S extends ZodTypeAny>(
  dir: string,
  fileName: string,
  schema: S
): z.infer<S> {
  const path = join(dir, fileName)
  // Missing optional content files are treated as empty arrays.
  if (!existsSync(path)) return [] as z.infer<S>
  const result = schema.safeParse(readJson(path))
  if (!result.success) {
    throw new ModValidationError(
      `Validation failed for ${path}:\n${result.error.issues
        .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
        .join('\n')}`
    )
  }
  return result.data
}

function parseOptionalObject<S extends ZodTypeAny>(
  dir: string,
  fileName: string,
  schema: S
): z.infer<S> | null {
  const path = join(dir, fileName)
  if (!existsSync(path)) return null
  const result = schema.safeParse(readJson(path))
  if (!result.success) {
    throw new ModValidationError(
      `Validation failed for ${path}:\n${result.error.issues
        .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
        .join('\n')}`
    )
  }
  return result.data
}

/** Load a single mod from a directory (must contain mod.json). */
export function loadModFromDir(dir: string, source: 'builtin' | 'external'): LoadedMod {
  const manifestPath = join(dir, 'mod.json')
  if (!existsSync(manifestPath)) {
    throw new ModValidationError(`Missing mod.json in ${dir}`)
  }
  const manifestResult = manifestSchema.safeParse(readJson(manifestPath))
  if (!manifestResult.success) {
    throw new ModValidationError(
      `Invalid mod.json in ${dir}:\n${manifestResult.error.issues
        .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
        .join('\n')}`
    )
  }
  const manifest: ModManifest = manifestResult.data

  return {
    manifest,
    source,
    enabled: true,
    items: parseOptionalFile(dir, 'items.json', itemsFileSchema),
    recipes: parseOptionalFile(dir, 'recipes.json', recipesFileSchema),
    buildings: parseOptionalFile(dir, 'buildings.json', buildingsFileSchema),
    systems: parseOptionalFile(dir, 'systems.json', systemsFileSchema),
    planets: parseOptionalFile(dir, 'planets.json', planetsFileSchema),
    factions: parseOptionalFile(dir, 'factions.json', factionsFileSchema),
    events: parseOptionalFile(dir, 'events.json', eventsFileSchema),
    economicProfiles: parseOptionalFile(dir, 'economic_profiles.json', economicProfilesFileSchema),
    ships: parseOptionalFile(dir, 'ships.json', shipsFileSchema),
    objectives: parseOptionalFile(dir, 'objectives.json', objectivesFileSchema),
    contractTemplates: parseOptionalFile(dir, 'contract_templates.json', contractTemplatesFileSchema),
    economyConfig: parseOptionalObject(dir, 'economy_config.json', economyConfigSchema) ?? {},
    campaignStartConfig:
      parseOptionalObject(dir, 'campaign_start.json', campaignStartConfigSchema) ?? {},
    scenarios: parseOptionalFile(dir, 'scenarios.json', scenariosFileSchema),
    npcCorporations: parseOptionalFile(dir, 'npc_corporations.json', npcCorporationsFileSchema)
  }
}

/** Discover every immediate sub-directory of `modsDir` that contains a mod.json. */
export function discoverMods(modsDir: string): LoadedMod[] {
  if (!existsSync(modsDir)) return []
  const out: LoadedMod[] = []
  for (const entry of readdirSync(modsDir)) {
    const full = join(modsDir, entry)
    if (!statSync(full).isDirectory()) continue
    if (!existsSync(join(full, 'mod.json'))) continue
    out.push(loadModFromDir(full, 'external'))
  }
  return out
}
