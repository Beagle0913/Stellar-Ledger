import { describe, expect, it } from 'vitest'
import { runTick } from '../src/simulation/tick.js'
import { processNpcProductionAI } from '../src/simulation/npcProductionAI.js'
import { getNpcCorporations } from '../src/simulation/corporations.js'
import type { GameState } from '../src/shared/types.js'
import { newGame } from './helpers.js'

function snapshotNpcProduction(state: GameState) {
  const npcIds = new Set(getNpcCorporations(state).map((c) => c.id))
  return {
    inventories: state.inventories
      .filter((r) => npcIds.has(r.ownerId))
      .map((r) => ({ ...r }))
      .sort(
        (a, b) =>
          a.ownerId.localeCompare(b.ownerId) ||
          a.systemId.localeCompare(b.systemId) ||
          a.itemId.localeCompare(b.itemId)
      ),
    jobs: state.productionJobs
      .filter((j) => {
        const building = state.buildings.find((b) => b.id === j.buildingId)
        return building && npcIds.has(building.ownerId)
      })
      .map((j) => ({
        buildingId: j.buildingId,
        recipeId: j.recipeId,
        quantity: j.quantity,
        status: j.status,
        progress: j.progress
      }))
      .sort(
        (a, b) =>
          a.buildingId.localeCompare(b.buildingId) || a.recipeId.localeCompare(b.recipeId)
      )
  }
}

describe('npcProductionAI', () => {
  it('queues jobs for idle NPC buildings deterministically', () => {
    const state = newGame()
    const beforeJobs = state.productionJobs.length
    const queued = processNpcProductionAI(state)
    expect(queued).toBeGreaterThan(0)
    expect(state.productionJobs.length).toBeGreaterThan(beforeJobs)
  })

  it('uses NPC inventory only (not player stock)', () => {
    const state = newGame()
    const playerOre = state.inventories.find(
      (r) => r.ownerId === 'player' && r.itemId === 'ore' && r.quantity > 0
    )
    const oreBefore = playerOre?.quantity ?? 0
    for (let i = 0; i < 5; i += 1) processNpcProductionAI(state)
    runTick(state)
    expect(playerOre?.quantity ?? 0).toBe(oreBefore)
  })

  it('produces identical NPC state after N ticks from the same start', () => {
    const a = newGame()
    const b = structuredClone(a) as GameState
    for (let i = 0; i < 10; i += 1) {
      runTick(a)
      runTick(b)
    }
    expect(snapshotNpcProduction(a)).toEqual(snapshotNpcProduction(b))
  })
})
