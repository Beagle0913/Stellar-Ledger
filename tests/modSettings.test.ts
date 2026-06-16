import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadModFromDir } from '../src/mods/modLoader.js'
import { mergeMods } from '../src/mods/mergeMods.js'
import {
  applyModSettings,
  loadModSettings,
  modSettingsPath,
  saveModSettings
} from '../src/mods/modSettings.js'
import type { LoadedMod } from '../src/mods/modTypes.js'
import { GameService } from '../src/main/gameService.js'
import { VANILLA_DIR } from './helpers.js'

function externalMod(id: string): LoadedMod {
  return {
    manifest: {
      id,
      name: id,
      version: '1.0.0',
      author: 'test',
      gameVersion: '0.1.x',
      dependencies: [],
      loadAfter: [],
      description: ''
    },
    source: 'external',
    enabled: true,
    items: [{ id: `${id}_item`, name: 'Extra', category: 'raw', baseValue: 1, volume: 1 }],
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

describe('mod settings', () => {
  it('persists toggles to mod-settings.json', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ge-mod-settings-'))
    try {
      saveModSettings(dir, { example_mod: false })
      expect(loadModSettings(dir)).toEqual({ example_mod: false })
      expect(readFileSync(modSettingsPath(dir), 'utf-8')).toContain('"example_mod"')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('mergeMods excludes disabled mods', () => {
    const vanilla = loadModFromDir(VANILLA_DIR, 'builtin')
    const ext = externalMod('extra_content')
    ext.enabled = false
    const merged = mergeMods([vanilla, ext])
    expect(merged.items.some((i) => i.id === 'extra_content_item')).toBe(false)
    ext.enabled = true
    const withExt = mergeMods([vanilla, ext])
    expect(withExt.items.some((i) => i.id === 'extra_content_item')).toBe(true)
  })

  it('applyModSettings keeps vanilla enabled and respects saved toggles', () => {
    const vanilla = loadModFromDir(VANILLA_DIR, 'builtin')
    const ext = externalMod('toggle_me')
    applyModSettings([vanilla, ext], { toggle_me: false })
    expect(vanilla.enabled).toBe(true)
    expect(ext.enabled).toBe(false)
  })

  it('GameService rejects new campaign when enabled mods fail validation', () => {
    const base = mkdtempSync(join(tmpdir(), 'ge-mod-svc-'))
    const modsDir = join(base, 'mods')
    mkdirSync(modsDir, { recursive: true })
    const badModDir = join(modsDir, 'bad_mod')
    mkdirSync(badModDir, { recursive: true })
    writeFileSync(join(badModDir, 'mod.json'), JSON.stringify({
      id: 'bad_mod',
      name: 'Bad',
      version: '1.0.0',
      author: 't',
      gameVersion: '0.1.x',
      dependencies: [],
      loadAfter: [],
      description: ''
    }))
    writeFileSync(
      join(badModDir, 'recipes.json'),
      JSON.stringify([
        {
          id: 'bad_recipe',
          name: 'Bad',
          buildingType: 'missing_building',
          inputs: [],
          outputs: [{ itemId: 'missing_item', quantity: 1 }],
          duration: 1
        }
      ])
    )

    const service = new GameService({
      baseDir: base,
      savesDir: join(base, 'saves'),
      vanillaDir: VANILLA_DIR,
      modsDir
    })

    try {
      expect(() => service.createNewCampaign('Should Fail')).toThrow(/mod validation failed/i)
    } finally {
      service.close()
      rmSync(base, { recursive: true, force: true })
    }
  })
})
