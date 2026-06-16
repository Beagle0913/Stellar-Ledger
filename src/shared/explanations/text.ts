import type { Explanation, ExplanationCode, ExplanationSeverity } from './types.js'

export interface ExplanationTextParams {
  systemName?: string
  itemName?: string
  stockpile?: number
  targetStockpile?: number
  percentOfTarget?: number
  eventName?: string
  objectiveTitle?: string
  prerequisiteTitle?: string
  tick?: number
  minCampaignTick?: number
  nextEligibleTick?: number
  daysRemaining?: number
  totalDays?: number
  originName?: string
  destName?: string
  buildingName?: string
  /** Fallback — used when no template-specific fields apply. */
  rawMessage?: string
}

const DEFAULT_SEVERITY: Record<ExplanationCode, ExplanationSeverity> = {
  'market.price.rising.shortage': 'warning',
  'market.price.rising.npc_demand': 'warning',
  'market.price.falling.surplus': 'info',
  'market.price.falling.npc_supply': 'info',
  'market.price.stable': 'info',
  'market.price.changed.trade': 'info',
  'market.trade.blocked.no_liquidity': 'warning',
  'market.trade.blocked.insufficient_inventory': 'warning',
  'market.trade.blocked.insufficient_credits': 'warning',
  'production.blocked.missing_inputs': 'warning',
  'production.blocked.wrong_building': 'warning',
  'production.blocked.invalid_quantity': 'warning',
  'production.idle.no_job': 'info',
  'production.queued.waiting_for_inputs': 'info',
  'logistics.blocked.no_capacity': 'warning',
  'logistics.blocked.insufficient_fuel': 'warning',
  'logistics.blocked.insufficient_cargo': 'warning',
  'logistics.blocked.same_system': 'warning',
  'logistics.in_transit.days_remaining': 'info',
  'event.fired.trigger_match': 'info',
  'event.blocked.min_campaign_tick': 'info',
  'event.blocked.objective_gate': 'info',
  'event.blocked.cooldown': 'info',
  'event.blocked.trigger_not_met': 'info',
  'objective.locked.requires_prerequisite': 'info',
  'objective.completed.cumulative_progress': 'info',
  'objective.active.in_progress': 'info',
  'contract.blocked.min_campaign_tick': 'info',
  'contract.blocked.not_accepted': 'info',
  'contract.blocked.progress_incomplete': 'info',
  'error.validation': 'warning',
  'error.not_found': 'warning',
  'error.conflict': 'warning',
  'error.no_campaign': 'critical',
  'error.mod_validation': 'critical',
  'error.internal': 'critical',
  'error.unknown': 'warning'
}

const TITLES: Record<ExplanationCode, string> = {
  'market.price.rising.shortage': 'Price rising — shortage',
  'market.price.rising.npc_demand': 'Price rising — NPC demand',
  'market.price.falling.surplus': 'Price falling — surplus',
  'market.price.falling.npc_supply': 'Price falling — NPC supply',
  'market.price.stable': 'Price stable',
  'market.price.changed.trade': 'Price changed — recent trade',
  'market.trade.blocked.no_liquidity': 'Trade could not fill',
  'market.trade.blocked.insufficient_inventory': 'Not enough inventory',
  'market.trade.blocked.insufficient_credits': 'Not enough credits',
  'production.blocked.missing_inputs': 'Production blocked',
  'production.blocked.wrong_building': 'Wrong building',
  'production.blocked.invalid_quantity': 'Invalid quantity',
  'production.idle.no_job': 'Building idle',
  'production.queued.waiting_for_inputs': 'Job queued',
  'logistics.blocked.no_capacity': 'Shipment blocked',
  'logistics.blocked.insufficient_fuel': 'Not enough fuel',
  'logistics.blocked.insufficient_cargo': 'Not enough cargo',
  'logistics.blocked.same_system': 'Invalid route',
  'logistics.in_transit.days_remaining': 'In transit',
  'event.fired.trigger_match': 'Event fired',
  'event.blocked.min_campaign_tick': 'Event not yet available',
  'event.blocked.objective_gate': 'Event locked',
  'event.blocked.cooldown': 'Event on cooldown',
  'event.blocked.trigger_not_met': 'Event conditions not met',
  'objective.locked.requires_prerequisite': 'Objective locked',
  'objective.completed.cumulative_progress': 'Objective completed',
  'objective.active.in_progress': 'Objective in progress',
  'contract.blocked.min_campaign_tick': 'Contract not yet available',
  'contract.blocked.not_accepted': 'Contract not accepted',
  'contract.blocked.progress_incomplete': 'Contract incomplete',
  'error.validation': 'Action blocked',
  'error.not_found': 'Not found',
  'error.conflict': 'Action conflict',
  'error.no_campaign': 'No campaign loaded',
  'error.mod_validation': 'Mod validation failed',
  'error.internal': 'Unexpected error',
  'error.unknown': 'Something went wrong'
}

function buildMessage(code: ExplanationCode, p: ExplanationTextParams): string {
  const sys = p.systemName ?? 'this system'
  const item = p.itemName ?? 'this item'

  switch (code) {
    case 'market.price.rising.shortage':
      if (p.stockpile != null && p.targetStockpile != null && p.targetStockpile > 0) {
        const pct = p.percentOfTarget ?? Math.round((p.stockpile / p.targetStockpile) * 100)
        return `${sys} ${item} stockpile is ${pct}% of target (${p.stockpile.toLocaleString()} / ${p.targetStockpile.toLocaleString()}). Regional shortage is pushing prices up.`
      }
      return `${sys} ${item} is in shortage — regional stockpiles are below target and prices are rising.`
    case 'market.price.rising.npc_demand':
      return `${sys} ${item} demand exceeds supply — NPC consumption is pushing prices up.`
    case 'market.price.falling.surplus':
      if (p.stockpile != null && p.targetStockpile != null && p.targetStockpile > 0) {
        return `${sys} ${item} stockpile is above target (${p.stockpile.toLocaleString()} / ${p.targetStockpile.toLocaleString()}). Surplus is easing prices.`
      }
      return `${sys} ${item} is in surplus — stockpiles above target are easing prices.`
    case 'market.price.falling.npc_supply':
      return `${sys} ${item} supply exceeds demand — NPC production is easing prices.`
    case 'market.price.stable':
      return `${sys} ${item} stockpiles are near target — prices held steady today.`
    case 'market.price.changed.trade':
      return `${sys} ${item} price shifted after matching orders on the market today.`
    case 'production.blocked.missing_inputs':
    case 'production.queued.waiting_for_inputs':
      return p.rawMessage ?? 'Not enough inputs in the building\'s system to start this job.'
    case 'production.idle.no_job':
      return p.buildingName
        ? `Your ${p.buildingName} has no running or queued jobs.`
        : 'This building has no running or queued jobs.'
    case 'logistics.in_transit.days_remaining':
      if (p.daysRemaining != null && p.totalDays != null && p.originName && p.destName) {
        return `In transit: ${p.daysRemaining}/${p.totalDays} days remaining (${p.originName} → ${p.destName}).`
      }
      return p.rawMessage ?? 'Shipment is still in transit.'
    case 'event.fired.trigger_match':
      return p.rawMessage ?? `${p.eventName ?? 'An event'} fired because its trigger conditions were met.`
    case 'event.blocked.min_campaign_tick':
      return `${p.eventName ?? 'This event'} unlocks from campaign day ${p.minCampaignTick ?? 0}.`
    case 'event.blocked.objective_gate':
      return `${p.eventName ?? 'This event'} requires completing "${p.prerequisiteTitle ?? 'a prerequisite objective'}" first.`
    case 'event.blocked.cooldown':
      if (p.nextEligibleTick != null && p.tick != null) {
        return `${p.eventName ?? 'This event'} is on cooldown — eligible again on day ${p.nextEligibleTick}.`
      }
      return `${p.eventName ?? 'This event'} is on cooldown and cannot fire again yet.`
    case 'event.blocked.trigger_not_met':
      return `${p.eventName ?? 'This event'} did not fire — its trigger conditions are not met today.`
    case 'objective.locked.requires_prerequisite':
      return p.prerequisiteTitle
        ? `Complete "${p.prerequisiteTitle}" to unlock this goal.`
        : 'Complete the prerequisite objective first.'
    case 'objective.completed.cumulative_progress':
      return p.rawMessage ?? 'Progress counted work you already completed before this goal unlocked.'
    case 'contract.blocked.min_campaign_tick':
      return `These contracts appear from campaign day ${p.minCampaignTick ?? 0}.`
    default:
      return p.rawMessage ?? TITLES[code]
  }
}

/** Build a player-facing Explanation from a code and template params. */
export function buildExplanation(
  code: ExplanationCode,
  params: ExplanationTextParams,
  extras?: Partial<Pick<Explanation, 'relatedSystemId' | 'relatedItemId' | 'relatedObjectiveId' | 'relatedContractId' | 'relatedEventId' | 'details' | 'severity'>>
): Explanation {
  const details: Record<string, string | number | boolean> = { ...extras?.details }
  if (params.stockpile != null) details.stockpile = params.stockpile
  if (params.targetStockpile != null) details.targetStockpile = params.targetStockpile
  if (params.percentOfTarget != null) details.percentOfTarget = params.percentOfTarget

  return {
    code,
    severity: extras?.severity ?? DEFAULT_SEVERITY[code],
    title: TITLES[code],
    message: buildMessage(code, params),
    relatedSystemId: extras?.relatedSystemId,
    relatedItemId: extras?.relatedItemId,
    relatedObjectiveId: extras?.relatedObjectiveId,
    relatedContractId: extras?.relatedContractId,
    relatedEventId: extras?.relatedEventId,
    ...(Object.keys(details).length > 0 ? { details } : {})
  }
}
