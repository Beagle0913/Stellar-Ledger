import { formatPriceChange, formatPriceReason } from '../shared/economyDiagnostics.js'
import { createLogEntry } from '../shared/gameLog.js'
import type { GameLogEntry, GameState, MarketChangeEntry } from '../shared/types.js'
import { itemLabel } from './economyMath.js'
import type { Trade } from './market.js'
import type { RegionalTrade } from './npcRegionalTrade.js'
import type { PopulationChange } from './populationDynamics.js'
import type { ProductionJob, TransportJob } from '../shared/types.js'
import type { EventLogEntry } from '../shared/types.js'

export interface TickLogContext {
  trades: Trade[]
  regionalTrades: RegionalTrade[]
  completedProduction: ProductionJob[]
  completedTransport: TransportJob[]
  populationChanges: PopulationChange[]
  newEvents: EventLogEntry[]
  marketChanges: MarketChangeEntry[]
}

function systemName(state: GameState, systemId: string): string {
  return state.definitions.systems.find((s) => s.id === systemId)?.name ?? systemId
}

function recipeName(state: GameState, recipeId: string): string {
  return state.definitions.recipes.find((r) => r.id === recipeId)?.name ?? recipeId
}

/** Build human-readable log lines for everything that happened on one tick. */
export function buildTickLog(state: GameState, tick: number, ctx: TickLogContext): GameLogEntry[] {
  const entries: GameLogEntry[] = []

  entries.push(
    createLogEntry(
      tick,
      'tick',
      `Day ${tick} begins — ${ctx.trades.length} market trade(s), ${ctx.regionalTrades.length} NPC convoy(s), ${ctx.newEvents.length} event(s).`
    )
  )

  for (const job of ctx.completedProduction) {
    const recipe = state.definitions.recipes.find((r) => r.id === job.recipeId)
    const outputs =
      recipe?.outputs
        .map((o) => `${o.quantity * job.quantity} ${itemLabel(state, o.itemId)}`)
        .join(', ') ?? job.recipeId
    entries.push(
      createLogEntry(
        tick,
        'production',
        `Completed ${recipeName(state, job.recipeId)} ×${job.quantity} → ${outputs}.`
      )
    )
  }

  for (const job of ctx.completedTransport) {
    const dest = systemName(state, job.destinationSystemId)
    const origin = systemName(state, job.originSystemId)
    entries.push(
      createLogEntry(
        tick,
        'transport',
        `Delivered ${job.quantity} ${itemLabel(state, job.itemId)} from ${origin} to ${dest} (fuel ${job.fuelCost}).`
      )
    )
  }

  for (const rt of ctx.regionalTrades) {
    const from = systemName(state, rt.fromSystemId)
    const to = systemName(state, rt.toSystemId)
    entries.push(
      createLogEntry(
        tick,
        'regional',
        `NPC convoy: ${rt.quantity} ${itemLabel(state, rt.itemId)} ${from} → ${to}.`
      )
    )
  }

  for (const trade of ctx.trades) {
    if (!trade.playerSide) continue
    const market = state.markets.find((m) => m.id === trade.marketId)
    const sys = market ? systemName(state, market.systemId) : trade.marketId
    const verb = trade.playerSide === 'buy' ? 'Bought' : 'Sold'
    entries.push(
      createLogEntry(
        tick,
        'trade',
        `${verb} ${trade.quantity} ${itemLabel(state, trade.itemId)} in ${sys} @ ${trade.price} cr (${trade.quantity * trade.price} cr total).`
      )
    )
  }

  for (const change of ctx.populationChanges) {
    const delta = change.after - change.before
    const sign = delta > 0 ? '+' : ''
    entries.push(
      createLogEntry(
        tick,
        'population',
        `${change.planetName}: population ${sign}${delta} (${change.before.toLocaleString()} → ${change.after.toLocaleString()}).`
      )
    )
  }

  for (const change of ctx.marketChanges) {
    const reason = formatPriceReason(change.reason) ?? change.reason
    const move = formatPriceChange(change.priceChange, change.priceChangePercent)
    entries.push(
      createLogEntry(
        tick,
        'economy',
        `${change.systemName} — ${change.itemName}: ${change.price} cr (${move}, ${reason}).`
      )
    )
  }

  for (const evt of ctx.newEvents) {
    entries.push(createLogEntry(tick, 'event', evt.message))
  }

  if (
    ctx.completedProduction.length === 0 &&
    ctx.completedTransport.length === 0 &&
    ctx.regionalTrades.length === 0 &&
    ctx.trades.filter((t) => t.playerSide).length === 0 &&
    ctx.populationChanges.length === 0 &&
    ctx.marketChanges.length === 0 &&
    ctx.newEvents.length === 0
  ) {
    entries.push(createLogEntry(tick, 'tick', 'Quiet day — no notable activity.'))
  }

  return entries
}
