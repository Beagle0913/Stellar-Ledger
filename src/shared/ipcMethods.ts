/** Single source of truth for GameApi IPC method wiring (preload + dispatch verify). */
export type IpcMethodSpec = {
  name: string
  hasPayload: boolean
}

export const IPC_METHOD_SPECS = [
  { name: 'listSaves', hasPayload: false },
  { name: 'listScenarios', hasPayload: false },
  { name: 'createNewCampaign', hasPayload: true },
  { name: 'loadCampaign', hasPayload: true },
  { name: 'saveCurrent', hasPayload: false },
  { name: 'hasActiveCampaign', hasPayload: false },
  { name: 'getDashboard', hasPayload: false },
  { name: 'getItems', hasPayload: false },
  { name: 'getPriceHistory', hasPayload: true },
  { name: 'getSystems', hasPayload: false },
  { name: 'getStarMap', hasPayload: false },
  { name: 'getSystem', hasPayload: true },
  { name: 'getPlanet', hasPayload: true },
  { name: 'getMarket', hasPayload: true },
  { name: 'createMarketOrder', hasPayload: true },
  { name: 'cancelMarketOrder', hasPayload: true },
  { name: 'getInventory', hasPayload: false },
  { name: 'getProduction', hasPayload: false },
  { name: 'getProductionPlan', hasPayload: true },
  { name: 'startProductionJob', hasPayload: true },
  { name: 'buildBuilding', hasPayload: true },
  { name: 'getLogistics', hasPayload: false },
  { name: 'createTransportJob', hasPayload: true },
  { name: 'cancelTransportJob', hasPayload: true },
  { name: 'runTick', hasPayload: false },
  { name: 'runTicks', hasPayload: true },
  { name: 'deleteSave', hasPayload: true },
  { name: 'renameSave', hasPayload: true },
  { name: 'getMods', hasPayload: false },
  { name: 'setModEnabled', hasPayload: true },
  { name: 'getEvents', hasPayload: false },
  { name: 'getActivityLog', hasPayload: true },
  { name: 'getDebugState', hasPayload: false },
  { name: 'cancelProductionJob', hasPayload: true },
  { name: 'purchaseShip', hasPayload: true },
  { name: 'runTicksSmart', hasPayload: true },
  { name: 'previewMarketTrade', hasPayload: true },
  { name: 'executeMarketTrade', hasPayload: true },
  { name: 'repeatProductionJob', hasPayload: true },
  { name: 'runProductionUntilExhausted', hasPayload: true },
  { name: 'acceptContract', hasPayload: true },
  { name: 'completeContract', hasPayload: true },
  { name: 'abandonContract', hasPayload: true },
  { name: 'reloadModData', hasPayload: false }
] as const satisfies readonly IpcMethodSpec[]

export const HANDLED_METHODS = IPC_METHOD_SPECS.map((spec) => spec.name)

export type HandledMethod = (typeof IPC_METHOD_SPECS)[number]['name']
