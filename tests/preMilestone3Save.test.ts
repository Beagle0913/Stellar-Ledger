import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { openDatabase } from '../src/database/db.js'
import { createCampaign, loadCampaign, saveState } from '../src/database/saveManager.js'
import { getAllCorporations, getNpcCorporations, getPlayerCorporationId } from '../src/simulation/corporations.js'
import { DEFAULT_CORP_ID } from '../src/shared/constants.js'
import { loadVanillaDefs, standardScenario, stripNpcRuntimeState } from './helpers.js'

const FIXTURE_DIR = join(process.cwd(), 'tests', 'fixtures')
const FIXTURE_PATH = join(FIXTURE_DIR, 'pre-milestone3.sqlite')

/** Pre-Milestone-3 save: current schema (v10) without scenario or multi-corp columns. */
describe('pre-Milestone-3 save fixture', () => {
  it('loads a saved campaign with exactly one player corporation and no NPC corps', () => {
    mkdirSync(FIXTURE_DIR, { recursive: true })
    const defs = loadVanillaDefs()
    const buildDb = openDatabase(FIXTURE_PATH)
    const state = createCampaign(buildDb, defs, 'Fixture Campaign', standardScenario(defs))
    stripNpcRuntimeState(state)
    saveState(buildDb, state)
    buildDb.close()

    const db = openDatabase(FIXTURE_PATH)
    const loaded = loadCampaign(db)
    db.close()

    expect(loaded.meta.name).toBe('Fixture Campaign')
    expect(getAllCorporations(loaded)).toHaveLength(1)
    expect(getAllCorporations(loaded)[0]!.id).toBe(DEFAULT_CORP_ID)
    expect(getPlayerCorporationId(loaded)).toBe(DEFAULT_CORP_ID)
    expect(loaded.playerCorporationId).toBe(DEFAULT_CORP_ID)
    expect(loaded.corporations).toHaveLength(1)
    expect(getNpcCorporations(loaded)).toEqual([])
  })

  it('round-trips in memory without inventing NPC corporations', () => {
    const db = openDatabase(':memory:')
    const defs = loadVanillaDefs()
    const state = createCampaign(db, defs, 'Memory Legacy', standardScenario(defs))
    stripNpcRuntimeState(state)
    saveState(db, state)
    const loaded = loadCampaign(db)
    expect(getAllCorporations(loaded)).toHaveLength(1)
    expect(getNpcCorporations(loaded)).toEqual([])
    db.close()
  })

  it('cleans up fixture file', () => {
    rmSync(FIXTURE_PATH, { force: true })
  })
})
