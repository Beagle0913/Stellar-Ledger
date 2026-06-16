import { GameError, toIpcError } from '../shared/errors.js'
import type { IpcResult } from '../shared/types.js'
import { logError } from './log.js'
import type { GameService } from './gameService.js'
import { parseIpcPayload } from './ipcSchemas.js'

// The single IPC dispatcher: maps a method name + raw payload onto the matching
// GameService call. Lives in its own Electron-free module so it is importable
// (and testable) under plain Node — main.ts wires it to ipcMain.

/** Every GameApi method name handled by invokeMethod (kept exhaustive by tests). */
export const HANDLED_METHODS = [
  'listSaves',
  'listScenarios',
  'createNewCampaign',
  'loadCampaign',
  'saveCurrent',
  'hasActiveCampaign',
  'getDashboard',
  'getItems',
  'getPriceHistory',
  'getSystems',
  'getStarMap',
  'getSystem',
  'getPlanet',
  'getMarket',
  'createMarketOrder',
  'cancelMarketOrder',
  'getInventory',
  'getProduction',
  'startProductionJob',
  'buildBuilding',
  'getLogistics',
  'createTransportJob',
  'cancelTransportJob',
  'runTick',
  'runTicks',
  'deleteSave',
  'renameSave',
  'getMods',
  'setModEnabled',
  'getEvents',
  'getActivityLog',
  'getDebugState',
  'cancelProductionJob',
  'purchaseShip',
  'runTicksSmart',
  'previewMarketTrade',
  'executeMarketTrade',
  'repeatProductionJob',
  'runProductionUntilExhausted',
  'acceptContract',
  'completeContract',
  'abandonContract',
  'reloadModData'
] as const

export function invokeMethod(service: GameService, method: string, payload: unknown): unknown {
  switch (method) {
    case 'listSaves':
      return service.listSaves()
    case 'listScenarios':
      return service.listScenarios()
    case 'createNewCampaign':
      return service.createNewCampaign(parseIpcPayload(method, payload))
    case 'loadCampaign':
      return service.loadExistingCampaign(parseIpcPayload(method, payload))
    case 'saveCurrent':
      return service.saveCurrent()
    case 'hasActiveCampaign':
      return service.hasActiveCampaign()
    case 'getDashboard':
      return service.getDashboard()
    case 'getItems':
      return service.getItems()
    case 'getPriceHistory':
      return service.getPriceHistory(parseIpcPayload(method, payload))
    case 'getSystems':
      return service.getSystems()
    case 'getStarMap':
      return service.getStarMap()
    case 'getSystem':
      return service.getSystem(parseIpcPayload(method, payload))
    case 'getPlanet':
      return service.getPlanet(parseIpcPayload(method, payload))
    case 'getMarket':
      return service.getMarket(parseIpcPayload(method, payload))
    case 'createMarketOrder':
      return service.createMarketOrder(parseIpcPayload(method, payload))
    case 'cancelMarketOrder':
      return service.cancelMarketOrder(parseIpcPayload(method, payload))
    case 'getInventory':
      return service.getInventory()
    case 'getProduction':
      return service.getProduction()
    case 'startProductionJob':
      return service.startProductionJob(parseIpcPayload(method, payload))
    case 'buildBuilding':
      return service.buildBuilding(parseIpcPayload(method, payload))
    case 'getLogistics':
      return service.getLogistics()
    case 'createTransportJob':
      return service.createTransportJob(parseIpcPayload(method, payload))
    case 'cancelTransportJob':
      return service.cancelTransportJob(parseIpcPayload(method, payload))
    case 'runTick':
      return service.runTick()
    case 'runTicks':
      return service.runTicks(parseIpcPayload(method, payload))
    case 'deleteSave':
      return service.deleteSave(parseIpcPayload(method, payload))
    case 'renameSave': {
      const args = parseIpcPayload(method, payload)
      return service.renameSave(args.fileName, args.newName)
    }
    case 'getMods':
      return service.getMods()
    case 'setModEnabled': {
      const args = parseIpcPayload(method, payload)
      return service.setModEnabled(args.modId, args.enabled)
    }
    case 'getEvents':
      return service.getEvents()
    case 'getActivityLog':
      if (payload === undefined || payload === null) return service.getActivityLog()
      return service.getActivityLog(parseIpcPayload('getActivityLog', payload))
    case 'getDebugState':
      return service.getDebugState()
    case 'cancelProductionJob':
      return service.cancelProductionJob(parseIpcPayload(method, payload))
    case 'purchaseShip':
      return service.purchaseShip(parseIpcPayload(method, payload))
    case 'runTicksSmart':
      return service.runTicksSmart(parseIpcPayload(method, payload))
    case 'previewMarketTrade':
      return service.previewMarketTrade(parseIpcPayload(method, payload))
    case 'executeMarketTrade':
      return service.executeMarketTrade(parseIpcPayload(method, payload))
    case 'repeatProductionJob':
      return service.repeatProductionJob(parseIpcPayload(method, payload))
    case 'runProductionUntilExhausted':
      return service.runProductionUntilExhausted(parseIpcPayload(method, payload))
    case 'acceptContract':
      return service.acceptContract(parseIpcPayload(method, payload))
    case 'completeContract':
      return service.completeContract(parseIpcPayload(method, payload))
    case 'abandonContract':
      return service.abandonContract(parseIpcPayload(method, payload))
    case 'reloadModData':
      return service.reloadModData()
    default:
      throw new GameError('NOT_FOUND', `Unknown IPC method "${method}".`)
  }
}

/**
 * Invoke a method and reduce any thrown value to a structured IpcResult, so
 * the renderer always receives `{ ok, data | error }` and never a rejected
 * promise. Expected GameErrors pass through with their code; anything else is
 * classified INTERNAL and logged here (the renderer only sees the message).
 */
export function safeDispatch(service: GameService, method: string, payload: unknown): IpcResult<unknown> {
  try {
    return { ok: true, data: invokeMethod(service, method, payload) }
  } catch (err) {
    const error = toIpcError(err)
    if (error.code === 'INTERNAL') {
      logError(`Unexpected error in IPC method "${method}"`, err)
    }
    return { ok: false, error }
  }
}
