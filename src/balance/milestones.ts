import type { GameState } from '../shared/types.js'
import type { DailySnapshot } from './types.js'

export interface MilestoneDays {
  daySecondHauler1: number | null
  dayHauler2Affordable: number | null
  dayArcComplete: number | null
  dayNetWorthObjective: number | null
}

export function computeMilestones(snapshots: DailySnapshot[], state: GameState): MilestoneDays {
  const hauler2 = state.definitions.ships.find((s) => s.id === 'ship_hauler_2')
  const hauler2Cost = hauler2?.purchaseCost ?? Number.MAX_SAFE_INTEGER

  let daySecondHauler1: number | null = null
  let dayHauler2Affordable: number | null = null
  let dayArcComplete: number | null = null
  let dayNetWorthObjective: number | null = null

  for (const snap of snapshots) {
    if (daySecondHauler1 === null && snap.shipsOwned >= 2) {
      daySecondHauler1 = snap.day
    }
    if (dayHauler2Affordable === null && snap.credits >= hauler2Cost) {
      dayHauler2Affordable = snap.day
    }
    if (dayArcComplete === null && snap.objectivesCompleted.includes('obj_arc_fleet')) {
      dayArcComplete = snap.day
    }
    if (dayNetWorthObjective === null && snap.objectivesCompleted.includes('obj_net_worth')) {
      dayNetWorthObjective = snap.day
    }
  }

  return { daySecondHauler1, dayHauler2Affordable, dayArcComplete, dayNetWorthObjective }
}
