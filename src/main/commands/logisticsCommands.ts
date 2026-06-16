import type { CreateTransportJobArgs, GameState, PurchaseShipArgs } from '../../shared/types.js'
import { cancelTransportJob, createTransportJob } from '../../simulation/logistics.js'
import { refreshObjectiveProgress } from '../../simulation/progression.js'
import { purchaseShip } from '../../simulation/ships.js'
import { logPlayerAction } from '../actionLog.js'
import type { CampaignSession } from '../campaignSession.js'

export function cmdCreateTransportJob(
  session: CampaignSession,
  state: GameState,
  args: CreateTransportJobArgs
): true {
  const job = createTransportJob(state, args)
  const item = state.definitions.items.find((i) => i.id === args.itemId)?.name ?? args.itemId
  const dest =
    state.definitions.systems.find((s) => s.id === args.destinationSystemId)?.name ??
    args.destinationSystemId
  logPlayerAction(
    state,
    'transport',
    `Dispatched ${args.quantity} ${item} to ${dest} (job ${job.id}).`
  )
  session.persistAfterMutation()
  return true
}

export function cmdCancelTransportJob(
  session: CampaignSession,
  state: GameState,
  jobId: string
): true {
  const job = cancelTransportJob(state, jobId)
  const item = state.definitions.items.find((i) => i.id === job.itemId)?.name ?? job.itemId
  logPlayerAction(state, 'transport', `Cancelled transport of ${job.quantity} ${item} (${jobId}).`)
  session.persistAfterMutation()
  return true
}

export function cmdPurchaseShip(
  session: CampaignSession,
  state: GameState,
  args: PurchaseShipArgs
): true {
  const def = state.definitions.ships.find((s) => s.id === args.shipDefinitionId)
  purchaseShip(state, args.shipDefinitionId, args.name)
  refreshObjectiveProgress(state)
  logPlayerAction(
    state,
    'player',
    `Purchased ${def?.name ?? args.shipDefinitionId}${args.name ? ` "${args.name}"` : ''}.`
  )
  session.persistAfterMutation()
  return true
}
