import type {
  DashboardData,
  DebugStateView,
  EventLogView,
  GameLogEntry,
  InventoryView,
  ItemDefinition,
  LogisticsView,
  MarketView,
  PlanetDetail,
  PriceHistoryArgs,
  PricePoint,
  ProductionPlanArgs,
  ProductionPlanView,
  ProductionView,
  StarMapView,
  SystemDetail,
  SystemSummary
} from '../../shared/types.js'
import {
  buildDashboard,
  buildDebugStateView,
  buildEventLogViews,
  buildInventoryView,
  buildLogisticsView,
  buildMarketView,
  buildPlanetDetail,
  buildPriceHistory,
  buildProductionPlanView,
  buildProductionView,
  buildSystemDetail,
  buildSystemSummaries
} from '../../simulation/viewQueries.js'
import { buildStarMapView } from '../../simulation/starMapView.js'
import type { CampaignSession } from '../campaignSession.js'

export interface GameViewsDeps {
  session: CampaignSession
}

export function createGameViews(deps: GameViewsDeps) {
  const { session } = deps

  return {
    getDashboard(): DashboardData {
      const { state } = session.require()
      return { ...buildDashboard(state), ...session.getSaveStatus() }
    },

    getItems(): ItemDefinition[] {
      const { state } = session.require()
      return state.definitions.items
    },

    getPriceHistory(args: PriceHistoryArgs): PricePoint[] {
      const { state } = session.require()
      return buildPriceHistory(state, args)
    },

    getSystems(): SystemSummary[] {
      const { state } = session.require()
      return buildSystemSummaries(state)
    },

    getStarMap(): StarMapView {
      const { state } = session.require()
      return buildStarMapView(state)
    },

    getSystem(id: string): SystemDetail {
      const { state } = session.require()
      return buildSystemDetail(state, id)
    },

    getPlanet(id: string): PlanetDetail {
      const { state } = session.require()
      return buildPlanetDetail(state, id)
    },

    getMarket(systemId: string): MarketView {
      const { state } = session.require()
      return buildMarketView(state, systemId)
    },

    getInventory(): InventoryView[] {
      const { state } = session.require()
      return buildInventoryView(state)
    },

    getProduction(): ProductionView {
      const { state } = session.require()
      return buildProductionView(state)
    },

    getProductionPlan(args: ProductionPlanArgs): ProductionPlanView {
      const { state } = session.require()
      return buildProductionPlanView(state, args)
    },

    getLogistics(): LogisticsView {
      const { state } = session.require()
      return buildLogisticsView(state)
    },

    getEvents(): EventLogView[] {
      const { state } = session.require()
      return buildEventLogViews(state).reverse()
    },

    getActivityLog(limit = 200): GameLogEntry[] {
      const { state } = session.require()
      const cap = Math.max(1, Math.min(limit, 500))
      return [...state.activityLog].reverse().slice(0, cap)
    },

    getDebugState(): DebugStateView {
      const { state } = session.require()
      return { ...buildDebugStateView(state), loadWarnings: session.getLoadWarnings() }
    }
  }
}

export type GameViews = ReturnType<typeof createGameViews>
