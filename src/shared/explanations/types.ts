/** Player-facing severity for explanation lines. */
export type ExplanationSeverity = 'info' | 'warning' | 'critical'

export type MarketExplanationCode =
  | 'market.price.rising.shortage'
  | 'market.price.rising.npc_demand'
  | 'market.price.falling.surplus'
  | 'market.price.falling.npc_supply'
  | 'market.price.stable'
  | 'market.price.changed.trade'
  | 'market.trade.blocked.no_liquidity'
  | 'market.trade.blocked.insufficient_inventory'
  | 'market.trade.blocked.insufficient_credits'

export type ProductionExplanationCode =
  | 'production.blocked.missing_inputs'
  | 'production.blocked.wrong_building'
  | 'production.blocked.invalid_quantity'
  | 'production.idle.no_job'
  | 'production.queued.waiting_for_inputs'

export type LogisticsExplanationCode =
  | 'logistics.blocked.no_capacity'
  | 'logistics.blocked.insufficient_fuel'
  | 'logistics.blocked.insufficient_cargo'
  | 'logistics.blocked.same_system'
  | 'logistics.in_transit.days_remaining'

export type EventExplanationCode =
  | 'event.fired.trigger_match'
  | 'event.blocked.min_campaign_tick'
  | 'event.blocked.objective_gate'
  | 'event.blocked.cooldown'
  | 'event.blocked.trigger_not_met'

export type ObjectiveExplanationCode =
  | 'objective.locked.requires_prerequisite'
  | 'objective.completed.cumulative_progress'
  | 'objective.active.in_progress'

export type ContractExplanationCode =
  | 'contract.blocked.min_campaign_tick'
  | 'contract.blocked.not_accepted'
  | 'contract.blocked.progress_incomplete'

export type ErrorExplanationCode =
  | 'error.validation'
  | 'error.not_found'
  | 'error.conflict'
  | 'error.no_campaign'
  | 'error.mod_validation'
  | 'error.internal'
  | 'error.unknown'

export type ExplanationCode =
  | MarketExplanationCode
  | ProductionExplanationCode
  | LogisticsExplanationCode
  | EventExplanationCode
  | ObjectiveExplanationCode
  | ContractExplanationCode
  | ErrorExplanationCode

export interface Explanation {
  code: ExplanationCode
  severity: ExplanationSeverity
  title: string
  message: string
  relatedSystemId?: string
  relatedItemId?: string
  relatedObjectiveId?: string
  relatedContractId?: string
  relatedEventId?: string
  details?: Record<string, string | number | boolean>
}

/** Optional regional stockpile context for richer market messages. */
export interface StockpileContext {
  stockpile: number
  targetStockpile: number
}

/** Result of read-only event eligibility check (see eventRegistry.explainEventEligibility). */
export interface EventEligibilityResult {
  eligible: boolean
  blockedBy?: EventExplanationCode
  details?: Record<string, string | number | boolean>
}

/** Max explanations in the daily tick digest. */
export const TICK_DIGEST_MAX = 8
