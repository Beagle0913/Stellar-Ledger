import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { errorMessage, GameError, toIpcError } from '../src/shared/errors.js'
import { ModValidationError } from '../src/mods/modTypes.js'
import { safeDispatch } from '../src/main/dispatch.js'
import { GameService } from '../src/main/gameService.js'
import { VANILLA_DIR } from './helpers.js'

// The structured error contract: every value thrown anywhere in main must be
// reduced to an IpcError { code, message } before crossing the IPC boundary.

describe('toIpcError', () => {
  it('preserves the code and message of a GameError', () => {
    expect(toIpcError(new GameError('NOT_FOUND', 'missing'))).toEqual({
      code: 'NOT_FOUND',
      message: 'missing'
    })
  })

  it('maps ModValidationError to MOD_VALIDATION', () => {
    expect(toIpcError(new ModValidationError('bad mod'))).toEqual({
      code: 'MOD_VALIDATION',
      message: 'bad mod'
    })
  })

  it('classifies plain Errors as INTERNAL', () => {
    expect(toIpcError(new TypeError('boom'))).toEqual({ code: 'INTERNAL', message: 'boom' })
  })

  it('handles non-Error throws without producing "undefined"', () => {
    expect(toIpcError('a string throw')).toEqual({ code: 'INTERNAL', message: 'a string throw' })
    expect(toIpcError(null)).toEqual({ code: 'INTERNAL', message: 'null' })
  })
})

describe('errorMessage', () => {
  it('extracts a message from anything', () => {
    expect(errorMessage(new Error('x'))).toBe('x')
    expect(errorMessage(42)).toBe('42')
  })
})

describe('safeDispatch error codes', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'ge-errors-test-'))
  let service: GameService

  beforeAll(() => {
    service = new GameService({
      baseDir: tmp,
      savesDir: join(tmp, 'saves'),
      vanillaDir: VANILLA_DIR,
      modsDir: join(tmp, 'mods')
    })
  })

  afterAll(() => {
    service.close()
    rmSync(tmp, { recursive: true, force: true })
  })

  function expectError(method: string, payload: unknown, code: string): string {
    const result = safeDispatch(service, method, payload)
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.error.code).toBe(code)
    return result.error.message
  }

  it('returns NO_CAMPAIGN when no campaign is loaded', () => {
    expectError('getDashboard', undefined, 'NO_CAMPAIGN')
  })

  it('returns VALIDATION for malformed payloads', () => {
    const msg = expectError('createMarketOrder', { systemId: 'sys_helion' }, 'VALIDATION')
    expect(msg).toMatch(/Invalid payload/)
    expectError('runTicks', 0, 'VALIDATION')
  })

  it('returns NOT_FOUND for unknown methods and missing entities', () => {
    expectError('notARealMethod', undefined, 'NOT_FOUND')
    expectError('loadCampaign', 'no-such-file.sqlite', 'NOT_FOUND')
  })

  it('returns domain codes once a campaign is active', () => {
    const created = safeDispatch(service, 'createNewCampaign', 'Errors Test')
    expect(created.ok).toBe(true)

    expectError('getSystem', 'sys_does_not_exist', 'NOT_FOUND')
    expectError('createTransportJob', {
      shipId: 'no_such_ship',
      destinationSystemId: 'sys_vesper',
      itemId: 'ore',
      quantity: 1
    }, 'NOT_FOUND')
    // Schema-valid but economically impossible: trillions in escrow.
    expectError('createMarketOrder', {
      systemId: 'sys_helion',
      itemId: 'food',
      side: 'buy',
      quantity: 1_000_000,
      price: 1_000_000
    }, 'VALIDATION')

    const fileName = service.listSaves()[0]!.fileName
    expectError('deleteSave', fileName, 'CONFLICT')
  })

  it('classifies unexpected throws as INTERNAL and logs them', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      const broken = {
        getDashboard(): never {
          throw new TypeError('simulated bug')
        }
      } as unknown as GameService
      const result = safeDispatch(broken, 'getDashboard', undefined)
      expect(result.ok).toBe(false)
      if (result.ok) throw new Error('unreachable')
      expect(result.error).toEqual({ code: 'INTERNAL', message: 'simulated bug' })
      expect(spy).toHaveBeenCalledOnce()
      expect(String(spy.mock.calls[0]![0])).toContain('getDashboard')
    } finally {
      spy.mockRestore()
    }
  })

  it('never rejects: the result is always a structured IpcResult', () => {
    const result = safeDispatch(service, 'renameSave', { fileName: 'nope.sqlite', newName: 'x' })
    expect(result).toHaveProperty('ok')
    if (!result.ok) {
      expect(typeof result.error.code).toBe('string')
      expect(typeof result.error.message).toBe('string')
    }
  })
})
