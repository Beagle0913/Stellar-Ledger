import { z } from 'zod'
import { GameError } from '../shared/errors.js'

// Zod schemas for every payload-carrying IPC method. The dispatcher parses the
// payload with the matching schema BEFORE the GameService is called, so the
// service only ever sees well-formed input. Methods without a payload are not
// listed here.

const nonEmptyString = z.string().min(1)

export const ipcPayloadSchemas = {
  createNewCampaign: z.object({
    name: z.string().min(1),
    scenarioId: z.string().min(1).optional()
  }),
  loadCampaign: nonEmptyString,
  getSystem: nonEmptyString,
  getPlanet: nonEmptyString,
  getMarket: nonEmptyString,
  getPriceHistory: z.object({
    systemId: nonEmptyString,
    itemId: nonEmptyString,
    sinceTick: z.number().int().nonnegative().optional(),
    limit: z.number().int().positive().max(500).optional()
  }),
  createMarketOrder: z.object({
    systemId: nonEmptyString,
    itemId: nonEmptyString,
    side: z.enum(['buy', 'sell']),
    quantity: z.number().positive(),
    price: z.number().positive()
  }),
  cancelMarketOrder: nonEmptyString,
  startProductionJob: z.object({
    buildingId: nonEmptyString,
    recipeId: nonEmptyString,
    quantity: z.number().positive()
  }),
  buildBuilding: z.object({
    planetId: nonEmptyString,
    buildingType: nonEmptyString
  }),
  cancelTransportJob: nonEmptyString,
  createTransportJob: z.object({
    shipId: nonEmptyString,
    destinationSystemId: nonEmptyString,
    itemId: nonEmptyString,
    quantity: z.number().positive()
  }),
  runTicks: z.number().int().min(1).max(365),
  deleteSave: nonEmptyString,
  renameSave: z.object({
    fileName: nonEmptyString,
    newName: nonEmptyString
  }),
  setModEnabled: z.object({
    modId: nonEmptyString,
    enabled: z.boolean()
  }),
  cancelProductionJob: nonEmptyString,
  purchaseShip: z.object({
    shipDefinitionId: nonEmptyString,
    name: z.string().optional()
  }),
  runTicksSmart: z.object({
    mode: z.enum(['production', 'transport', 'changes']),
    maxDays: z.number().int().min(1).max(30).optional()
  }),
  previewMarketTrade: z.object({
    systemId: nonEmptyString,
    itemId: nonEmptyString,
    action: z.enum(['sell_max', 'buy_amount', 'sell_amount']),
    quantity: z.number().positive().optional()
  }),
  executeMarketTrade: z.object({
    systemId: nonEmptyString,
    itemId: nonEmptyString,
    action: z.enum(['sell_max', 'buy_amount', 'sell_amount']),
    quantity: z.number().positive().optional()
  }),
  repeatProductionJob: z.object({
    buildingId: nonEmptyString,
    recipeId: nonEmptyString,
    quantity: z.number().positive()
  }),
  runProductionUntilExhausted: z.object({
    buildingId: nonEmptyString,
    recipeId: nonEmptyString
  }),
  acceptContract: nonEmptyString,
  completeContract: nonEmptyString,
  abandonContract: nonEmptyString,
  getActivityLog: z.number().int().min(1).max(500).optional()
} as const

export type PayloadMethod = keyof typeof ipcPayloadSchemas

/**
 * Validate an IPC payload against the schema for `method`. Throws an Error with
 * a clear list of issues on failure; returns the typed payload on success.
 */
export function parseIpcPayload<M extends PayloadMethod>(
  method: M,
  payload: unknown
): z.infer<(typeof ipcPayloadSchemas)[M]> {
  const result = ipcPayloadSchemas[method].safeParse(payload)
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join('.') || '(payload)'}: ${i.message}`)
      .join('; ')
    throw new GameError('VALIDATION', `Invalid payload for "${method}": ${issues}`)
  }
  return result.data as z.infer<(typeof ipcPayloadSchemas)[M]>
}
