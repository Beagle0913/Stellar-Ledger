import { describe, expect, it } from 'vitest'
import { openDatabase } from '../src/database/db.js'
import { createCampaign, loadCampaign, saveState } from '../src/database/saveManager.js'
import { loadModFromDir } from '../src/mods/modLoader.js'
import { mergeMods } from '../src/mods/mergeMods.js'
import { npcCorporationsFileSchema } from '../src/mods/modSchemas.js'
import {
  getAllCorporations,
  getNpcCorporations,
  getPlayerCorporation
} from '../src/simulation/corporations.js'
import { buildPlanetDetail, buildSystemDetail } from '../src/simulation/viewQueries.js'
import { DEFAULT_CORP_ID } from '../src/shared/constants.js'
import { loadVanillaDefs, newGame, standardScenario, VANILLA_DIR } from './helpers.js'

describe('npc corporations (Phase 3B)', () => {
  it('validates vanilla npc_corporations.json', () => {
    const mod = loadModFromDir(VANILLA_DIR, 'builtin')
    expect(() => npcCorporationsFileSchema.parse(mod.npcCorporations)).not.toThrow()
    expect(mod.npcCorporations).toHaveLength(2)
  })

  it('seeds Helion Mining and Orion Refining on new campaigns only', () => {
    const state = newGame()
    expect(getAllCorporations(state)).toHaveLength(3)
    expect(getNpcCorporations(state).map((c) => c.id).sort()).toEqual([
      'corp_helion_mining',
      'corp_orion_refining'
    ])
    expect(getPlayerCorporation(state).id).toBe(DEFAULT_CORP_ID)
    expect(state.buildings.some((b) => b.ownerId === 'corp_helion_mining')).toBe(true)
    expect(state.buildings.some((b) => b.ownerId === 'corp_orion_refining')).toBe(true)
  })

  it('old save round-trip does not invent NPC corporations', () => {
    const db = openDatabase(':memory:')
    const defs = loadVanillaDefs()
    const scenario = standardScenario(defs)
    const state = createCampaign(db, defs, 'Legacy', scenario)
    expect(getNpcCorporations(state)).toHaveLength(2)

    while (state.corporations.length > 1) {
      state.corporations = state.corporations.filter((c) => c.id === DEFAULT_CORP_ID)
      state.inventories = state.inventories.filter((i) => i.ownerId === DEFAULT_CORP_ID)
      state.buildings = state.buildings.filter((b) => b.ownerId === DEFAULT_CORP_ID)
      state.ships = state.ships.filter((s) => s.ownerId === DEFAULT_CORP_ID)
    }
    saveState(db, state)
    const loaded = loadCampaign(db)
    expect(getAllCorporations(loaded)).toHaveLength(1)
    expect(getNpcCorporations(loaded)).toEqual([])
    db.close()
  })

  it('save/load preserves NPC runtime state', () => {
    const db = openDatabase(':memory:')
    const defs = loadVanillaDefs()
    const state = createCampaign(db, defs, 'NPC RT', standardScenario(defs))
    const helion = state.corporations.find((c) => c.id === 'corp_helion_mining')!
    helion.credits = 77777
    saveState(db, state)
    const loaded = loadCampaign(db)
    expect(loaded.corporations.find((c) => c.id === 'corp_helion_mining')?.credits).toBe(77777)
    expect(getNpcCorporations(loaded)).toHaveLength(2)
    db.close()
  })

  it('changing npc_corporations.json on disk does not mutate loaded save corps', () => {
    const db = openDatabase(':memory:')
    const defs = loadVanillaDefs()
    const state = createCampaign(db, defs, 'Frozen NPC', standardScenario(defs))
    saveState(db, state)

    const tampered = mergeMods([
      {
        ...loadModFromDir(VANILLA_DIR, 'builtin'),
        npcCorporations: [
          {
            id: 'corp_fake',
            name: 'Fake Corp',
            homeSystemId: 'sys_helion',
            startingCredits: 1,
            startingStock: {},
            buildings: [],
            aiProfile: 'trader'
          }
        ]
      }
    ])
    expect(tampered.npcCorporations.some((n) => n.id === 'corp_fake')).toBe(true)

    const loaded = loadCampaign(db)
    expect(loaded.corporations.some((c) => c.id === 'corp_fake')).toBe(false)
    expect(getNpcCorporations(loaded).map((c) => c.id).sort()).toEqual([
      'corp_helion_mining',
      'corp_orion_refining'
    ])
    db.close()
  })

  it('NPC buildings appear in planet and system views without breaking player data', () => {
    const state = newGame()
    const helionMine = state.buildings.find((b) => b.ownerId === 'corp_helion_mining')
    expect(helionMine).toBeDefined()
    const planet = buildPlanetDetail(state, helionMine!.planetId)
    const npcRow = planet.buildings.find((b) => b.ownerId === 'corp_helion_mining')
    expect(npcRow?.ownerName).toBe('Helion Mining')
    expect(npcRow?.isPlayerOwned).toBe(false)

    const system = buildSystemDetail(state, 'sys_cinder')
    expect(system.foreignBuildings.some((b) => b.ownerName === 'Helion Mining')).toBe(true)
  })
})
