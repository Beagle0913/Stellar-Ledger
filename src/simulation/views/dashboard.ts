import type { DashboardData, GameState } from '../../shared/types.js'
import { buildActionSuggestions } from '../actionSuggestions.js'
import { getPlayerCorporation } from '../corporations.js'
import { estimateInventoryValue } from '../economyMath.js'
import {
  buildContractViews,
  buildFactionReputationViews,
  buildObjectiveViews
} from '../progression.js'
import { resolveBuildingNameForInstance, resolveRecipeName } from '../resolveNames.js'

export function buildDashboard(state: GameState): DashboardData {
  const corp = getPlayerCorporation(state)
  const openJobs = state.productionJobs.filter(
    (j) => j.status === 'running' || j.status === 'queued'
  )
  return {
    campaignName: state.meta.name,
    credits: Math.round(corp.credits),
    tick: state.meta.tick,
    systemCount: state.definitions.systems.length,
    planetCount: state.definitions.planets.length,
    inventoryValueEstimate: estimateInventoryValue(state, corp.id),
    activeProductionJobs: state.productionJobs.filter((j) => j.status === 'running').length,
    activeTransportJobs: state.transportJobs.filter((j) => j.status === 'running').length,
    productionJobs: openJobs.map((j) => ({
      id: j.id,
      recipeName: resolveRecipeName(state, j.recipeId),
      buildingName: resolveBuildingNameForInstance(state, j.buildingId),
      progress: j.progress,
      duration: j.duration,
      status: j.status
    })),
    objectives: buildObjectiveViews(state),
    contracts: buildContractViews(state),
    factionReputation: buildFactionReputationViews(state),
    actionSuggestions: buildActionSuggestions(state),
    saveStatus: 'saved',
    lastSavedTick: state.meta.tick,
    saveError: null
  }
}
