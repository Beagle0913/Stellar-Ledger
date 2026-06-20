import React from 'react'
import type { MarketItemView, OrderSide } from '../../shared/types'

export interface MarketOrderFormProps {
  side: OrderSide
  itemId: string
  quantity: number
  price: number
  items: MarketItemView[]
  pending: boolean
  onSideChange: (side: OrderSide) => void
  onItemChange: (itemId: string) => void
  onQuantityChange: (quantity: number) => void
  onPriceChange: (price: number) => void
  onSubmit: () => void
  hint?: React.ReactNode
}

/** Limit order form used on the Market page. */
export function MarketOrderForm({
  side,
  itemId,
  quantity,
  price,
  items,
  pending,
  onSideChange,
  onItemChange,
  onQuantityChange,
  onPriceChange,
  onSubmit,
  hint
}: MarketOrderFormProps): React.JSX.Element {
  return (
    <div className="panel">
      <h3>Place Order</h3>
      <div className="form-line">
        <select value={side} onChange={(e) => onSideChange(e.target.value as OrderSide)}>
          <option value="sell">Sell</option>
          <option value="buy">Buy</option>
        </select>
        <select value={itemId} onChange={(e) => onItemChange(e.target.value)}>
          {items.map((it) => (
            <option key={it.itemId} value={it.itemId}>
              {it.itemName}
            </option>
          ))}
        </select>
        <label>Qty</label>
        <input
          type="number"
          min={1}
          value={quantity}
          style={{ width: 80 }}
          onChange={(e) => onQuantityChange(Math.max(1, Number(e.target.value)))}
        />
        <label>Price</label>
        <input
          type="number"
          min={1}
          value={price}
          style={{ width: 80 }}
          onChange={(e) => onPriceChange(Math.max(1, Number(e.target.value)))}
        />
        <button className="primary" disabled={pending || !itemId} onClick={onSubmit}>
          Submit Order
        </button>
      </div>
      {hint}
    </div>
  )
}
