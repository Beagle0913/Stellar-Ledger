import { describe, expect, it } from 'vitest'
import { loadModFromDir } from '../src/mods/modLoader.js'
import { mergeMods } from '../src/mods/mergeMods.js'
import { resolveLoadOrder } from '../src/mods/validateMods.js'
import { ModValidationError, type LoadedMod } from '../src/mods/modTypes.js'
import { VANILLA_DIR, loadVanillaDefs } from './helpers.js'

function emptyMod(id: string, deps: string[] = [], loadAfter: string[] = []): LoadedMod {
  return {
    manifest: { id, name: id, version: '1.0.0', author: 'test', gameVersion: '0.1.x', dependencies: deps, loadAfter, description: '' },
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
    campaignStartConfig: {}
  }
}

describe('mod loading', () => {
  it('loads the vanilla mod from JSON on disk', () => {
    const vanilla = loadModFromDir(VANILLA_DIR, 'builtin')
    expect(vanilla.manifest.id).toBe('vanilla')
    expect(vanilla.items.length).toBeGreaterThanOrEqual(20)
    expect(vanilla.systems).toHaveLength(5)
    expect(vanilla.planets).toHaveLength(15)
    expect(vanilla.economicProfiles).toHaveLength(8)
  })

  it('merges vanilla into a valid, reference-complete definition set', () => {
    const defs = loadVanillaDefs()
    const itemIds = new Set(defs.items.map((i) => i.id))
    const buildingIds = new Set(defs.buildings.map((b) => b.id))
    for (const recipe of defs.recipes) {
      expect(buildingIds.has(recipe.buildingType)).toBe(true)
      for (const io of [...recipe.inputs, ...recipe.outputs]) {
        expect(itemIds.has(io.itemId)).toBe(true)
      }
    }
    for (const planet of defs.planets) {
      expect(defs.systems.some((s) => s.id === planet.systemId)).toBe(true)
    }
  })

  it('rejects a recipe that references an unknown item', () => {
    const bad = emptyMod('bad_mod')
    bad.buildings.push({ id: 'b1', name: 'B1', buildCost: 0, buildMaterials: [] })
    bad.recipes.push({
      id: 'r1',
      name: 'R1',
      buildingType: 'b1',
      inputs: [{ itemId: 'does_not_exist', quantity: 1 }],
      outputs: [{ itemId: 'does_not_exist', quantity: 1 }],
      duration: 1
    })
    expect(() => mergeMods([bad])).toThrow(ModValidationError)
  })

  it('rejects duplicate item ids across mods', () => {
    const a = emptyMod('mod_a')
    const b = emptyMod('mod_b')
    a.items.push({ id: 'dup', name: 'Dup', category: 'raw', baseValue: 1, volume: 1 })
    b.items.push({ id: 'dup', name: 'Dup2', category: 'raw', baseValue: 1, volume: 1 })
    expect(() => mergeMods([a, b])).toThrow(/Duplicate item id/)
  })

  it('rejects a missing dependency', () => {
    const m = emptyMod('needs_thing', ['not_present'])
    expect(() => resolveLoadOrder([m])).toThrow(/missing dependency/)
  })

  it('rejects cyclic dependencies', () => {
    const a = emptyMod('cyc_a', ['cyc_b'])
    const b = emptyMod('cyc_b', ['cyc_a'])
    expect(() => resolveLoadOrder([a, b])).toThrow(/Cyclic/)
  })

  it('orders dependencies before dependents', () => {
    const base = emptyMod('base')
    const ext = emptyMod('ext', ['base'], ['base'])
    const order = resolveLoadOrder([ext, base]).map((m) => m.manifest.id)
    expect(order.indexOf('base')).toBeLessThan(order.indexOf('ext'))
  })

  it('rejects cyclic objective dependsOnObjectiveId chains', () => {
    const vanilla = loadModFromDir(VANILLA_DIR, 'builtin')
    const ext = emptyMod('cyc_obj')
    ext.objectives.push(
      {
        id: 'obj_cycle_a',
        title: 'Cycle A',
        description: '',
        type: 'net_worth',
        target: 1,
        dependsOnObjectiveId: 'obj_cycle_b'
      },
      {
        id: 'obj_cycle_b',
        title: 'Cycle B',
        description: '',
        type: 'net_worth',
        target: 1,
        dependsOnObjectiveId: 'obj_cycle_c'
      },
      {
        id: 'obj_cycle_c',
        title: 'Cycle C',
        description: '',
        type: 'net_worth',
        target: 1,
        dependsOnObjectiveId: 'obj_cycle_a'
      }
    )
    expect(() => mergeMods([vanilla, ext])).toThrow(/Objective dependency cycle/)
  })

  it('rejects events with unknown requiresCompletedObjectiveId', () => {
    const vanilla = loadModFromDir(VANILLA_DIR, 'builtin')
    const ext = emptyMod('bad_event_obj')
    ext.events.push({
      id: 'evt_bad_gate',
      name: 'Bad Gate',
      description: '',
      trigger: { type: 'tickInterval', everyTicks: 5 },
      effect: { type: 'message' },
      requiresCompletedObjectiveId: 'obj_does_not_exist'
    })
    expect(() => mergeMods([vanilla, ext])).toThrow(/requiresCompletedObjectiveId references unknown objective/)
  })

  it('mergeMods skips disabled mods', () => {
    const vanilla = loadModFromDir(VANILLA_DIR, 'builtin')
    const ext = emptyMod('optional_pack')
    ext.items.push({ id: 'opt_item', name: 'Opt', category: 'raw', baseValue: 1, volume: 1 })
    ext.enabled = false
    const merged = mergeMods([vanilla, ext])
    expect(merged.items.some((i) => i.id === 'opt_item')).toBe(false)
  })
})
