import type {
  BuildBuildingArgs,
  CreateMarketOrderArgs,
  CreateTransportJobArgs,
  GameState,
  MarketTradePreview,
  PreviewMarketTradeArgs,
  RepeatProductionJobArgs,
  RunProductionUntilExhaustedArgs,
  RunTicksSmartArgs,
  StartProductionJobArgs,
  TickResult,
  PurchaseShipArgs
} from '../../shared/types.js'
import { recordRegionalTradesForMap } from '../../simulation/starMapView.js'
import { runTicksSmart } from '../../simulation/smartTick.js'
import { runTick, runTicks } from '../../simulation/tick.js'
import {
  cmdAcceptContract,
  cmdAbandonContract,
  cmdCompleteContract
} from '../commands/progressionCommands.js'
import {
  cmdCancelTransportJob,
  cmdCreateTransportJob,
  cmdPurchaseShip
} from '../commands/logisticsCommands.js'
import {
  cmdBuildBuilding,
  cmdCancelProductionJob,
  cmdRepeatProductionJob,
  cmdRunProductionUntilExhausted,
  cmdStartProductionJob
} from '../commands/productionCommands.js'
import {
  cmdCancelMarketOrder,
  cmdCreateMarketOrder,
  cmdExecuteMarketTrade,
  cmdPreviewMarketTrade
} from '../commands/marketCommands.js'
import { logTickEntries } from '../log.js'
import type { CampaignSession } from '../campaignSession.js'

export interface GameMutationsDeps {
  session: CampaignSession
}

function applyTickViewState(state: GameState, result: TickResult): void {
  if (result.regionalTradeList?.length) {
    recordRegionalTradesForMap(state, result.tick, result.regionalTradeList)
  }
}

export function createGameMutations(deps: GameMutationsDeps) {
  const { session } = deps

  return {
    createMarketOrder(args: CreateMarketOrderArgs): true {
      const { state } = session.require()
      return cmdCreateMarketOrder(session, state, args)
    },

    cancelMarketOrder(orderId: string): true {
      const { state } = session.require()
      return cmdCancelMarketOrder(session, state, orderId)
    },

    startProductionJob(args: StartProductionJobArgs): true {
      const { state } = session.require()
      return cmdStartProductionJob(session, state, args)
    },

    cancelProductionJob(jobId: string): true {
      const { state } = session.require()
      return cmdCancelProductionJob(session, state, jobId)
    },

    buildBuilding(args: BuildBuildingArgs): true {
      const { state } = session.require()
      return cmdBuildBuilding(session, state, args)
    },

    createTransportJob(args: CreateTransportJobArgs): true {
      const { state } = session.require()
      return cmdCreateTransportJob(session, state, args)
    },

    cancelTransportJob(jobId: string): true {
      const { state } = session.require()
      return cmdCancelTransportJob(session, state, jobId)
    },

    purchaseShip(args: PurchaseShipArgs): true {
      const { state } = session.require()
      return cmdPurchaseShip(session, state, args)
    },

    runTick(): TickResult {
      const { state } = session.require()
      const result = runTick(state)
      applyTickViewState(state, result)
      session.save()
      logTickEntries(result.log)
      return result
    },

    runTicks(n: number): TickResult {
      const { state } = session.require()
      const result = runTicks(state, n)
      applyTickViewState(state, result)
      session.save()
      logTickEntries(result.log)
      return result
    },

    runTicksSmart(args: RunTicksSmartArgs): TickResult {
      const { state } = session.require()
      const result = runTicksSmart(state, args.mode, args.maxDays ?? 30)
      applyTickViewState(state, result)
      session.save()
      logTickEntries(result.log)
      return result
    },

    previewMarketTrade(args: PreviewMarketTradeArgs): MarketTradePreview {
      const { state } = session.require()
      return cmdPreviewMarketTrade(state, args)
    },

    executeMarketTrade(args: PreviewMarketTradeArgs): MarketTradePreview {
      const { state } = session.require()
      return cmdExecuteMarketTrade(session, state, args)
    },

    repeatProductionJob(args: RepeatProductionJobArgs): true {
      const { state } = session.require()
      return cmdRepeatProductionJob(session, state, args)
    },

    runProductionUntilExhausted(args: RunProductionUntilExhaustedArgs): { queued: number } {
      const { state } = session.require()
      return cmdRunProductionUntilExhausted(session, state, args)
    },

    acceptContract(contractId: string): true {
      const { state } = session.require()
      return cmdAcceptContract(session, state, contractId)
    },

    completeContract(contractId: string): true {
      const { state } = session.require()
      return cmdCompleteContract(session, state, contractId)
    },

    abandonContract(contractId: string): true {
      const { state } = session.require()
      return cmdAbandonContract(session, state, contractId)
    }
  }
}

export type GameMutations = ReturnType<typeof createGameMutations>
