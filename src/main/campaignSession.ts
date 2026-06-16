import { errorMessage, GameError } from '../shared/errors.js'
import type { GameState } from '../shared/types.js'
import { closeDatabase, type DB } from '../database/db.js'
import { saveState } from '../database/saveManager.js'
import { debugLog } from './log.js'

export type SaveStatus = 'saved' | 'saving' | 'error'

export interface SaveStatusView {
  saveStatus: SaveStatus
  lastSavedTick: number
  saveError: string | null
}

/**
 * Active campaign handle: in-memory GameState plus its SQLite connection.
 * Extracted from GameService so lifecycle concerns stay in one place.
 */
export class CampaignSession {
  private state: GameState | null = null
  private db: DB | null = null
  private activeFileName: string | null = null
  private lastSavedTick = 0
  private saveStatus: SaveStatus = 'saved'
  private saveError: string | null = null
  private loadWarnings: string[] = []

  get hasCampaign(): boolean {
    return this.state !== null
  }

  get fileName(): string | null {
    return this.activeFileName
  }

  getSaveStatus(): SaveStatusView {
    return {
      saveStatus: this.saveStatus,
      lastSavedTick: this.lastSavedTick,
      saveError: this.saveError
    }
  }

  getLoadWarnings(): string[] {
    return this.loadWarnings
  }

  open(db: DB, state: GameState, fileName: string, loadWarnings: string[] = []): void {
    this.close()
    this.db = db
    this.state = state
    this.activeFileName = fileName
    this.lastSavedTick = state.meta.tick
    this.saveStatus = 'saved'
    this.saveError = null
    this.loadWarnings = loadWarnings
  }

  require(): { state: GameState; db: DB } {
    if (!this.state || !this.db) {
      throw new GameError('NO_CAMPAIGN', 'No active campaign. Create or load one first.')
    }
    return { state: this.state, db: this.db }
  }

  /** Persist after a player mutation (orders, production, etc.). */
  persistAfterMutation(): void {
    this.persist('saving')
  }

  /** Persist the in-memory state to the open SQLite file. */
  save(): void {
    this.persist('saved')
  }

  private persist(statusWhileSaving: SaveStatus): void {
    const { state, db } = this.require()
    if (statusWhileSaving === 'saving') {
      this.saveStatus = 'saving'
    }
    this.saveError = null
    try {
      saveState(db, state)
      this.lastSavedTick = state.meta.tick
      this.saveStatus = 'saved'
    } catch (err) {
      this.saveStatus = 'error'
      this.saveError = errorMessage(err)
      throw err
    }
  }

  renameInMemory(name: string): void {
    const { state } = this.require()
    state.meta.name = name
  }

  close(): void {
    if (this.state && this.db) {
      try {
        saveState(this.db, this.state)
      } catch (err) {
        debugLog('CampaignSession.close: failed to save before close', err)
      }
    }
    if (this.db) {
      try {
        closeDatabase(this.db)
      } catch (err) {
        debugLog('CampaignSession.close: failed to close save database', err)
      }
    }
    this.db = null
    this.state = null
    this.activeFileName = null
    this.lastSavedTick = 0
    this.saveStatus = 'saved'
    this.saveError = null
    this.loadWarnings = []
  }
}
