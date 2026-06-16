import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import {
  clearLoadValidationWarnings,
  loadValidationWarnings,
  parseStoredActivityLog,
  parseStoredBuildMaterials,
  parseStoredCampaignStartConfig,
  parseStoredEconomyConfig,
  parseStoredEvents,
  parseStoredFactions,
  parseStoredPlanetModifiers,
  parseStoredPlanetPopulations,
  parseStoredProgression
} from '../src/database/saveValidation.js'

describe('saveValidation', () => {
  beforeEach(() => clearLoadValidationWarnings())

  it('records warnings for corrupt progression JSON', () => {
    expect(parseStoredProgression('{bad')).toBeNull()
    expect(loadValidationWarnings.some((w) => w.includes('progression_json'))).toBe(true)
  })

  it('throws in strict mode for corrupt activity log', () => {
    const prev = process.env['GE_STRICT_SAVE']
    process.env['GE_STRICT_SAVE'] = '1'
    try {
      expect(() => parseStoredActivityLog(JSON.stringify([{ bad: true }]))).toThrow(
        /activity_log_json/
      )
    } finally {
      if (prev === undefined) delete process.env['GE_STRICT_SAVE']
      else process.env['GE_STRICT_SAVE'] = prev
    }
  })

  afterEach(() => clearLoadValidationWarnings())

  it('falls back to defaults for invalid economy config JSON', () => {
    const cfg = parseStoredEconomyConfig('{not json')
    expect(cfg.fuelItemId).toBe('fuel')
    expect(cfg.regionalTradeMaxUnitsPerDay).toBeGreaterThan(0)
  })

  it('accepts valid economy config JSON', () => {
    const cfg = parseStoredEconomyConfig(JSON.stringify({ fuelItemId: 'fuel', regionalTradeMaxUnitsPerDay: 42 }))
    expect(cfg.regionalTradeMaxUnitsPerDay).toBe(42)
  })

  it('falls back for corrupt factions array', () => {
    expect(parseStoredFactions('[{"id":"bad id"}]')).toEqual([])
  })

  it('accepts valid factions array', () => {
    const factions = parseStoredFactions(
      JSON.stringify([{ id: 'corp_a', name: 'Corp A' }])
    )
    expect(factions).toHaveLength(1)
    expect(factions[0]!.id).toBe('corp_a')
  })

  it('falls back for invalid events', () => {
    expect(parseStoredEvents('[]')).toEqual([])
    expect(parseStoredEvents('{"x":1}')).toEqual([])
  })

  it('falls back campaign start config to defaults', () => {
    const cfg = parseStoredCampaignStartConfig(null)
    expect(cfg.startingCredits).toBeGreaterThan(0)
  })

  it('parses valid activity log entries', () => {
    const log = parseStoredActivityLog(
      JSON.stringify([
        { id: 'log_1', tick: 1, category: 'tick', message: 'Day 1', at: 1000 }
      ])
    )
    expect(log).toHaveLength(1)
    expect(log[0]!.category).toBe('tick')
  })

  it('rejects invalid activity log entries', () => {
    expect(parseStoredActivityLog(JSON.stringify([{ bad: true }]))).toEqual([])
  })

  it('parses planet population rows', () => {
    const rows = parseStoredPlanetPopulations(
      JSON.stringify([{ planetId: 'planet_a', population: 500 }])
    )
    expect(rows).toEqual([{ planetId: 'planet_a', population: 500 }])
  })

  it('parses valid progression JSON', () => {
    const prog = parseStoredProgression(
      JSON.stringify({
        objectives: [{ objectiveId: 'obj_1', current: 0, target: 10, completed: false }],
        totalSellProceeds: 100,
        firstInterSystemDelivery: false,
        producedItems: {},
        activeContracts: [],
        completedContractIds: [],
        factionReputation: {}
      })
    )
    expect(prog?.totalSellProceeds).toBe(100)
    expect(prog?.eventLastFiredTick).toEqual({})
  })

  it('parses valid planet modifiers JSON', () => {
    expect(parseStoredPlanetModifiers(JSON.stringify({ geothermal: 1.4, gasHarvest: 1.5 }))).toEqual({
      geothermal: 1.4,
      gasHarvest: 1.5
    })
  })

  it('falls back planet modifiers on invalid JSON', () => {
    expect(parseStoredPlanetModifiers('{bad')).toEqual({})
    expect(parseStoredPlanetModifiers(JSON.stringify({ bad: 'not-a-number' }))).toEqual({})
    expect(parseStoredPlanetModifiers(JSON.stringify([1, 2]))).toEqual({})
  })

  it('parses valid build materials JSON', () => {
    expect(
      parseStoredBuildMaterials(JSON.stringify([{ itemId: 'ore', quantity: 10 }]))
    ).toEqual([{ itemId: 'ore', quantity: 10 }])
  })

  it('falls back build materials on invalid JSON', () => {
    expect(parseStoredBuildMaterials('{bad')).toEqual([])
    expect(parseStoredBuildMaterials(JSON.stringify([{ itemId: 'bad id', quantity: 1 }]))).toEqual([])
    expect(parseStoredBuildMaterials(JSON.stringify([{ itemId: 'ore', quantity: 0 }]))).toEqual([])
  })
})
