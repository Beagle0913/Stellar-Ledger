import type {
  ActiveContract,
  ContractTemplateDefinition,
  ContractTemplateTier,
  ContractTemplateType,
  GameState,
  ObjectiveDefinition,
  ObjectiveProgressEntry,
  ObjectiveType
} from '../shared/types.js'
import { getPlayerCorporation } from './corporations.js'
import { estimateInventoryValue } from './economyMath.js'
import { resolveItemName, resolveSystemName } from './resolveNames.js'

export type ContractBuildContext = {
  template: ContractTemplateDefinition
  tier: ContractTemplateTier
  state: GameState
  seed: number
  pickSystemId: (state: GameState, seed: number) => string
  pickInt: (min: number, max: number, seed: number) => number
}

export type ContractBuildResult = {
  title: string
  description: string
  params: ActiveContract['params']
}

type ContractBuilder = (ctx: ContractBuildContext) => ContractBuildResult
type ContractProgressFn = (state: GameState, contract: ActiveContract) => number

const CONTRACT_BUILDERS: Record<ContractTemplateType, ContractBuilder> = {
  deliver_item: ({ template, tier, state, seed, pickSystemId, pickInt }) => {
    const name = tier.itemId ? resolveItemName(state, tier.itemId) : undefined
    const system = pickSystemId(state, seed)
    const qty = pickInt(tier.quantityMin ?? 1, tier.quantityMax ?? 1, seed)
    const dest = resolveSystemName(state, system)
    return {
      title: `Deliver ${qty} ${name ?? 'goods'} to ${dest}`,
      description: `${template.description} Destination: ${dest}.`,
      params: { itemId: tier.itemId, quantity: qty, systemId: system, target: qty }
    }
  },
  produce_item: ({ template, tier, state, seed, pickInt }) => {
    const name = tier.itemId ? resolveItemName(state, tier.itemId) : undefined
    const qty = pickInt(tier.quantityMin ?? 1, tier.quantityMax ?? 1, seed + 1)
    return {
      title: `Produce ${qty} ${name ?? 'goods'}`,
      description: `${template.description} Deliverables count when produced.`,
      params: { itemId: tier.itemId, quantity: qty, target: qty }
    }
  },
  sell_in_faction: ({ template, tier, state, seed, pickSystemId, pickInt }) => {
    const name = tier.itemId ? resolveItemName(state, tier.itemId) : undefined
    const qty = pickInt(tier.quantityMin ?? 1, tier.quantityMax ?? 1, seed + 2)
    const factionSystems = state.definitions.systems.filter(
      (s) => s.controllingFactionId === template.factionId
    )
    const regionSystem =
      factionSystems[seed % Math.max(1, factionSystems.length)]?.id ?? pickSystemId(state, seed)
    const regionName = resolveSystemName(state, regionSystem)
    return {
      title: `Sell ${qty} ${name ?? 'goods'} in ${regionName}`,
      description: `${template.description} Sales must occur in ${regionName}.`,
      params: {
        itemId: tier.itemId,
        quantity: qty,
        systemId: regionSystem,
        factionId: template.factionId,
        target: qty
      }
    }
  },
  own_asset: ({ template, tier, state }) => {
    const shipDef = state.definitions.ships.find((s) => s.id === tier.shipDefinitionId)
    return {
      title: `Acquire ${shipDef?.name ?? 'a ship'}`,
      description: template.description,
      params: { shipDefinitionId: tier.shipDefinitionId, target: 1 }
    }
  },
  reach_net_worth: ({ template, tier, seed, pickInt }) => {
    const target = pickInt(tier.netWorthMin ?? 100_000, tier.netWorthMax ?? 100_000, seed + 3)
    return {
      title: `Reach ${target.toLocaleString()} cr net worth`,
      description: template.description,
      params: { netWorthTarget: target, target }
    }
  }
}

const CONTRACT_PROGRESS: Record<ContractTemplateType, ContractProgressFn> = {
  deliver_item: (state, contract) => {
    const corp = getPlayerCorporation(state)
    const corpId = corp.id
    const qty =
      state.inventories.find(
        (r) =>
          r.ownerId === corpId &&
          r.systemId === contract.params.systemId &&
          r.itemId === contract.params.itemId
      )?.quantity ?? 0
    return Math.min(contract.target, qty)
  },
  produce_item: (state, contract) => {
    const baseline = contract.params.baselineProduced ?? 0
    const total = state.progression.producedItems[contract.params.itemId ?? ''] ?? 0
    return Math.min(contract.target, Math.max(0, total - baseline))
  },
  sell_in_faction: (_state, contract) => Math.min(contract.target, contract.progress),
  own_asset: (state, contract) => {
    const corp = getPlayerCorporation(state)
    const corpId = corp.id
    const wantedId = contract.params.shipDefinitionId
    const def = state.definitions.ships.find((s) => s.id === wantedId)
    if (!def) return 0
    const owned = state.ships.some((s) => {
      if (s.ownerId !== corpId) return false
      // Prefer an exact definition match; fall back to stat-matching only for
      // legacy ships saved before definitionId existed.
      if (s.definitionId) return s.definitionId === wantedId
      return (
        s.cargoCapacity === def.cargoCapacity &&
        s.speed === def.speed &&
        s.fuelUsePerDistance === def.fuelUsePerDistance
      )
    })
    return owned ? 1 : 0
  },
  reach_net_worth: (state, contract) => {
    const corp = getPlayerCorporation(state)
    const corpId = corp.id
    const nw = Math.round(corp.credits + estimateInventoryValue(state, corpId))
    return Math.min(contract.target, nw)
  }
}

export function buildContractFromTemplate(ctx: ContractBuildContext): ContractBuildResult {
  return (
    CONTRACT_BUILDERS[ctx.template.type]?.(ctx) ?? {
      title: ctx.template.title,
      description: ctx.template.description,
      params: { target: 1 }
    }
  )
}

export function contractProgressFor(state: GameState, contract: ActiveContract): number {
  return CONTRACT_PROGRESS[contract.type]?.(state, contract) ?? contract.progress
}

type ObjectiveSyncFn = (
  state: GameState,
  def: ObjectiveDefinition,
  entry: ObjectiveProgressEntry
) => void

function markComplete(entry: ObjectiveProgressEntry): void {
  if (entry.completed) return
  entry.current = Math.max(entry.current, entry.target)
  entry.completed = true
}

const OBJECTIVE_SYNC: Record<ObjectiveType, ObjectiveSyncFn> = {
  own_ships: (state, _def, entry) => {
    if (entry.completed) return
    const corpId = getPlayerCorporation(state).id
    const count = state.ships.filter((s) => s.ownerId === corpId).length
    entry.current = count
    if (count >= entry.target) markComplete(entry)
  },
  net_worth: (state, _def, entry) => {
    if (entry.completed) return
    const corp = getPlayerCorporation(state)
    const nw = Math.round(
      corp.credits + estimateInventoryValue(state, corp.id)
    )
    entry.current = nw
    if (nw >= entry.target) markComplete(entry)
  },
  sell_proceeds: (state, _def, entry) => {
    if (entry.completed) return
    entry.current = Math.round(state.progression.totalSellProceeds)
    if (entry.current >= entry.target) markComplete(entry)
  },
  inter_system_delivery: (state, _def, entry) => {
    if (entry.completed) return
    if (state.progression.firstInterSystemDelivery) markComplete(entry)
  },
  produce_item: (state, def, entry) => {
    if (entry.completed) return
    entry.current = def.itemId ? (state.progression.producedItems[def.itemId] ?? 0) : 0
    if (entry.current >= entry.target) markComplete(entry)
  },
  complete_contracts: (state, _def, entry) => {
    if (entry.completed) return
    entry.current = state.progression.completedContractIds.length
    if (entry.current >= entry.target) markComplete(entry)
  }
}

/**
 * An objective is unlocked when it has no prerequisite, or its single
 * prerequisite objective is completed. Locked objectives must not sync
 * progress or complete (see progression.ts).
 */
export function isObjectiveUnlocked(state: GameState, def: ObjectiveDefinition): boolean {
  const prereqId = def.dependsOnObjectiveId
  if (!prereqId) return true
  const prereq = state.progression.objectives.find((o) => o.objectiveId === prereqId)
  return prereq?.completed ?? false
}

/** Recompute one objective entry from live state. */
export function syncObjectiveProgress(
  state: GameState,
  def: ObjectiveDefinition,
  entry: ObjectiveProgressEntry
): void {
  OBJECTIVE_SYNC[def.type]?.(state, def, entry)
}

/**
 * Apply production output to matching produce_item objectives. Reads the
 * cumulative lifetime total so objectives that unlock mid-campaign snap to the
 * already-produced amount. Locked objectives are skipped entirely.
 */
export function applyProductionToObjectives(
  state: GameState,
  itemId: string,
  quantity: number,
  objectiveEntry: (state: GameState, id: string) => ObjectiveProgressEntry | undefined
): void {
  if (quantity <= 0) return
  for (const def of state.definitions.objectives) {
    if (def.type !== 'produce_item' || def.itemId !== itemId) continue
    if (!isObjectiveUnlocked(state, def)) continue
    const entry = objectiveEntry(state, def.id)
    if (!entry || entry.completed) continue
    entry.current = state.progression.producedItems[itemId] ?? 0
    if (entry.current >= entry.target) markComplete(entry)
  }
}
