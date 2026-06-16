import React, { useMemo, useState } from 'react'
import { api } from '../api'
import { useApp } from '../App'
import { useCampaignAsync, useApiMutationWithArg } from '../hooks'
import { StatusBanner } from '../components/StatusBanner'
import { ExplanationLine } from '../components/ExplanationLine'
import { DataTable } from '../components/DataTable'
import type {
  ItemDefinition,
  ProductionJob,
  ProductionView,
  RecipeDefinition,
  RecipeIO,
  RepeatProductionJobArgs,
  RunProductionUntilExhaustedArgs,
  StartProductionJobArgs
} from '../../shared/types'

type JobRow = ProductionJob & { recipeName: string; buildingName: string; explanation?: import('../../shared/explanations/types').Explanation }

export function ProductionPage(): React.JSX.Element {
  const { refresh, token } = useApp()
  const prod = useCampaignAsync<ProductionView>(() => api.getProduction(), [token])
  const items = useCampaignAsync<ItemDefinition[]>(() => api.getItems(), [token])

  const reloadProduction = (): void => {
    prod.reload()
    refresh()
  }

  const startMut = useApiMutationWithArg(
    (args: StartProductionJobArgs) => api.startProductionJob(args),
    {
      successMessage: (args) => {
        const building = prod.data?.buildings.find((b) => b.id === args.buildingId)
        const recipe = building?.availableRecipes.find((r) => r.id === args.recipeId)
        return `Started ${recipe?.name ?? 'job'} ×${args.quantity}. Running jobs consume inputs now; queued jobs consume when they start.`
      },
      onSuccess: () => reloadProduction()
    }
  )

  const repeatMut = useApiMutationWithArg(
    (args: RepeatProductionJobArgs) => api.repeatProductionJob(args),
    {
      successMessage: (args) => `Queued repeat ×${args.quantity}.`,
      onSuccess: () => reloadProduction()
    }
  )

  const exhaustedMut = useApiMutationWithArg(
    (args: RunProductionUntilExhaustedArgs) => api.runProductionUntilExhausted(args),
    {
      successMessage: (_args, result) => `Queued ${result.queued} job(s) from available inputs.`,
      onSuccess: () => reloadProduction()
    }
  )

  const cancelMut = useApiMutationWithArg(
    (arg: { jobId: string; status: string }) => api.cancelProductionJob(arg.jobId),
    {
      successMessage: (arg) =>
        arg.status === 'queued'
          ? 'Queued job cancelled (no inputs lost).'
          : 'Running job cancelled. Inputs are not refunded.',
      onSuccess: () => reloadProduction()
    }
  )

  const [selected, setSelected] = useState<Record<string, string>>({})
  const [qty, setQty] = useState<Record<string, number>>({})

  const mutationError =
    startMut.error ?? repeatMut.error ?? exhaustedMut.error ?? cancelMut.error
  const mutationNotice =
    startMut.notice ?? repeatMut.notice ?? exhaustedMut.notice ?? cancelMut.notice

  const itemNames = useMemo(() => {
    const map: Record<string, string> = {}
    for (const it of items.data ?? []) map[it.id] = it.name
    return map
  }, [items.data])

  function ioLabel(io: RecipeIO): string {
    return `${io.quantity} ${itemNames[io.itemId] ?? io.itemId}`
  }

  function jobArgs(
    buildingId: string,
    recipes: RecipeDefinition[]
  ): { buildingId: string; recipeId: string; quantity: number } | null {
    const recipeId = selected[buildingId] ?? recipes[0]?.id
    if (!recipeId) return null
    return { buildingId, recipeId, quantity: qty[buildingId] ?? 1 }
  }

  async function start(buildingId: string, recipes: RecipeDefinition[]): Promise<void> {
    const args = jobArgs(buildingId, recipes)
    if (!args) return
    await startMut.run(args)
  }

  async function repeat(buildingId: string, recipes: RecipeDefinition[]): Promise<void> {
    const args = jobArgs(buildingId, recipes)
    if (!args) return
    await repeatMut.run(args)
  }

  async function runUntilExhausted(buildingId: string, recipes: RecipeDefinition[]): Promise<void> {
    const recipeId = selected[buildingId] ?? recipes[0]?.id
    if (!recipeId) return
    await exhaustedMut.run({ buildingId, recipeId })
  }

  const p = prod.data
  return (
    <div>
      <h2>Production</h2>
      <StatusBanner error={mutationError ?? prod.error} notice={mutationNotice} />

      <div className="panel">
        <h3>Buildings</h3>
        <DataTable
          rows={p?.buildings ?? []}
          rowKey={(b) => b.id}
          empty="No buildings. Construct some on a planet first."
          columns={[
            { key: 'name', header: 'Building', render: (b) => b.definitionName },
            { key: 'planet', header: 'Planet', render: (b) => b.planetName },
            {
              key: 'why',
              header: 'Status',
              render: (b) =>
                b.explanation ? <ExplanationLine explanation={b.explanation} /> : <span className="muted">—</span>
            },
            {
              key: 'recipe',
              header: 'Recipe',
              render: (b) => (
                <select
                  value={selected[b.id] ?? b.availableRecipes[0]?.id ?? ''}
                  onChange={(e) => setSelected((s) => ({ ...s, [b.id]: e.target.value }))}
                >
                  {b.availableRecipes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.duration}d)
                    </option>
                  ))}
                </select>
              )
            },
            {
              key: 'io',
              header: 'Inputs → Outputs',
              render: (b) => {
                const recipeId = selected[b.id] ?? b.availableRecipes[0]?.id
                const recipe = b.availableRecipes.find((r) => r.id === recipeId)
                if (!recipe) return <span className="muted">—</span>
                const inputs =
                  recipe.inputs.length > 0 ? recipe.inputs.map(ioLabel).join(' + ') : '(nothing)'
                const outputs = recipe.outputs.map(ioLabel).join(' + ')
                return (
                  <span className="io-flow">
                    {inputs}
                    <span className="arrow">→</span>
                    {outputs}
                  </span>
                )
              }
            },
            {
              key: 'qty',
              header: 'Runs',
              render: (b) => (
                <input
                  type="number"
                  min={1}
                  style={{ width: 60 }}
                  value={qty[b.id] ?? 1}
                  onChange={(e) =>
                    setQty((q) => ({ ...q, [b.id]: Math.max(1, Number(e.target.value)) }))
                  }
                />
              )
            },
            {
              key: 'act',
              header: '',
              render: (b) => (
                <span className="form-line">
                  <button
                    disabled={b.availableRecipes.length === 0}
                    onClick={() => void start(b.id, b.availableRecipes)}
                  >
                    Start
                  </button>
                  <button
                    disabled={b.availableRecipes.length === 0}
                    onClick={() => void repeat(b.id, b.availableRecipes)}
                  >
                    Repeat
                  </button>
                  <button
                    disabled={b.availableRecipes.length === 0}
                    onClick={() => void runUntilExhausted(b.id, b.availableRecipes)}
                  >
                    Run until exhausted
                  </button>
                </span>
              )
            }
          ]}
        />
        <p className="muted">
          One running job per building; extras queue. Inputs are consumed when a job starts running
          (not when queued). Cancelling a running job does not refund inputs.
        </p>
      </div>

      <div className="panel">
        <h3>Production Jobs</h3>
        <DataTable<JobRow>
          rows={p?.jobs.filter((j) => j.status === 'running' || j.status === 'queued') ?? []}
          rowKey={(j) => j.id}
          empty="No active jobs."
          columns={[
            { key: 'building', header: 'Building', render: (j) => j.buildingName },
            { key: 'recipe', header: 'Recipe', render: (j) => j.recipeName },
            { key: 'runs', header: 'Runs', numeric: true, render: (j) => j.quantity },
            {
              key: 'prog',
              header: 'Progress',
              numeric: true,
              render: (j) => (j.status === 'queued' ? '—' : `${j.progress}/${j.duration}`)
            },
            {
              key: 'status',
              header: 'Status',
              render: (j) => (
                <span>
                  <span className={`tag ${statusClass(j.status)}`}>{j.status}</span>
                  {j.explanation && <ExplanationLine explanation={j.explanation} />}
                </span>
              )
            },
            {
              key: 'cancel',
              header: '',
              render: (j) =>
                j.status === 'running' || j.status === 'queued' ? (
                  <button onClick={() => void cancelMut.run({ jobId: j.id, status: j.status })}>
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

function statusClass(status: string): string {
  if (status === 'completed') return 'green'
  if (status === 'running') return 'yellow'
  if (status === 'queued') return ''
  return ''
}
