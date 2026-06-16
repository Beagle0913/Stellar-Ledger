import { LoadedMod, ModValidationError } from './modTypes.js'

// Cross-mod validation: dependency resolution and load ordering. This runs on the
// set of mods the player has enabled, BEFORE merging their definitions.

/**
 * Resolve a deterministic load order for the given mods.
 *
 * Rules enforced (each throws a clear ModValidationError on violation):
 *  - every declared dependency must be present among the enabled mods
 *  - `loadAfter` ordering is respected (treated as soft ordering edges)
 *  - dependency cycles are rejected
 */
export function resolveLoadOrder(mods: LoadedMod[]): LoadedMod[] {
  const byId = new Map<string, LoadedMod>()
  for (const mod of mods) {
    if (byId.has(mod.manifest.id)) {
      throw new ModValidationError(
        `Duplicate mod id "${mod.manifest.id}" — two enabled mods declare the same id.`
      )
    }
    byId.set(mod.manifest.id, mod)
  }

  // Missing dependency check.
  for (const mod of mods) {
    for (const dep of mod.manifest.dependencies) {
      if (!byId.has(dep)) {
        throw new ModValidationError(
          `Mod "${mod.manifest.id}" requires missing dependency "${dep}".`
        )
      }
    }
  }

  // Build ordering edges from both dependencies and loadAfter (must load before).
  const edges = new Map<string, Set<string>>()
  for (const mod of mods) edges.set(mod.manifest.id, new Set())
  for (const mod of mods) {
    const before = new Set<string>([...mod.manifest.dependencies, ...mod.manifest.loadAfter])
    for (const b of before) {
      if (byId.has(b)) edges.get(mod.manifest.id)!.add(b)
    }
  }

  // Topological sort (DFS) with cycle detection.
  const ordered: LoadedMod[] = []
  const state = new Map<string, 'visiting' | 'done'>()

  const visit = (id: string, stack: string[]): void => {
    const s = state.get(id)
    if (s === 'done') return
    if (s === 'visiting') {
      throw new ModValidationError(
        `Cyclic mod dependency detected: ${[...stack, id].join(' -> ')}`
      )
    }
    state.set(id, 'visiting')
    for (const dep of edges.get(id)!) {
      visit(dep, [...stack, id])
    }
    state.set(id, 'done')
    ordered.push(byId.get(id)!)
  }

  // Sort ids for deterministic output regardless of discovery order.
  for (const id of [...byId.keys()].sort()) {
    visit(id, [])
  }
  return ordered
}
