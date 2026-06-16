import { describe, expect, it } from 'vitest'
import { getNpcCorporations } from '../src/simulation/corporations.js'
import { addInventory } from '../src/simulation/economyMath.js'
import { processNpcLogisticsAI } from '../src/simulation/npcLogisticsAI.js'
import { newGame } from './helpers.js'

describe('npcLogisticsAI', () => {
  it('creates a transport job when surplus and shortage exist in different systems', () => {
    const state = newGame()
    const helion = getNpcCorporations(state).find((c) => c.id === 'corp_helion_mining')!
    addInventory(state, helion.id, 'sys_marrow', 'ore', 5)
    addInventory(state, helion.id, helion.homeSystemId, 'ore', 200)

    const before = state.transportJobs.length
    const dispatched = processNpcLogisticsAI(state)
    expect(dispatched).toBe(1)
    expect(state.transportJobs.length).toBeGreaterThan(before)
    const job = state.transportJobs[state.transportJobs.length - 1]!
    expect(job.ownerId).toBe(helion.id)
    expect(job.originSystemId).toBe(helion.homeSystemId)
    expect(job.destinationSystemId).toBe('sys_marrow')
  })

  it('does not dispatch more than one running route per corp', () => {
    const state = newGame()
    const helion = getNpcCorporations(state).find((c) => c.id === 'corp_helion_mining')!
    addInventory(state, helion.id, 'sys_marrow', 'ore', 5)
    addInventory(state, helion.id, helion.homeSystemId, 'ore', 200)
    processNpcLogisticsAI(state)
    expect(processNpcLogisticsAI(state)).toBe(0)
  })

  it('leaves player transport jobs unchanged', () => {
    const state = newGame()
    const playerJobsBefore = state.transportJobs.filter((j) => j.ownerId === 'player').length
    processNpcLogisticsAI(state)
    expect(state.transportJobs.filter((j) => j.ownerId === 'player')).toHaveLength(playerJobsBefore)
  })
})
