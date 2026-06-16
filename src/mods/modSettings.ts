import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { VANILLA_MOD_ID } from '../shared/constants.js'
import type { LoadedMod } from './modTypes.js'

/** Player toggles stored beside saves/mods (mod-settings.json). */
export type ModSettings = Record<string, boolean>

const SETTINGS_FILE = 'mod-settings.json'

export function modSettingsPath(baseDir: string): string {
  return join(baseDir, SETTINGS_FILE)
}

export function loadModSettings(baseDir: string): ModSettings {
  const path = modSettingsPath(baseDir)
  if (!existsSync(path)) return {}
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf-8'))
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
    const out: ModSettings = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'boolean') out[key] = value
    }
    return out
  } catch {
    return {}
  }
}

export function saveModSettings(baseDir: string, settings: ModSettings): void {
  writeFileSync(modSettingsPath(baseDir), `${JSON.stringify(settings, null, 2)}\n`, 'utf-8')
}

/** Apply persisted toggles. Vanilla is always enabled; new mods default to enabled. */
export function applyModSettings(mods: LoadedMod[], settings: ModSettings): void {
  for (const mod of mods) {
    if (mod.manifest.id === VANILLA_MOD_ID) {
      mod.enabled = true
      continue
    }
    mod.enabled = settings[mod.manifest.id] ?? true
  }
}

export function settingsFromMods(mods: LoadedMod[]): ModSettings {
  const out: ModSettings = {}
  for (const mod of mods) {
    if (mod.manifest.id === VANILLA_MOD_ID) continue
    out[mod.manifest.id] = mod.enabled
  }
  return out
}
