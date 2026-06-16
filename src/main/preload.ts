import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNEL } from '../shared/constants.js'
import type { GameApi } from '../shared/types.js'

// The preload runs in an isolated context and is the ONLY bridge between the
// renderer and the main process. It exposes a typed, minimal API; the renderer
// has no direct access to Node or Electron internals.

function call<T>(method: string, payload?: unknown): Promise<T> {
  return ipcRenderer.invoke(IPC_CHANNEL, method, payload) as Promise<T>
}

const api: GameApi = {
  listSaves: () => call('listSaves'),
  createNewCampaign: (name) => call('createNewCampaign', name),
  loadCampaign: (id) => call('loadCampaign', id),
  saveCurrent: () => call('saveCurrent'),
  hasActiveCampaign: () => call('hasActiveCampaign'),
  getDashboard: () => call('getDashboard'),
  getItems: () => call('getItems'),
  getPriceHistory: (args) => call('getPriceHistory', args),
  getSystems: () => call('getSystems'),
  getStarMap: () => call('getStarMap'),
  getSystem: (id) => call('getSystem', id),
  getPlanet: (id) => call('getPlanet', id),
  getMarket: (systemId) => call('getMarket', systemId),
  createMarketOrder: (args) => call('createMarketOrder', args),
  cancelMarketOrder: (orderId) => call('cancelMarketOrder', orderId),
  getInventory: () => call('getInventory'),
  getProduction: () => call('getProduction'),
  startProductionJob: (args) => call('startProductionJob', args),
  buildBuilding: (args) => call('buildBuilding', args),
  getLogistics: () => call('getLogistics'),
  createTransportJob: (args) => call('createTransportJob', args),
  cancelTransportJob: (jobId) => call('cancelTransportJob', jobId),
  runTick: () => call('runTick'),
  runTicks: (n) => call('runTicks', n),
  deleteSave: (fileName) => call('deleteSave', fileName),
  renameSave: (fileName, newName) => call('renameSave', { fileName, newName }),
  getMods: () => call('getMods'),
  setModEnabled: (args) => call('setModEnabled', args),
  getEvents: () => call('getEvents'),
  getActivityLog: (limit) => call('getActivityLog', limit),
  getDebugState: () => call('getDebugState'),
  cancelProductionJob: (jobId) => call('cancelProductionJob', jobId),
  purchaseShip: (args) => call('purchaseShip', args),
  runTicksSmart: (args) => call('runTicksSmart', args),
  previewMarketTrade: (args) => call('previewMarketTrade', args),
  executeMarketTrade: (args) => call('executeMarketTrade', args),
  repeatProductionJob: (args) => call('repeatProductionJob', args),
  runProductionUntilExhausted: (args) => call('runProductionUntilExhausted', args),
  acceptContract: (contractId) => call('acceptContract', contractId),
  completeContract: (contractId) => call('completeContract', contractId),
  abandonContract: (contractId) => call('abandonContract', contractId),
  reloadModData: () => call('reloadModData')
}

contextBridge.exposeInMainWorld('api', api)
