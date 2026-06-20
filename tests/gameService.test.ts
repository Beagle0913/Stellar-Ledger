import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { openDatabase, closeDatabase } from '../src/database/db.js'
import { loadOrders } from '../src/database/repositories/marketRepo.js'
import { GameService } from '../src/main/gameService.js'
import type { GameDefinitions } from '../src/shared/types.js'
import { VANILLA_DIR, loadVanillaDefs, getHomeSystemId } from './helpers.js'

// GameService runs fine under plain Node (no Electron); it only needs paths.

const tmp = mkdtempSync(join(tmpdir(), 'ge-svc-test-'))

function newService(): GameService {
  return new GameService({
    baseDir: tmp,
    savesDir: join(tmp, 'saves'),
    vanillaDir: VANILLA_DIR,
    modsDir: join(tmp, 'mods') // empty -> no external mods
  })
}

afterAll(() => {
  rmSync(tmp, { recursive: true, force: true })
})

describe('GameService.getMods', () => {
  it('definitionCounts covers every definition array of GameDefinitions', () => {
    const service = newService()
    const view = service.getMods()
    const defs = loadVanillaDefs()

    const arrayKeys = (Object.keys(defs) as Array<keyof GameDefinitions>).filter(
      (k) => k !== 'economyConfig' && Array.isArray(defs[k])
    )
    expect(arrayKeys.length).toBeGreaterThan(0)
    for (const key of arrayKeys) {
      const counts = view.newCampaignDefinitionCounts as unknown as Record<string, number>
      const arr = defs[key] as unknown[]
      expect(counts, `definitionCounts is missing key "${String(key)}"`).toHaveProperty(
        String(key)
      )
      expect(counts[String(key)]).toBe(arr.length)
    }
  })

  it('reports no validation errors for vanilla content', () => {
    const view = newService().getMods()
    expect(view.validationErrors).toEqual([])
    expect(view.mods.some((m) => m.id === 'vanilla')).toBe(true)
  })
})

describe('GameService autosave', () => {
  it('persists market orders immediately after createMarketOrder', () => {
    const service = newService()
    service.createNewCampaign({ name: 'Autosave Test' })
    const before = service.getDashboard()
    expect(before.saveStatus).toBe('saved')

    service.createMarketOrder({
      systemId: getHomeSystemId(),
      itemId: 'ore',
      side: 'sell',
      quantity: 5,
      price: 12
    })

    const dash = service.getDashboard()
    expect(dash.saveStatus).toBe('saved')
    expect(dash.lastSavedTick).toBe(dash.tick)

    const fileName = readdirSync(join(tmp, 'saves')).find((f) => f.endsWith('.sqlite'))
    expect(fileName).toBeTruthy()
    service.close()

    const db = openDatabase(join(tmp, 'saves', fileName!))
    const orders = loadOrders(db)
    closeDatabase(db)
    expect(orders.some((o) => o.itemId === 'ore' && o.side === 'sell' && o.quantity === 5)).toBe(
      true
    )
  })
})
