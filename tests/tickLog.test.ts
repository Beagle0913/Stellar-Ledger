import { describe, expect, it } from 'vitest'
import { startProductionJob } from '../src/simulation/production.js'
import { runTick } from '../src/simulation/tick.js'
import { buildTickLog } from '../src/simulation/tickLog.js'
import { newGame } from './helpers.js'

describe('tickLog', () => {
  it('buildTickLog includes production completion lines', () => {
    const state = newGame()
    const powerPlant = state.buildings.find((b) => b.definitionId === 'power_plant')!
    startProductionJob(state, powerPlant.id, 'recipe_energy_generation', 1)
    const result = runTick(state)

    expect(result.log.length).toBeGreaterThan(0)
    expect(result.log.some((e) => e.category === 'production')).toBe(true)
    expect(state.activityLog.some((e) => e.category === 'production')).toBe(true)
  })

  it('buildTickLog records quiet days', () => {
    const state = newGame()
    const entries = buildTickLog(state, 1, {
      trades: [],
      regionalTrades: [],
      completedProduction: [],
      completedTransport: [],
      populationChanges: [],
      newEvents: [],
      marketChanges: []
    })
    expect(entries.some((e) => e.message.includes('Quiet day'))).toBe(true)
  })

  it('runTick appends detailed log to activityLog', () => {
    const state = newGame()
    const before = state.activityLog.length
    runTick(state)
    expect(state.activityLog.length).toBeGreaterThan(before)
    expect(state.activityLog.some((e) => e.category === 'tick')).toBe(true)
  })
})
