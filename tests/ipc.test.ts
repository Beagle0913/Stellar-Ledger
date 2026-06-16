import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { HANDLED_METHODS, invokeMethod } from '../src/main/dispatch.js'
import { GameService } from '../src/main/gameService.js'
import type { GameApi, StarMapView } from '../src/shared/types.js'
import { VANILLA_DIR } from './helpers.js'

// The dispatcher lives in src/main/dispatch.ts precisely so it can be tested
// here without Electron: a real GameService against a temp saves dir.

const tmp = mkdtempSync(join(tmpdir(), 'ge-ipc-test-'))
let service: GameService
let saveFileName = ''

beforeAll(() => {
  service = new GameService({
    baseDir: tmp,
    savesDir: join(tmp, 'saves'),
    vanillaDir: VANILLA_DIR,
    modsDir: join(tmp, 'mods')
  })
  service.createNewCampaign({ name: 'IPC Test Campaign' })
  saveFileName = service.listSaves()[0]!.fileName
})

afterAll(() => {
  service.close() // release the sqlite file lock before deleting the temp dir
  rmSync(tmp, { recursive: true, force: true })
})

/**
 * A valid (or at least schema-valid) payload for every GameApi method. Typed as
 * Record<keyof GameApi, ...> so adding a method to GameApi without extending
 * this test is a COMPILE error — the dispatcher can then never silently miss
 * a method.
 */
function payloadFor(): Record<keyof GameApi, unknown> {
  return {
    listSaves: undefined,
    listScenarios: undefined,
    createNewCampaign: { name: 'IPC Test Campaign 2', scenarioId: 'standard' },
    loadCampaign: saveFileName,
    saveCurrent: undefined,
    hasActiveCampaign: undefined,
    getDashboard: undefined,
    getItems: undefined,
    getPriceHistory: { systemId: 'sys_helion', itemId: 'food' },
    getSystems: undefined,
    getStarMap: undefined,
    getSystem: 'sys_helion',
    getPlanet: 'helion_prime',
    getMarket: 'sys_helion',
    createMarketOrder: { systemId: 'sys_helion', itemId: 'food', side: 'buy', quantity: 1, price: 5 },
    cancelMarketOrder: 'order_does_not_exist',
    getInventory: undefined,
    getProduction: undefined,
    startProductionJob: { buildingId: 'no_such_building', recipeId: 'no_such_recipe', quantity: 1 },
    buildBuilding: { planetId: 'helion_prime', buildingType: 'no_such_building_type' },
    getLogistics: undefined,
    createTransportJob: {
      shipId: 'no_such_ship',
      destinationSystemId: 'sys_vesper',
      itemId: 'ore',
      quantity: 1
    },
    cancelTransportJob: 'no_such_job',
    runTick: undefined,
    runTicks: 2,
    deleteSave: 'no-such-file.sqlite',
    renameSave: { fileName: 'no-such-file.sqlite', newName: 'Renamed' },
    getMods: undefined,
    setModEnabled: { modId: 'vanilla', enabled: false },
    getEvents: undefined,
    getActivityLog: 100,
    getDebugState: undefined,
    cancelProductionJob: 'no_such_job',
    purchaseShip: { shipDefinitionId: 'ship_hauler_2' },
    runTicksSmart: { mode: 'changes', maxDays: 5 },
    previewMarketTrade: {
      systemId: 'sys_helion',
      itemId: 'ore',
      action: 'sell_max'
    },
    executeMarketTrade: {
      systemId: 'sys_helion',
      itemId: 'ore',
      action: 'sell_amount',
      quantity: 1
    },
    repeatProductionJob: {
      buildingId: 'no_such_building',
      recipeId: 'recipe_metal_smelting',
      quantity: 1
    },
    runProductionUntilExhausted: {
      buildingId: 'no_such_building',
      recipeId: 'recipe_metal_smelting'
    },
    acceptContract: 'no_such_contract',
    completeContract: 'no_such_contract',
    abandonContract: 'no_such_contract',
    reloadModData: undefined
  }
}

describe('IPC dispatcher', () => {
  it('handles every GameApi method (no method falls through to Unknown)', () => {
    const payloads = payloadFor()
    for (const method of Object.keys(payloads) as Array<keyof GameApi>) {
      try {
        invokeMethod(service, method, payloads[method])
      } catch (err) {
        // Domain errors (unknown ship, missing save, ...) are fine; an
        // unhandled method name is not.
        expect((err as Error).message).not.toMatch(/Unknown IPC method/)
      }
    }
  })

  it('HANDLED_METHODS exactly matches the GameApi surface', () => {
    const apiKeys = Object.keys(payloadFor()).sort()
    const handled = [...HANDLED_METHODS].sort()
    expect(handled).toEqual(apiKeys)
  })

  it('throws a clear error for an unknown method', () => {
    expect(() => invokeMethod(service, 'notARealMethod', undefined)).toThrow(
      /Unknown IPC method "notARealMethod"/
    )
  })

  it('rejects malformed payloads before they reach the service', () => {
    expect(() => invokeMethod(service, 'createMarketOrder', { systemId: 'sys_helion' })).toThrow(
      /Invalid payload for "createMarketOrder"/
    )
    expect(() => invokeMethod(service, 'runTicks', 0)).toThrow(/Invalid payload for "runTicks"/)
    expect(() => invokeMethod(service, 'runTicks', 9999)).toThrow(/Invalid payload for "runTicks"/)
    expect(() => invokeMethod(service, 'getPlanet', 42)).toThrow(/Invalid payload for "getPlanet"/)
  })

  it('getStarMap returns systems and distance-weighted lanes', () => {
    const map = invokeMethod(service, 'getStarMap', undefined) as StarMapView
    const n = map.systems.length
    expect(n).toBeGreaterThan(0)
    expect(map.homeSystemId).toBeTruthy()
    expect(map.lanes.length).toBe((n * (n - 1)) / 2)
  })
})
