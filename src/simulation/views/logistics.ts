import { explainTransportInTransit } from '../../shared/explanations/index.js'
import type { GameState, LogisticsView } from '../../shared/types.js'
import { resolveItemName, resolveSystemName } from '../resolveNames.js'
import { canAffordShip } from '../ships.js'

export function buildLogisticsView(state: GameState): LogisticsView {
  return {
    ships: state.ships,
    jobs: state.transportJobs.map((j) => {
      let explanation
      if (j.status === 'running') {
        explanation = explainTransportInTransit(
          j,
          resolveSystemName(state, j.originSystemId),
          resolveSystemName(state, j.destinationSystemId)
        )
      }
      return { ...j, itemName: resolveItemName(state, j.itemId), explanation }
    }),
    purchasableShips: state.definitions.ships.map((def) => ({
      ...def,
      affordable: canAffordShip(state, def.id)
    }))
  }
}
