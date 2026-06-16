import { GameError } from '../../shared/errors.js'
import type {
  BuildBuildingArgs,
  GameState,
  RepeatProductionJobArgs,
  RunProductionUntilExhaustedArgs,
  StartProductionJobArgs
} from '../../shared/types.js'
import { buildBuilding as applyBuildBuilding } from '../../simulation/buildings.js'
import {
  cancelProductionJob,
  repeatProductionJob,
  runProductionUntilExhausted,
  startProductionJob
} from '../../simulation/production.js'
import { logPlayerAction } from '../actionLog.js'
import type { CampaignSession } from '../campaignSession.js'

export function cmdStartProductionJob(
  session: CampaignSession,
  state: GameState,
  args: StartProductionJobArgs
): true {
  startProductionJob(state, args.buildingId, args.recipeId, args.quantity)
  const recipe = state.definitions.recipes.find((r) => r.id === args.recipeId)?.name ?? args.recipeId
  logPlayerAction(state, 'production', `Started ${recipe} ×${args.quantity}.`)
  session.persistAfterMutation()
  return true
}

export function cmdCancelProductionJob(
  session: CampaignSession,
  state: GameState,
  jobId: string
): true {
  const job = state.productionJobs.find((j) => j.id === jobId)
  cancelProductionJob(state, jobId)
  if (job) {
    const recipe = state.definitions.recipes.find((r) => r.id === job.recipeId)?.name ?? job.recipeId
    logPlayerAction(state, 'production', `Cancelled production job ${recipe} (${job.status}).`)
  }
  session.persistAfterMutation()
  return true
}

export function cmdBuildBuilding(
  session: CampaignSession,
  state: GameState,
  args: BuildBuildingArgs
): true {
  const planet = state.definitions.planets.find((p) => p.id === args.planetId)
  const def = state.definitions.buildings.find((b) => b.id === args.buildingType)
  applyBuildBuilding(state, args.planetId, args.buildingType)
  logPlayerAction(
    state,
    'player',
    `Built ${def?.name ?? args.buildingType} on ${planet?.name ?? args.planetId} (${def?.buildCost.toLocaleString() ?? '?'} cr).`
  )
  session.persistAfterMutation()
  return true
}

export function cmdRepeatProductionJob(
  session: CampaignSession,
  state: GameState,
  args: RepeatProductionJobArgs
): true {
  const result = repeatProductionJob(state, args.buildingId, args.recipeId, args.quantity)
  if (!result.ok) throw new GameError('VALIDATION', result.reason)
  const recipe = state.definitions.recipes.find((r) => r.id === args.recipeId)?.name ?? args.recipeId
  logPlayerAction(state, 'production', `Queued repeat ${recipe} ×${args.quantity}.`)
  session.persistAfterMutation()
  return true
}

export function cmdRunProductionUntilExhausted(
  session: CampaignSession,
  state: GameState,
  args: RunProductionUntilExhaustedArgs
): { queued: number } {
  const queued = runProductionUntilExhausted(state, args.buildingId, args.recipeId)
  const recipe = state.definitions.recipes.find((r) => r.id === args.recipeId)?.name ?? args.recipeId
  if (queued > 0) {
    logPlayerAction(state, 'production', `Queued ${queued}× ${recipe} (run until exhausted).`)
  }
  session.persistAfterMutation()
  return { queued }
}
