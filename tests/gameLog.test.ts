import { describe, expect, it } from 'vitest'
import {
  ACTIVITY_LOG_MAX,
  appendActivityLog,
  createLogEntry,
  formatLogLine,
  recordPlayerAction
} from '../src/shared/gameLog.js'
import { newGame } from './helpers.js'

describe('gameLog', () => {
  it('creates entries with category labels', () => {
    const entry = createLogEntry(3, 'market', 'Test message')
    expect(entry.tick).toBe(3)
    expect(entry.category).toBe('market')
    expect(entry.message).toBe('Test message')
    expect(entry.id).toMatch(/^log_/)
    expect(formatLogLine(entry)).toBe('[Day 3] [Market] Test message')
  })

  it('appends and trims activity log to ACTIVITY_LOG_MAX', () => {
    const state = newGame()
    const entries = Array.from({ length: ACTIVITY_LOG_MAX + 10 }, (_, i) =>
      createLogEntry(i, 'tick', `line ${i}`)
    )
    appendActivityLog(state, entries)
    expect(state.activityLog).toHaveLength(ACTIVITY_LOG_MAX)
    expect(state.activityLog[0]!.message).toBe('line 10')
  })

  it('recordPlayerAction uses current tick', () => {
    const state = newGame()
    state.meta.tick = 7
    const entry = recordPlayerAction(state, 'player', 'Built a mine.')
    expect(entry.tick).toBe(7)
    expect(state.activityLog.at(-1)?.message).toBe('Built a mine.')
  })

  it('new campaigns start with a system log entry', () => {
    const state = newGame()
    expect(state.activityLog.length).toBeGreaterThanOrEqual(1)
    expect(state.activityLog[0]!.category).toBe('system')
    expect(state.activityLog[0]!.message).toContain('Test Campaign')
  })
})
