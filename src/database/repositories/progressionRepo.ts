import type { DB } from '../db.js'
import { parseStoredProgression } from '../saveValidation.js'
import type { CampaignProgression } from '../../shared/types.js'
import { initObjectiveProgress } from '../../simulation/progression.js'
import type { ObjectiveDefinition } from '../../shared/types.js'

const EMPTY_PROGRESSION: CampaignProgression = {
  objectives: [],
  totalSellProceeds: 0,
  firstInterSystemDelivery: false,
  producedItems: {},
  activeContracts: [],
  completedContractIds: [],
  factionReputation: {},
  eventLastFiredTick: {}
}

export function saveProgression(db: DB, progression: CampaignProgression): void {
  db.prepare(
    `UPDATE campaign_meta SET progression_json = @progression_json`
  ).run({ progression_json: JSON.stringify(progression) })
}

export function loadProgression(
  db: DB,
  objectives: ObjectiveDefinition[]
): CampaignProgression {
  const row = db
    .prepare('SELECT progression_json FROM campaign_meta LIMIT 1')
    .get() as { progression_json: string | null } | undefined
  if (!row?.progression_json) {
    return {
      ...EMPTY_PROGRESSION,
      objectives: initObjectiveProgress(objectives)
    }
  }
  const parsed = parseStoredProgression(row.progression_json)
  if (!parsed) {
    return {
      ...EMPTY_PROGRESSION,
      objectives: initObjectiveProgress(objectives)
    }
  }
  if (!parsed.objectives?.length && objectives.length > 0) {
    parsed.objectives = initObjectiveProgress(objectives)
  }
  if (!parsed.eventLastFiredTick) {
    parsed.eventLastFiredTick = {}
  }
  return parsed
}
