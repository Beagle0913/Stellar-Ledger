import { trimEventsLog } from '../shared/gameLog.js'
import type { GameState, ProductionJob, TransportJob } from '../shared/types.js'
import { processEvents } from './events.js'
import { processTransportJobs } from './logistics.js'
import { applyTradesToLocalStockpiles, processLocalEconomy } from './localEconomy.js'
import { matchMarket, recordPriceHistory, replenishNpcLiquidity } from './market.js'
import type { Trade } from './market.js'
import { syncNpcLiquidityToStockpiles } from './npcLiquidity.js'
import { processNpcLogisticsAI } from './npcLogisticsAI.js'
import { processNpcMarketAI } from './npcMarketAI.js'
import { processNpcProductionAI } from './npcProductionAI.js'
import { processNpcRegionalTrade } from './npcRegionalTrade.js'
import type { RegionalTrade } from './npcRegionalTrade.js'
import { processPopulationDynamics } from './populationDynamics.js'
import type { PopulationChange } from './populationDynamics.js'
import { applyTradesToProgression } from './progression.js'
import { processProductionJobs } from './production.js'

export type TickStepContext = {
  nextTick: number
  productionSnapshot: Map<string, string>
  transportSnapshot: Map<string, string>
  completedProductionJobs: number
  completedTransportJobs: number
  completedProduction: ProductionJob[]
  completedTransport: TransportJob[]
  populationChanges: PopulationChange[]
  regionalTradeList: RegionalTrade[]
  eventsBefore: number
  trades: Trade[]
  newEventsCount: number
}

export type TickStep = {
  id: string
  run: (state: GameState, ctx: TickStepContext) => void
}

function snapshotJobStatuses(jobs: Array<{ id: string; status: string }>): Map<string, string> {
  return new Map(jobs.map((j) => [j.id, j.status]))
}

function countNewlyCompleted(
  before: Map<string, string>,
  jobs: Array<{ id: string; status: string }>
): number {
  let n = 0
  for (const job of jobs) {
    if (before.get(job.id) !== 'completed' && job.status === 'completed') n += 1
  }
  return n
}

function findNewlyCompletedJobs(
  before: Map<string, string>,
  jobs: Array<{ id: string; status: string }>
): Array<{ id: string; status: string }> {
  return jobs.filter((j) => before.get(j.id) !== 'completed' && j.status === 'completed')
}

/** Ordered economy tick steps (see ECONOMY.md / tick.ts header). */
export const TICK_STEPS: TickStep[] = [
  {
    id: 'production',
    run(state, ctx) {
      ctx.productionSnapshot = snapshotJobStatuses(state.productionJobs)
      processProductionJobs(state)
      ctx.completedProductionJobs = countNewlyCompleted(ctx.productionSnapshot, state.productionJobs)
      ctx.completedProduction = findNewlyCompletedJobs(
        ctx.productionSnapshot,
        state.productionJobs
      ) as ProductionJob[]
    }
  },
  {
    id: 'transport',
    run(state, ctx) {
      ctx.transportSnapshot = snapshotJobStatuses(state.transportJobs)
      processTransportJobs(state)
      ctx.completedTransportJobs = countNewlyCompleted(ctx.transportSnapshot, state.transportJobs)
      ctx.completedTransport = findNewlyCompletedJobs(
        ctx.transportSnapshot,
        state.transportJobs
      ) as TransportJob[]
    }
  },
  {
    id: 'npcProduction',
    run(state) {
      processNpcProductionAI(state)
    }
  },
  {
    id: 'npcMarket',
    run(state) {
      processNpcMarketAI(state)
    }
  },
  {
    id: 'npcLogistics',
    run(state) {
      processNpcLogisticsAI(state)
    }
  },
  {
    id: 'localEconomy',
    run(state, ctx) {
      processLocalEconomy(state, ctx.nextTick)
    }
  },
  {
    id: 'population',
    run(state, ctx) {
      ctx.populationChanges = processPopulationDynamics(state)
    }
  },
  {
    id: 'regionalTrade',
    run(state, ctx) {
      ctx.regionalTradeList = processNpcRegionalTrade(state)
    }
  },
  {
    id: 'syncNpcLiquidity',
    run(state) {
      syncNpcLiquidityToStockpiles(state)
    }
  },
  {
    id: 'matchMarket',
    run(state, ctx) {
      ctx.eventsBefore = state.eventsLog.length
      ctx.trades = matchMarket(state)
    }
  },
  {
    id: 'applyTrades',
    run(state, ctx) {
      applyTradesToLocalStockpiles(state, ctx.trades)
      applyTradesToProgression(state, ctx.trades)
    }
  },
  {
    id: 'replenishNpcLiquidity',
    run(state) {
      replenishNpcLiquidity(state)
    }
  },
  {
    id: 'recordPriceHistory',
    run(state, ctx) {
      recordPriceHistory(state, ctx.trades, ctx.nextTick)
    }
  },
  {
    id: 'events',
    run(state, ctx) {
      processEvents(state, ctx.nextTick)
      ctx.newEventsCount = state.eventsLog.length - ctx.eventsBefore
      trimEventsLog(state)
    }
  }
]

export function createTickStepContext(nextTick: number): TickStepContext {
  return {
    nextTick,
    productionSnapshot: new Map(),
    transportSnapshot: new Map(),
    completedProductionJobs: 0,
    completedTransportJobs: 0,
    completedProduction: [],
    completedTransport: [],
    populationChanges: [],
    regionalTradeList: [],
    eventsBefore: 0,
    trades: [],
    newEventsCount: 0
  }
}
