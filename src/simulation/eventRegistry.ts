import { newId } from '../shared/ids.js'
import type { EventEligibilityResult } from '../shared/explanations/types.js'
import { NPC_OWNER } from '../shared/types.js'
import type { EventDefinition, EventEffect, EventTrigger, GameState } from '../shared/types.js'
import { getPlayerCorporation } from './corporations.js'
import { totalAvailable } from './economyMath.js'

type TriggerHandler = (state: GameState, trigger: EventTrigger, tick: number) => boolean
type EffectHandler = (state: GameState, event: EventDefinition) => string

const TRIGGER_HANDLERS: Record<EventTrigger['type'], TriggerHandler> = {
  tickInterval: (_state, trigger, tick) =>
    trigger.type === 'tickInterval' && tick > 0 && tick % trigger.everyTicks === 0,
  lowStock: (state, trigger) =>
    trigger.type === 'lowStock' &&
    totalAvailable(state, getPlayerCorporation(state).id, trigger.itemId) < trigger.threshold,
  stockpileShortage: (state, trigger) =>
    trigger.type === 'stockpileShortage' &&
    state.localStockpiles.some((s) => s.itemId === trigger.itemId && s.quantity < trigger.threshold)
}

const EFFECT_HANDLERS: Record<EventEffect['type'], EffectHandler> = {
  priceShock: (state, event) => {
    if (event.effect.type !== 'priceShock') return event.name
    const { itemId, multiplier } = event.effect
    for (const order of state.orders) {
      if (order.ownerId === NPC_OWNER && order.itemId === itemId && order.side === 'sell') {
        order.price = Math.max(1, Math.round(order.price * multiplier))
      }
    }
    return `${event.name}: NPC prices for ${itemId} shifted x${multiplier}.`
  },
  message: (_state, event) => `${event.name}: ${event.description}`,
  stockpileShock: (state, event) => {
    if (event.effect.type !== 'stockpileShock') return event.name
    const { itemId, delta } = event.effect
    for (const row of state.localStockpiles) {
      if (row.itemId !== itemId) continue
      row.quantity = Math.max(0, row.quantity + delta)
    }
    return `${event.name}: regional ${itemId} stockpiles shifted by ${delta}.`
  },
  creditBonus: (state, event) => {
    if (event.effect.type !== 'creditBonus') return event.name
    const { amount } = event.effect
    const corp = getPlayerCorporation(state)
    corp.credits = Math.max(0, corp.credits + amount)
    const verb = amount >= 0 ? 'received' : 'paid'
    return `${event.name}: ${verb} ${Math.abs(amount).toLocaleString()} cr.`
  }
}

export function triggerFires(state: GameState, event: EventDefinition, tick: number): boolean {
  return TRIGGER_HANDLERS[event.trigger.type]?.(state, event.trigger, tick) ?? false
}

/**
 * Whether an event may be evaluated this tick (tick gate, objective gate, cooldown).
 * Read-only — does not sync or mutate objectives.
 */
export function eventEligible(state: GameState, event: EventDefinition, tick: number): boolean {
  if (tick < (event.minCampaignTick ?? 0)) return false

  const prereqId = event.requiresCompletedObjectiveId
  if (prereqId) {
    const entry = state.progression.objectives.find((o) => o.objectiveId === prereqId)
    if (!entry?.completed) return false
  }

  const cooldown = event.cooldownTicks
  if (cooldown != null && cooldown > 0) {
    const last = state.progression.eventLastFiredTick?.[event.id]
    if (last != null && tick - last < cooldown) return false
  }

  return true
}

/**
 * Read-only breakdown of event eligibility (same rules as eventEligible + trigger check).
 * Does not mutate state or sync objectives.
 */
export function explainEventEligibility(
  state: GameState,
  event: EventDefinition,
  tick: number
): EventEligibilityResult {
  if (tick < (event.minCampaignTick ?? 0)) {
    return {
      eligible: false,
      blockedBy: 'event.blocked.min_campaign_tick',
      details: { minCampaignTick: event.minCampaignTick ?? 0, tick }
    }
  }

  const prereqId = event.requiresCompletedObjectiveId
  if (prereqId) {
    const entry = state.progression.objectives.find((o) => o.objectiveId === prereqId)
    if (!entry?.completed) {
      return {
        eligible: false,
        blockedBy: 'event.blocked.objective_gate',
        details: { requiresObjectiveId: prereqId }
      }
    }
  }

  const cooldown = event.cooldownTicks
  if (cooldown != null && cooldown > 0) {
    const last = state.progression.eventLastFiredTick?.[event.id]
    if (last != null && tick - last < cooldown) {
      return {
        eligible: false,
        blockedBy: 'event.blocked.cooldown',
        details: { lastFiredTick: last, cooldownTicks: cooldown, nextEligibleTick: last + cooldown, tick }
      }
    }
  }

  if (!triggerFires(state, event, tick)) {
    return { eligible: false, blockedBy: 'event.blocked.trigger_not_met' }
  }

  return { eligible: true }
}

export function applyEventEffect(state: GameState, event: EventDefinition): string {
  return EFFECT_HANDLERS[event.effect.type]?.(state, event) ?? event.name
}

/** Evaluate and apply all events for the current tick. */
export function processEvents(state: GameState, tick: number): void {
  for (const event of state.definitions.events) {
    if (!eventEligible(state, event, tick)) continue
    if (!triggerFires(state, event, tick)) continue
    const message = applyEventEffect(state, event)
    state.eventsLog.push({ id: newId('evt'), tick, eventId: event.id, message })
    if (!state.progression.eventLastFiredTick) {
      state.progression.eventLastFiredTick = {}
    }
    state.progression.eventLastFiredTick[event.id] = tick
  }
}
