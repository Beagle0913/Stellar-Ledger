/**
 * Playtest-driven economy tuning (M4). Contract-flow knobs validated by tests.
 * Starting credits/stock/buildings come from mod `campaign_start.json` (see campaignStartConfig.ts).
 */

import {
  DEFAULT_CAMPAIGN_START_CONFIG
} from './campaignStartConfig.js'

/** Starting cash — mirrors vanilla campaign_start.json (used by constants re-export). */
export const STARTING_CREDITS = DEFAULT_CAMPAIGN_START_CONFIG.startingCredits

/** Home-system starting stock — mirrors vanilla campaign_start.json. */
export const STARTING_STOCK: Readonly<Record<string, number>> =
  DEFAULT_CAMPAIGN_START_CONFIG.startingStock

/** Tier-2 contracts require at least this many campaign days (early board stays simple). */
export const CONTRACT_TIER2_MIN_DAY = 25

/** Max contract payout vs naive market value (baseValue × qty) for tier-1 offers. */
export const CONTRACT_TIER1_MAX_MARKET_MULTIPLIER = 1.35

/** Reputation adds up to this fraction to contract credit payouts (not regional prices). */
export const REPUTATION_BONUS_PER_POINT = 0.005
export const REPUTATION_BONUS_CAP = 0.1

export function contractCreditBonusMultiplier(reputation: number): number {
  const bonus = Math.min(Math.max(0, reputation) * REPUTATION_BONUS_PER_POINT, REPUTATION_BONUS_CAP)
  return 1 + bonus
}

export function effectiveContractCreditReward(baseReward: number, reputation: number): number {
  return Math.round(baseReward * contractCreditBonusMultiplier(reputation))
}
