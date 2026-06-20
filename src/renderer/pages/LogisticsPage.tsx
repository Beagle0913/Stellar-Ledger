import React, { useEffect, useState } from 'react'
import { api } from '../api'
import { useApp } from '../App'
import { useCampaignAsync, useApiMutation, useApiMutationWithArg } from '../hooks'
import { StatusBanner } from '../components/StatusBanner'
import { SystemPicker } from '../components/SystemPicker'
import { ExplanationLine } from '../components/ExplanationLine'
import { DataTable } from '../components/DataTable'
import type { LogisticsView, PurchasableShipView, Ship, SystemSummary, TransportJob } from '../../shared/types'

type JobRow = TransportJob & { itemName: string; explanation?: import('../../shared/explanations/types').Explanation }

export function LogisticsPage(): React.JSX.Element {
  const { refresh, token } = useApp()
  const log = useCampaignAsync<LogisticsView>(() => api.getLogistics(), [token])
  const systems = useCampaignAsync<SystemSummary[]>(() => api.getSystems(), [token])

  const reloadAll = () => {
    log.reload()
    refresh()
  }

  const submitMut = useApiMutation(
    () => api.createTransportJob({ shipId, destinationSystemId, itemId, quantity }),
    { onSuccess: reloadAll }
  )
  const cancelMut = useApiMutationWithArg((jobId: string) => api.cancelTransportJob(jobId), {
    onSuccess: reloadAll
  })
  const buyShipMut = useApiMutation(
    () => api.purchaseShip({ shipDefinitionId: buyTypeId }),
    { onSuccess: reloadAll }
  )

  const [shipId, setShipId] = useState('')
  const [destinationSystemId, setDestination] = useState('')
  const [itemId, setItemId] = useState('ore')
  const [quantity, setQuantity] = useState(10)
  const [buyTypeId, setBuyTypeId] = useState('')
  const mutationError = submitMut.error ?? cancelMut.error ?? buyShipMut.error

  useEffect(() => {
    if (!shipId && log.data && log.data.ships.length > 0) setShipId(log.data.ships[0]!.id)
  }, [log.data, shipId])
  useEffect(() => {
    if (!destinationSystemId && systems.data && systems.data.length > 1) {
      setDestination(systems.data[1]!.id)
    }
  }, [systems.data, destinationSystemId])
  useEffect(() => {
    if (!buyTypeId && log.data && log.data.purchasableShips.length > 0) {
      setBuyTypeId(log.data.purchasableShips[1]?.id ?? log.data.purchasableShips[0]!.id)
    }
  }, [log.data, buyTypeId])

  async function submit(): Promise<void> {
    await submitMut.run()
  }

  async function cancel(jobId: string): Promise<void> {
    await cancelMut.run(jobId)
  }

  async function buyShip(): Promise<void> {
    if (!buyTypeId) return
    await buyShipMut.run()
  }

  const l = log.data
  return (
    <div>
      <h2>Logistics</h2>
      <StatusBanner error={mutationError} notice={submitMut.notice ?? buyShipMut.notice} />

      <div className="panel">
        <h3>Your Fleet</h3>
        <DataTable<Ship>
          rows={l?.ships ?? []}
          rowKey={(s) => s.id}
          empty="No ships."
          columns={[
            { key: 'name', header: 'Ship', render: (s) => s.name },
            { key: 'loc', header: 'Location', render: (s) => s.currentSystemId },
            { key: 'cap', header: 'Cargo', numeric: true, render: (s) => s.cargoCapacity },
            { key: 'speed', header: 'Speed', numeric: true, render: (s) => s.speed },
            { key: 'fuel', header: 'Fuel/Dist', numeric: true, render: (s) => s.fuelUsePerDistance }
          ]}
        />
      </div>

      <div className="panel">
        <h3>Purchase Ship</h3>
        <div className="form-line">
          <label>Type</label>
          <select value={buyTypeId} onChange={(e) => setBuyTypeId(e.target.value)}>
            {(l?.purchasableShips ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {s.purchaseCost.toLocaleString()} cr
              </option>
            ))}
          </select>
          <button className="primary" onClick={() => void buyShip()}>
            Buy
          </button>
        </div>
        <DataTable<PurchasableShipView>
          rows={l?.purchasableShips ?? []}
          rowKey={(s) => s.id}
          empty="No ship types in this campaign."
          columns={[
            { key: 'name', header: 'Type', render: (s) => s.name },
            { key: 'cost', header: 'Cost', numeric: true, render: (s) => s.purchaseCost },
            { key: 'cap', header: 'Cargo', numeric: true, render: (s) => s.cargoCapacity },
            { key: 'speed', header: 'Speed', numeric: true, render: (s) => s.speed },
            {
              key: 'afford',
              header: 'Affordable',
              render: (s) => (
                <span className={`tag ${s.affordable ? 'green' : 'red'}`}>
                  {s.affordable ? 'yes' : 'no'}
                </span>
              )
            }
          ]}
        />
      </div>

      <div className="panel">
        <h3>Create Transport Job</h3>
        <div className="form-line">
          <label>Ship</label>
          <select value={shipId} onChange={(e) => setShipId(e.target.value)}>
            {(l?.ships ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} @ {s.currentSystemId}
              </option>
            ))}
          </select>
        </div>
        <SystemPicker
          systems={systems.data ?? []}
          value={destinationSystemId || null}
          onChange={setDestination}
          id="logistics-destination"
          label="Destination"
        />
        <div className="form-line">
          <label>Item</label>
          <input value={itemId} style={{ width: 120 }} onChange={(e) => setItemId(e.target.value)} />
          <label>Qty</label>
          <input
            type="number"
            min={1}
            style={{ width: 70 }}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
          />
          <button className="primary" onClick={() => void submit()}>
            Dispatch
          </button>
        </div>
        <p className="muted">
          Cargo is reserved and fuel is consumed at the origin on dispatch; goods arrive after enough
          ticks to cover the distance at the ship&apos;s speed. Each ship can run one job at a time.
        </p>
      </div>

      <div className="panel">
        <h3>Transport Jobs</h3>
        <DataTable<JobRow>
          rows={l?.jobs ?? []}
          rowKey={(j) => j.id}
          empty="No transport jobs."
          columns={[
            { key: 'ship', header: 'Ship', render: (j) => j.shipId },
            { key: 'item', header: 'Item', render: (j) => j.itemName },
            { key: 'qty', header: 'Qty', numeric: true, render: (j) => j.quantity },
            { key: 'route', header: 'Route', render: (j) => `${j.originSystemId} → ${j.destinationSystemId}` },
            { key: 'prog', header: 'Progress', numeric: true, render: (j) => `${j.progress}/${j.distance}` },
            { key: 'fuel', header: 'Fuel', numeric: true, render: (j) => j.fuelCost },
            { key: 'status', header: 'Status', render: (j) => (
              <span>
                <span className="tag">{j.status}</span>
                {j.explanation && <ExplanationLine explanation={j.explanation} />}
              </span>
            ) },
            {
              key: 'cancel',
              header: '',
              render: (j) =>
                j.status === 'running' ? (
                  <button title="Releases the cargo at origin; fuel is not refunded" onClick={() => void cancel(j.id)}>
                    Cancel
                  </button>
                ) : null
            }
          ]}
        />
      </div>
    </div>
  )
}
