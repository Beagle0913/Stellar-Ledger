import type { EconomyConfig } from './types.js'

/** Engine defaults for regional economy simulation (overridable via mod `economy_config.json`). */
export const DEFAULT_ECONOMY_CONFIG: EconomyConfig = {
  npcLiquidityMinFraction: 0.08,
  npcLiquidityMaxFraction: 1.0,
  regionalTradeMinSpreadPercent: 6,
  regionalTradeMaxUnitsPerDay: 30,
  regionalTradeMinSurplusFraction: 0.12,
  regionalTradeMinShortageFraction: 0.12,
  populationGrowthRatePerDay: 0.00008,
  populationDeclineFoodRatio: 0.45,
  populationFoodItemId: 'food',
  fuelItemId: 'fuel',
  npcStockTargets: {
    ore: 80,
    metal: 30,
    machinery: 4,
    energy: 40,
    fuel: 30,
    food: 20
  },
  npcDefaultStockTarget: 20,
  npcMarketMaxOrderQty: 40,
  npcMarketMinOrderQty: 5,
  npcMarketSurplusFraction: 0.25,
  npcMarketShortageFraction: 0.5,
  npcMarketSellPriceMult: 1.05,
  npcMarketBuyPriceMult: 0.95,
  npcLogisticsMaxQty: 60,
  npcLogisticsMinSurplus: 10,
  npcLogisticsMinShortage: 10,
  npcLogisticsSurplusFraction: 0.3,
  npcLogisticsShortageFraction: 0.5,
  npcBalancedOreThreshold: 8,
  npcBalancedOreItemId: 'ore',
  npcMaxProductionRunsPerBuilding: 5
}

/** Merge mod overrides onto defaults; unknown keys are ignored by the schema layer. */
export function mergeEconomyConfig(partial: Partial<EconomyConfig> | null | undefined): EconomyConfig {
  if (!partial) return { ...DEFAULT_ECONOMY_CONFIG }
  return { ...DEFAULT_ECONOMY_CONFIG, ...partial }
}

/** Clamp a ratio into [min, max]. */
export function clampFraction(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/** NPC order depth for a profiled item from regional stockpile vs target. */
export function npcLiquidityQuantity(
  config: EconomyConfig,
  stockpile: number,
  targetStockpile: number,
  side: 'buy' | 'sell',
  baseQuantity: number
): number {
  if (targetStockpile <= 0) return baseQuantity

  const ratio = stockpile / targetStockpile
  const { npcLiquidityMinFraction: minF, npcLiquidityMaxFraction: maxF } = config

  let fraction: number
  if (side === 'sell') {
    // Player buys from NPC — depth scales with available regional stock.
    fraction = clampFraction(ratio, minF, maxF)
  } else {
    // Player sells to NPC — buyers absorb more when the region is in surplus.
    const surplusBoost = Math.max(0, ratio - 1)
    fraction = clampFraction(minF + surplusBoost * (maxF - minF), minF, maxF)
  }

  return Math.max(1, Math.round(baseQuantity * fraction))
}
