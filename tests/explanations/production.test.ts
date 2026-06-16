import { describe, expect, it } from 'vitest'
import {
  explainIdleBuilding,
  explainProductionBlock,
  explainQueuedJobBlock
} from '../../src/shared/explanations/production.js'

describe('production explanations', () => {
  it('maps missing inputs reason', () => {
    const ex = explainProductionBlock('Not enough Ore here: need 20, have 8.')
    expect(ex.code).toBe('production.blocked.missing_inputs')
    expect(ex.message).toContain('Ore')
  })

  it('explains idle building', () => {
    const ex = explainIdleBuilding('Smelter')
    expect(ex.code).toBe('production.idle.no_job')
    expect(ex.message).toContain('Smelter')
  })

  it('explains queued job waiting for inputs', () => {
    const ex = explainQueuedJobBlock('Not enough Ore here: need 10, have 2.')
    expect(ex.code).toBe('production.queued.waiting_for_inputs')
  })
})
