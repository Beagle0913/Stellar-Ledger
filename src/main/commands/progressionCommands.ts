import type { GameState } from '../../shared/types.js'
import {
  acceptContract,
  abandonContract,
  completeContract,
  refreshObjectiveProgress
} from '../../simulation/progression.js'
import { logPlayerAction } from '../actionLog.js'
import type { CampaignSession } from '../campaignSession.js'

export function cmdAcceptContract(
  session: CampaignSession,
  state: GameState,
  contractId: string
): true {
  const contract = state.progression.activeContracts.find((c) => c.id === contractId)
  acceptContract(state, contractId)
  if (contract) {
    logPlayerAction(state, 'contract', `Accepted contract "${contract.title}".`)
  }
  session.persistAfterMutation()
  return true
}

export function cmdCompleteContract(
  session: CampaignSession,
  state: GameState,
  contractId: string
): true {
  const contract = state.progression.activeContracts.find((c) => c.id === contractId)
  completeContract(state, contractId)
  refreshObjectiveProgress(state)
  if (contract) {
    logPlayerAction(
      state,
      'contract',
      `Completed "${contract.title}" — ${contract.creditReward.toLocaleString()} cr, +${contract.reputationReward} rep.`
    )
  }
  session.persistAfterMutation()
  return true
}

export function cmdAbandonContract(
  session: CampaignSession,
  state: GameState,
  contractId: string
): true {
  const contract = state.progression.activeContracts.find((c) => c.id === contractId)
  abandonContract(state, contractId)
  if (contract) {
    logPlayerAction(state, 'contract', `Abandoned contract "${contract.title}".`)
  }
  session.persistAfterMutation()
  return true
}
