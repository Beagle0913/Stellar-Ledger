import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { errorMessage, GameError } from '../../shared/errors.js'
import { resolveScenario, STANDARD_SCENARIO_ID } from '../../shared/scenarios.js'
import type {
  CreateNewCampaignArgs,
  DashboardData,
  GameState,
  SaveSummary,
  ScenarioSummary
} from '../../shared/types.js'
import { closeDatabase, openDatabase } from '../../database/db.js'
import { createCampaign, loadCampaign } from '../../database/saveManager.js'
import { loadValidationWarnings } from '../../database/saveValidation.js'
import { loadMeta } from '../../database/repositories/worldRepo.js'
import { logPlayerAction } from '../actionLog.js'
import { debugLog, logSystem } from '../log.js'
import type { CampaignSession } from '../campaignSession.js'
import type { ModCatalog } from '../modCatalog.js'

export interface CampaignLifecycleConfig {
  savesDir: string
}

export interface CampaignLifecycleDeps {
  session: CampaignSession
  modCatalog: ModCatalog
  config: CampaignLifecycleConfig
  getDashboard: () => DashboardData
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'campaign'
}

export function createCampaignLifecycle(deps: CampaignLifecycleDeps) {
  const { session, modCatalog, config, getDashboard } = deps

  return {
    listScenarios(): ScenarioSummary[] {
      const { defs } = modCatalog.load()
      return defs.scenarios.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        difficulty: s.difficulty,
        campaignStart: s.campaignStart
      }))
    },

    createNewCampaign(args: CreateNewCampaignArgs): DashboardData {
      const { defs, errors } = modCatalog.reload()
      if (errors.length > 0) {
        throw new GameError(
          'MOD_VALIDATION',
          `Cannot start campaign — mod validation failed:\n${errors.join('\n')}`
        )
      }
      session.close()
      const safeName = (args.name || 'Campaign').trim()
      const scenarioId = args.scenarioId?.trim() || STANDARD_SCENARIO_ID
      const scenario = resolveScenario(defs, scenarioId)
      const fileName = `${slugify(safeName)}-${Date.now()}.sqlite`
      const db = openDatabase(join(config.savesDir, fileName))
      const state = createCampaign(db, defs, safeName, scenario)
      session.open(db, state, fileName)
      logSystem(`Created campaign "${safeName}" (${fileName}) scenario=${scenario.id}`)
      return getDashboard()
    },

    loadExistingCampaign(fileName: string): DashboardData {
      session.close()
      const path = join(config.savesDir, fileName)
      if (!existsSync(path)) throw new GameError('NOT_FOUND', `Save not found: ${fileName}`)
      const db = openDatabase(path)
      let state: GameState
      try {
        state = loadCampaign(db)
      } catch (err) {
        closeDatabase(db)
        if (err instanceof GameError) throw err
        throw new GameError('INTERNAL', errorMessage(err))
      }
      session.open(db, state, fileName, [...loadValidationWarnings])
      logSystem(`Loaded campaign "${state.meta.name}" day ${state.meta.tick} (${fileName})`)
      logPlayerAction(state, 'system', `Loaded save "${state.meta.name}" (day ${state.meta.tick}).`)
      return getDashboard()
    },

    saveCurrent(): true {
      const { state } = session.require()
      session.save()
      logSystem(`Saved campaign "${state.meta.name}" at day ${state.meta.tick}`)
      logPlayerAction(state, 'system', `Game saved (day ${state.meta.tick}).`)
      return true
    },

    hasActiveCampaign(): boolean {
      return session.hasCampaign
    },

    close(): void {
      session.close()
    },

    listSaves(): SaveSummary[] {
      if (!existsSync(config.savesDir)) return []
      const out: SaveSummary[] = []
      for (const file of readdirSync(config.savesDir)) {
        if (!file.endsWith('.sqlite')) continue
        try {
          const db = openDatabase(join(config.savesDir, file))
          const { meta } = loadMeta(db)
          out.push({
            id: file,
            name: meta.name,
            fileName: file,
            tick: meta.tick,
            scenarioId: meta.scenario?.id,
            scenarioName: meta.scenario?.name,
            scenarioDifficulty: meta.scenario?.difficulty
          })
          closeDatabase(db)
        } catch (err) {
          debugLog(`listSaves: skipping unreadable save "${file}"`, err)
        }
      }
      return out.sort((a, b) => a.name.localeCompare(b.name))
    },

    deleteSave(fileName: string): true {
      if (fileName === session.fileName) {
        throw new GameError(
          'CONFLICT',
          'Cannot delete the currently open campaign. Load another save first.'
        )
      }
      const path = join(config.savesDir, fileName)
      if (!existsSync(path)) throw new GameError('NOT_FOUND', `Save not found: ${fileName}`)
      rmSync(path)
      for (const suffix of ['-wal', '-shm']) {
        const side = `${path}${suffix}`
        if (existsSync(side)) rmSync(side)
      }
      return true
    },

    renameSave(fileName: string, newName: string): true {
      const name = newName.trim()
      if (!name) throw new GameError('VALIDATION', 'New name must not be empty.')

      if (fileName === session.fileName && session.hasCampaign) {
        session.renameInMemory(name)
        session.save()
        return true
      }

      const path = join(config.savesDir, fileName)
      if (!existsSync(path)) throw new GameError('NOT_FOUND', `Save not found: ${fileName}`)
      const db = openDatabase(path)
      try {
        db.prepare('UPDATE campaign_meta SET name = ?').run(name)
      } finally {
        closeDatabase(db)
      }
      return true
    }
  }
}

export type CampaignLifecycle = ReturnType<typeof createCampaignLifecycle>

export function ensureSavesDir(savesDir: string): void {
  if (!existsSync(savesDir)) mkdirSync(savesDir, { recursive: true })
}
