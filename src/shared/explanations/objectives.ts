import type { GameState, ObjectiveView } from '../types.js'
import { buildExplanation } from './text.js'
import type { Explanation } from './types.js'

function objectiveTitle(state: GameState, objectiveId: string): string {
  return state.definitions.objectives.find((o) => o.id === objectiveId)?.title ?? objectiveId
}

/** Explain why an objective is locked (returns null when unlocked or completed). */
export function explainObjectiveView(state: GameState, view: ObjectiveView): Explanation | null {
  if (view.completed || view.isUnlocked) return null

  if (view.dependsOnObjectiveId) {
    return buildExplanation(
      'objective.locked.requires_prerequisite',
      {
        objectiveTitle: view.title,
        prerequisiteTitle: objectiveTitle(state, view.dependsOnObjectiveId)
      },
      {
        relatedObjectiveId: view.id,
        details: { requiresObjectiveId: view.dependsOnObjectiveId }
      }
    )
  }

  return null
}

/** Footnote when contract templates are gated by campaign day. */
export function explainContractMinTickGate(minCampaignTick: number): Explanation {
  return buildExplanation(
    'contract.blocked.min_campaign_tick',
    { minCampaignTick },
    { details: { minCampaignTick } }
  )
}
