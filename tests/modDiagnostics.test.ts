import { describe, expect, it } from 'vitest'
import { detectModConflicts, modLoadOrder } from '../src/mods/modDiagnostics.js'
import { resolveLoadOrder } from '../src/mods/validateMods.js'
import type { LoadedMod } from '../src/mods/modTypes.js'

function emptyMod(id: string, deps: string[] = [], loadAfter: string[] = []): LoadedMod {
  return {
    manifest: {
      id,
      name: id,
      version: '1.0.0',
      author: 'test',
      gameVersion: '0.1.x',
      dependencies: deps,
      loadAfter,
      description: ''
    },
    source: 'external',
    enabled: true,
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
    economyConfig: {},
    campaignStartConfig: {},
    scenarios: [],
    npcCorporations: []
  }
}

describe('mod diagnostics', () => {
  it('detects duplicate item ids across enabled mods', () => {
    const a = emptyMod('mod_a')
    const b = emptyMod('mod_b')
    a.items.push({ id: 'dup', name: 'A', category: 'raw', baseValue: 1, volume: 1 })
    b.items.push({ id: 'dup', name: 'B', category: 'raw', baseValue: 1, volume: 1 })

    const conflicts = detectModConflicts([a, b])
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]!.modIds.sort()).toEqual(['mod_a', 'mod_b'])
  })

  it('returns resolved load order for enabled mods', () => {
    const base = emptyMod('base')
    const ext = emptyMod('ext', ['base'], ['base'])
    const order = modLoadOrder([ext, base])
    expect(order).toEqual(resolveLoadOrder([ext, base]).map((m) => m.manifest.id))
    expect(order.indexOf('base')).toBeLessThan(order.indexOf('ext'))
  })
})
