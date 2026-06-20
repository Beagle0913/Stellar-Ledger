import React, { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { useApp } from '../App'
import { useCampaignAsync, useApiMutationWithArg } from '../hooks'
import { DataTable } from '../components/DataTable'
import { LinkButton } from '../components/LinkButton'
import { MarketEconomyGuide, PriceDiagnosticsPanel } from '../components/PriceDiagnosticsPanel'
import { PriceChart } from '../components/PriceChart'
import { MarketOrderForm } from '../components/MarketOrderForm'
import { StatusBanner } from '../components/StatusBanner'
import { SystemPicker } from '../components/SystemPicker'
import {
  formatPriceChange,
  formatTrendLabel,
  trendTagClass
} from '../../shared/economyDiagnostics'
import type {
  CreateMarketOrderArgs,
  InventoryView,
  MarketItemView,
  MarketOrderView,
  MarketTradePreview,
  MarketView,
  OrderSide,
  PreviewMarketTradeArgs,
  PricePoint,
  SystemSummary
} from '../../shared/types'

export function MarketPage(): React.JSX.Element {
  const { selectedSystemId, refresh, token } = useApp()
  const systems = useCampaignAsync<SystemSummary[]>(() => api.getSystems(), [token])
  const [systemId, setSystemId] = useState<string | null>(selectedSystemId)

  useEffect(() => {
    if (selectedSystemId) setSystemId(selectedSystemId)
  }, [selectedSystemId])

  useEffect(() => {
    if (!systemId && systems.data && systems.data.length > 0) {
      setSystemId(selectedSystemId ?? systems.data[0]!.id)
    }
  }, [systems.data, selectedSystemId, systemId])

  const market = useCampaignAsync<MarketView | null>(
    () => (systemId ? api.getMarket(systemId) : Promise.resolve(null)),
    [systemId, token]
  )
  const inventory = useCampaignAsync<InventoryView[]>(() => api.getInventory(), [token])

  const [side, setSide] = useState<OrderSide>('sell')
  const [itemId, setItemId] = useState('')
  const [quantity, setQuantity] = useState(10)
  const [price, setPrice] = useState(10)
  const [tradePreview, setTradePreview] = useState<MarketTradePreview | null>(null)
  const [pendingTrade, setPendingTrade] = useState<PreviewMarketTradeArgs | null>(null)

  const m = market.data
  const selectedItem = m?.items.find((it) => it.itemId === itemId) ?? null

  useEffect(() => {
    if (!itemId && m && m.items.length > 0) setItemId(m.items[0]!.itemId)
  }, [m, itemId])

  const priceSeedKey = `${systemId ?? ''}:${itemId}:${side}`
  const lastPriceSeed = useRef('')

  useEffect(() => {
    if (!m || !itemId) return
    if (lastPriceSeed.current === priceSeedKey) return
    lastPriceSeed.current = priceSeedKey
    const item = m.items.find((it) => it.itemId === itemId)
    if (!item) return
    const best =
      side === 'sell'
        ? item.buyOrders[0]?.price ?? item.lastPrice
        : item.sellOrders[0]?.price ?? item.lastPrice
    if (best && best > 0) setPrice(best)
  }, [m, itemId, side, systemId, priceSeedKey])

  const history = useCampaignAsync<PricePoint[]>(
    () =>
      systemId && itemId
        ? api.getPriceHistory({ systemId, itemId })
        : Promise.resolve([] as PricePoint[]),
    [systemId, itemId, token]
  )

  const reloadMarketData = (): void => {
    market.reload()
    inventory.reload()
    history.reload()
    refresh()
  }

  const cancelOrderMut = useApiMutationWithArg((orderId: string) => api.cancelMarketOrder(orderId), {
    successMessage: 'Order cancelled. Escrowed credits / reserved inventory released.',
    onSuccess: () => reloadMarketData()
  })

  const createOrderMut = useApiMutationWithArg(
    (args: CreateMarketOrderArgs) => api.createMarketOrder(args),
    {
      successMessage: (args) =>
        `${args.side === 'sell' ? 'Sell' : 'Buy'} order placed: ${args.quantity} @ ${args.price} cr. It matches on the next tick.`,
      onSuccess: () => reloadMarketData()
    }
  )

  const previewTradeMut = useApiMutationWithArg(
    (args: PreviewMarketTradeArgs) => api.previewMarketTrade(args),
    {
      onSuccess: (preview, args) => {
        setTradePreview(preview)
        setPendingTrade(args)
      }
    }
  )

  const executeTradeMut = useApiMutationWithArg(
    (args: PreviewMarketTradeArgs) => api.executeMarketTrade(args),
    {
      successMessage: (_args, preview) =>
        `Trade executed: ${preview.quantity} ${preview.itemName} in ${preview.systemName}.`,
      onSuccess: () => {
        setTradePreview(null)
        setPendingTrade(null)
        reloadMarketData()
      }
    }
  )

  const itemDiagnostics = selectedItem?.diagnostics ?? null
  const holdingHere = inventory.data?.find((r) => r.systemId === systemId && r.itemId === itemId)
  const availableHere = holdingHere ? holdingHere.quantity - holdingHere.reserved : 0
  const orderCost = quantity * price

  const ownOrders: MarketOrderView[] = (m?.items ?? [])
    .flatMap((it) => [...it.buyOrders, ...it.sellOrders])
    .filter((o) => o.ownerId !== 'npc')

  const mutationNotice =
    cancelOrderMut.notice ??
    createOrderMut.notice ??
    previewTradeMut.notice ??
    executeTradeMut.notice

  const mutationError =
    cancelOrderMut.error ??
    createOrderMut.error ??
    previewTradeMut.error ??
    executeTradeMut.error

  async function submit(): Promise<void> {
    if (!systemId || !itemId) return
    await createOrderMut.run({ systemId, itemId, side, quantity, price })
  }

  async function previewQuickTrade(args: PreviewMarketTradeArgs): Promise<void> {
    if (!systemId || !itemId) return
    setTradePreview(null)
    setPendingTrade(null)
    await previewTradeMut.run(args)
  }

  async function confirmQuickTrade(): Promise<void> {
    if (!pendingTrade) return
    await executeTradeMut.run(pendingTrade)
  }

  function cancelQuickTrade(): void {
    setTradePreview(null)
    setPendingTrade(null)
  }

  return (
    <div>
      <h2>Market</h2>
      <StatusBanner
        error={mutationError ?? market.error ?? systems.error ?? inventory.error ?? history.error}
        notice={mutationNotice}
        loading={market.loading && !m}
      />

      <div className="panel">
        <SystemPicker
          systems={systems.data ?? []}
          value={systemId}
          onChange={setSystemId}
          id="market-system-select"
          homeSystemId={selectedSystemId}
        />
      </div>

      <div className="panel">
        <h3>Quick Market</h3>
        <div className="form-line">
          <button
            disabled={!systemId || !itemId || availableHere <= 0}
            onClick={() =>
              void previewQuickTrade({ systemId: systemId!, itemId, action: 'sell_max' })
            }
          >
            Sell max at best bid
          </button>
          <button
            disabled={!systemId || !itemId || availableHere <= 0}
            onClick={() =>
              void previewQuickTrade({
                systemId: systemId!,
                itemId,
                action: 'sell_amount',
                quantity
              })
            }
          >
            Sell selected qty at bid
          </button>
          <button
            disabled={!systemId || !itemId}
            onClick={() =>
              void previewQuickTrade({
                systemId: systemId!,
                itemId,
                action: 'buy_amount',
                quantity
              })
            }
          >
            Buy qty at best ask
          </button>
        </div>
        {tradePreview && (
          <div className="panel" style={{ marginTop: 12, background: 'var(--panel-alt, rgba(0,0,0,0.15))' }}>
            <pre className="trade-preview" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
              {formatTradePreview(tradePreview)}
            </pre>
            <div className="form-line" style={{ marginTop: 8 }}>
              <button className="primary" onClick={() => void confirmQuickTrade()}>
                Confirm trade
              </button>
              <button onClick={cancelQuickTrade}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      <MarketOrderForm
        side={side}
        itemId={itemId}
        quantity={quantity}
        price={price}
        items={m?.items ?? []}
        pending={createOrderMut.pending}
        onSideChange={setSide}
        onItemChange={setItemId}
        onQuantityChange={setQuantity}
        onPriceChange={setPrice}
        onSubmit={() => void submit()}
        hint={
          <p className="hint">
            {side === 'sell' ? (
              <>
                You have <span className="pos">{availableHere}</span> {selectedItem?.itemName ?? ''}{' '}
                available here. Best bid:{' '}
                <span className="mono">
                  {selectedItem?.buyOrders[0] ? `${selectedItem.buyOrders[0].price} cr` : '—'}
                </span>
                .
              </>
            ) : (
              <>
                This order escrows <span className="mono">{orderCost.toLocaleString()} cr</span>. Best
                ask:{' '}
                <span className="mono">
                  {selectedItem?.sellOrders[0] ? `${selectedItem.sellOrders[0].price} cr` : '—'}
                </span>
                .
              </>
            )}
          </p>
        }
      />

      <MarketEconomyGuide />

      {itemDiagnostics && (
        <div className="panel">
          <h3>Price movement — {selectedItem?.itemName ?? '—'}</h3>
          <PriceDiagnosticsPanel
            itemName={selectedItem?.itemName ?? 'item'}
            diagnostics={itemDiagnostics}
            explanation={selectedItem?.explanation}
          />
        </div>
      )}

      <div className="panel">
        <div className="panel-head">
          <h3>Price History — {selectedItem?.itemName ?? '—'}</h3>
        </div>
        {(history.data ?? []).length > 0 ? (
          <PriceChart points={history.data ?? []} loading={history.loading} />
        ) : (
          <p className="muted">No recorded prices yet for this item in this system.</p>
        )}
      </div>

      <div className="panel">
        <h3>Your Open Orders</h3>
        <DataTable<MarketOrderView>
          rows={ownOrders}
          rowKey={(o) => o.id}
          empty="No open orders in this market."
          columns={[
            { key: 'item', header: 'Item', render: (o) => o.itemName },
            { key: 'side', header: 'Side', render: (o) => <span className="tag">{o.side}</span> },
            {
              key: 'qty',
              header: 'Remaining',
              numeric: true,
              render: (o) => `${o.remainingQuantity}/${o.quantity}`
            },
            { key: 'price', header: 'Price', numeric: true, render: (o) => `${o.price} cr` },
            {
              key: 'cancel',
              header: '',
              render: (o) => <button onClick={() => void cancelOrderMut.run(o.id)}>Cancel</button>
            }
          ]}
        />
      </div>

      <div className="panel">
        <h3>Order Book — {m?.systemName}</h3>
        <DataTable<MarketItemView>
          rows={m?.items ?? []}
          rowKey={(it) => it.itemId}
          columns={[
            {
              key: 'item',
              header: 'Item',
              render: (it) => (
                <LinkButton onClick={() => setItemId(it.itemId)} title="Select for the order form">
                  {it.itemName}
                </LinkButton>
              )
            },
            {
              key: 'last',
              header: 'Price',
              numeric: true,
              render: (it) =>
                it.diagnostics.currentPrice === null ? '—' : `${it.diagnostics.currentPrice} cr`
            },
            {
              key: 'chg',
              header: 'Change',
              numeric: true,
              render: (it) =>
                formatPriceChange(it.diagnostics.priceChange, it.diagnostics.priceChangePercent)
            },
            {
              key: 'trend',
              header: 'Trend',
              render: (it) => (
                <span className={trendTagClass(it.diagnostics.trend)}>
                  {formatTrendLabel(it.diagnostics.trend)}
                </span>
              )
            },
            {
              key: 'reason',
              header: 'Reason',
              render: (it) => it.diagnostics.latestReasonLabel ?? '—'
            },
            {
              key: 'stock',
              header: 'NPC stock',
              numeric: true,
              render: (it) =>
                it.diagnostics.npcStockpile === null ? '—' : it.diagnostics.npcStockpile
            },
            {
              key: 'bid',
              header: 'Best Bid',
              numeric: true,
              render: (it) => (it.buyOrders[0] ? `${it.buyOrders[0].price} cr` : '—')
            },
            {
              key: 'ask',
              header: 'Best Ask',
              numeric: true,
              render: (it) => (it.sellOrders[0] ? `${it.sellOrders[0].price} cr` : '—')
            },
            {
              key: 'depth',
              header: 'Orders (B/S)',
              numeric: true,
              render: (it) => `${it.buyOrders.length} / ${it.sellOrders.length}`
            }
          ]}
        />
      </div>
    </div>
  )
}

function formatTradePreview(p: MarketTradePreview): string {
  const lines = [
    `${p.action === 'buy_amount' ? 'Buy' : 'Sell'} ${p.quantity} ${p.itemName} in ${p.systemName}`
  ]
  if (p.estimatedRevenue != null) {
    lines.push(`Estimated revenue: ${Math.round(p.estimatedRevenue).toLocaleString()} cr`)
  }
  if (p.estimatedCost != null) {
    lines.push(`Estimated cost: ${Math.round(p.estimatedCost).toLocaleString()} cr`)
  }
  lines.push(`Average price: ${p.averagePrice.toFixed(1)} cr`)
  lines.push(`Filled from ${p.fillCount} ${p.action === 'buy_amount' ? 'sell' : 'buy'} orders`)
  return lines.join('\n')
}
