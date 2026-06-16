import type {
  CreateMarketOrderArgs,
  GameState,
  MarketTradePreview,
  PreviewMarketTradeArgs
} from '../../shared/types.js'
import { cancelOrder, createMarketOrder } from '../../simulation/market.js'
import { executeMarketTrade, previewMarketTrade } from '../../simulation/marketTrade.js'
import { logPlayerAction } from '../actionLog.js'
import type { CampaignSession } from '../campaignSession.js'

export function cmdCreateMarketOrder(
  session: CampaignSession,
  state: GameState,
  args: CreateMarketOrderArgs
): true {
  createMarketOrder(state, { ...args, tick: state.meta.tick })
  const item = state.definitions.items.find((i) => i.id === args.itemId)?.name ?? args.itemId
  const sys = state.definitions.systems.find((s) => s.id === args.systemId)?.name ?? args.systemId
  logPlayerAction(
    state,
    'market',
    `Placed ${args.side} order: ${args.quantity} ${item} @ ${args.price} cr in ${sys}.`
  )
  session.persistAfterMutation()
  return true
}

export function cmdCancelMarketOrder(
  session: CampaignSession,
  state: GameState,
  orderId: string
): true {
  const order = state.orders.find((o) => o.id === orderId)
  cancelOrder(state, orderId)
  if (order) {
    const item = state.definitions.items.find((i) => i.id === order.itemId)?.name ?? order.itemId
    logPlayerAction(state, 'market', `Cancelled ${order.side} order for ${item} (${orderId}).`)
  }
  session.persistAfterMutation()
  return true
}

export function cmdPreviewMarketTrade(state: GameState, args: PreviewMarketTradeArgs): MarketTradePreview {
  return previewMarketTrade(state, args)
}

export function cmdExecuteMarketTrade(
  session: CampaignSession,
  state: GameState,
  args: PreviewMarketTradeArgs
): MarketTradePreview {
  const preview = executeMarketTrade(state, args)
  const item = state.definitions.items.find((i) => i.id === args.itemId)?.name ?? args.itemId
  const sys = state.definitions.systems.find((s) => s.id === args.systemId)?.name ?? args.systemId
  const verb =
    args.action === 'buy_amount' ? 'Bought' : args.action === 'sell_max' ? 'Sold (max)' : 'Sold'
  const proceeds =
    preview.estimatedRevenue ?? preview.estimatedCost ?? preview.quantity * preview.averagePrice
  logPlayerAction(
    state,
    'market',
    `${verb} ${preview.quantity} ${item} in ${sys} for ${proceeds.toLocaleString()} cr.`
  )
  session.persistAfterMutation()
  return preview
}
