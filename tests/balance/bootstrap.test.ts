import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createCampaignState, loadVanillaDefs } from '../../src/balance/bootstrap.js'
import { findForbiddenBalanceImports } from './importBoundary.js'

const BALANCE_ROOT = join(process.cwd(), 'src', 'balance')

describe('balance bootstrap boundary', () => {
  it('creates vanilla GameState without importing saveManager/db', () => {
    const state = createCampaignState(loadVanillaDefs(), 'Boundary Test')
    expect(state.meta.tick).toBe(0)
    expect(state.corporation.credits).toBeGreaterThan(0)
    expect(state.markets.length).toBeGreaterThan(0)
    expect(state.ships.length).toBe(1)
  })

  it('src/balance import tree avoids forbidden layers', () => {
    const hits = findForbiddenBalanceImports(BALANCE_ROOT)
    expect(hits, hits.map((h) => `${h.file}: ${h.specifier} (${h.rule})`).join('\n')).toEqual([])
  })
})
