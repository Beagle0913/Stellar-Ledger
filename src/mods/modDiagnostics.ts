import type { LoadedMod } from './modTypes.js'
import { resolveLoadOrder } from './validateMods.js'
import type { ModConflictWarning } from '../shared/types.js'

type ContentKey =
  | 'items'
  | 'recipes'
  | 'buildings'
  | 'systems'
  | 'planets'
  | 'factions'
  | 'events'
  | 'economicProfiles'
  | 'ships'
  | 'objectives'
  | 'contractTemplates'

const CONTENT_KINDS: Array<{ kind: string; key: ContentKey }> = [
  { kind: 'item', key: 'items' },
  { kind: 'recipe', key: 'recipes' },
  { kind: 'building', key: 'buildings' },
  { kind: 'system', key: 'systems' },
  { kind: 'planet', key: 'planets' },
  { kind: 'faction', key: 'factions' },
  { kind: 'event', key: 'events' },
  { kind: 'economic profile', key: 'economicProfiles' },
  { kind: 'ship', key: 'ships' },
  { kind: 'objective', key: 'objectives' },
  { kind: 'contract template', key: 'contractTemplates' }
]

function entryId(_key: ContentKey, entry: unknown): string {
  return (entry as { id: string }).id
}

/**
 * Find duplicate content ids across enabled mods without merging.
 * mergeMods throws on the first duplicate; this surfaces all conflicts for the UI.
 */
export function detectModConflicts(mods: LoadedMod[]): ModConflictWarning[] {
  const enabled = mods.filter((m) => m.enabled)
  const warnings: ModConflictWarning[] = []

  for (const { kind, key } of CONTENT_KINDS) {
    const owners = new Map<string, Set<string>>()
    for (const mod of enabled) {
      for (const entry of mod[key]) {
        const id = entryId(key, entry)
        const set = owners.get(id) ?? new Set<string>()
        set.add(mod.manifest.id)
        owners.set(id, set)
      }
    }
    for (const [id, modIds] of owners) {
      if (modIds.size > 1) {
        warnings.push({ kind, id, modIds: [...modIds].sort() })
      }
    }
  }

  return warnings.sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id))
}

/** Resolved load order for enabled mods (throws if dependencies are invalid). */
export function modLoadOrder(mods: LoadedMod[]): string[] {
  const enabled = mods.filter((m) => m.enabled)
  try {
    return resolveLoadOrder(enabled).map((m) => m.manifest.id)
  } catch {
    return enabled.map((m) => m.manifest.id)
  }
}
