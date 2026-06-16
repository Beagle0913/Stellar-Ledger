import type { StrategyId } from '../types.js'
import { arcPlayStrategy } from './arcPlay.js'
import { contractsStrategy } from './contracts.js'
import { idleStrategy } from './idle.js'
import { logisticsStrategy } from './logistics.js'
import { smeltAndSellOptimalStrategy, smeltAndSellStrategy } from './smeltAndSell.js'
import type { PlayerStrategy } from './types.js'

const STRATEGIES: Record<StrategyId, PlayerStrategy> = {
  idle: idleStrategy,
  arcPlay: arcPlayStrategy,
  smeltAndSell: smeltAndSellStrategy,
  smeltAndSellOptimal: smeltAndSellOptimalStrategy,
  logistics: logisticsStrategy,
  contracts: contractsStrategy
}

export function getStrategy(id: StrategyId): PlayerStrategy {
  const strategy = STRATEGIES[id]
  if (!strategy) throw new Error(`Unknown balance strategy "${id}".`)
  return strategy
}

export function allStrategyIds(): StrategyId[] {
  return Object.keys(STRATEGIES) as StrategyId[]
}

export { idleStrategy, arcPlayStrategy, smeltAndSellStrategy, smeltAndSellOptimalStrategy, logisticsStrategy, contractsStrategy }
