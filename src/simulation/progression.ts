import { newId } from '../shared/ids.js'
import { GameError } from '../shared/errors.js'
import {
  CONTRACT_TIER2_MIN_DAY,
  contractCreditBonusMultiplier,
  effectiveContractCreditReward
} from '../shared/balance.js'
import type {
  ActiveContract,
  CampaignProgression,
  ContractTemplateDefinition,
  ContractTemplateTier,
  FactionId,
  FactionReputationView,
  GameState,
  ObjectiveDefinition,
  ObjectiveProgressEntry,
  ObjectiveView,
  ContractView
} from '../shared/types.js'
import { explainObjectiveView } from '../shared/explanations/objectives.js'
import type { Trade } from './market.js'
import {
  applyProductionToObjectives,
  buildContractFromTemplate,
  contractProgressFor,
  isObjectiveUnlocked,
  syncObjectiveProgress
} from './progressionRegistry.js'

/** Build initial objective progress from definitions. */
export function initObjectiveProgress(definitions: ObjectiveDefinition[]): ObjectiveProgressEntry[] {
  return definitions.map((d) => ({
    objectiveId: d.id,
    current: 0,
    target: d.target,
    completed: false
  }))
}

export function initCampaignProgression(state: GameState): CampaignProgression {
  return {
    objectives: initObjectiveProgress(state.definitions.objectives),
    totalSellProceeds: 0,
    firstInterSystemDelivery: false,
    producedItems: {},
    activeContracts: [],
    completedContractIds: [],
    factionReputation: {},
    eventLastFiredTick: {}
  }
}

function objectiveEntry(state: GameState, id: string): ObjectiveProgressEntry | undefined {
  return state.progression.objectives.find((o) => o.objectiveId === id)
}

/**
 * Recompute every objective from live cumulative state. Locked objectives
 * (prerequisite incomplete) are skipped: they never sync or complete. The
 * outer loop is a bounded fixpoint so a chain can resolve in a single call —
 * completing a prerequisite unlocks its dependent, which then snaps to its
 * cumulative total if it is already satisfied.
 */
function syncAllObjectives(state: GameState): void {
  const maxPasses = state.definitions.objectives.length + 1
  for (let pass = 0; pass < maxPasses; pass++) {
    let completedThisPass = false
    for (const def of state.definitions.objectives) {
      const entry = objectiveEntry(state, def.id)
      if (!entry || entry.completed) continue
      if (!isObjectiveUnlocked(state, def)) continue
      syncObjectiveProgress(state, def, entry)
      if (entry.completed) completedThisPass = true
    }
    if (!completedThisPass) break
  }
}

function syncInstantObjectives(state: GameState): void {
  syncAllObjectives(state)
}

/** Record player trades for objectives and active sell contracts. */
export function applyTradesToProgression(state: GameState, trades: Trade[]): void {
  for (const trade of trades) {
    if (trade.playerSide !== 'sell') continue
    const proceeds = trade.price * trade.quantity
    notePlayerSellProceeds(state, proceeds)
    const market = state.markets.find((m) => m.id === trade.marketId)
    if (market) {
      noteContractSellInFaction(state, market.systemId, trade.itemId, trade.quantity)
    }
  }
  refreshContractProgress(state)
}

/** Record metal (or other item) produced when a job completes. */
export function noteProductionOutput(state: GameState, itemId: string, quantity: number): void {
  if (quantity <= 0) return
  state.progression.producedItems[itemId] = (state.progression.producedItems[itemId] ?? 0) + quantity
  applyProductionToObjectives(state, itemId, quantity, objectiveEntry)
}

/** Record credits earned from a player sell trade. */
export function notePlayerSellProceeds(state: GameState, amount: number): void {
  if (amount <= 0) return
  state.progression.totalSellProceeds += amount
  syncInstantObjectives(state)
}

/** Record a completed inter-system transport delivery. */
export function noteInterSystemDelivery(state: GameState): void {
  state.progression.firstInterSystemDelivery = true
  syncInstantObjectives(state)
}

/** Recompute objectives that depend on live state (net worth, ships, etc.). */
export function refreshObjectiveProgress(state: GameState): void {
  syncAllObjectives(state)
}

export function buildObjectiveViews(state: GameState): ObjectiveView[] {
  refreshObjectiveProgress(state)
  return state.definitions.objectives.map((def) => {
    const entry = objectiveEntry(state, def.id)!
    const isUnlocked = isObjectiveUnlocked(state, def)
    const status: ObjectiveView['status'] = entry.completed
      ? 'completed'
      : isUnlocked
        ? 'active'
        : 'locked'
    const view: ObjectiveView = {
      id: def.id,
      title: def.title,
      description: def.description,
      current: Math.min(entry.current, entry.target),
      target: entry.target,
      completed: entry.completed,
      isUnlocked,
      status,
      optional: def.optional ?? false,
      dependsOnObjectiveId: def.dependsOnObjectiveId ?? null
    }
    const explanation = explainObjectiveView(state, view) ?? undefined
    return explanation ? { ...view, explanation } : view
  })
}

// ---- Contract board generation (deterministic from tick + rep) ------------

function repForFaction(state: GameState, factionId: FactionId): number {
  return state.progression.factionReputation[factionId] ?? 0
}

function pickTier(state: GameState, template: ContractTemplateDefinition): ContractTemplateTier {
  const rep = repForFaction(state, template.factionId)
  const eligible = template.tiers.filter((t) => {
    if (rep < t.minReputation) return false
    const minDay = t.minCampaignTick ?? (t.tier >= 2 ? CONTRACT_TIER2_MIN_DAY : 0)
    return state.meta.tick >= minDay
  })
  return eligible[eligible.length - 1] ?? template.tiers[0]!
}
function hashSeed(state: GameState, salt: string): number {
  return state.meta.tick * 997 + salt.length * 13 + state.progression.activeContracts.length * 31
}

function pickSystemId(state: GameState, seed: number): string {
  const systems = state.definitions.systems
  return systems[seed % systems.length]!.id
}

function pickInt(min: number, max: number, seed: number): number {
  if (max <= min) return min
  return min + (Math.abs(seed) % (max - min + 1))
}

export function generateContractOffer(state: GameState, template: ContractTemplateDefinition): ActiveContract {
  const tier = pickTier(state, template)
  const seed = hashSeed(state, template.id)
  const built = buildContractFromTemplate({
    template,
    tier,
    state,
    seed,
    pickSystemId,
    pickInt
  })
  return {
    id: newId('contract'),
    templateId: template.id,
    type: template.type,
    title: built.title,
    description: built.description,
    factionId: template.factionId,
    tier: tier.tier,
    creditReward: tier.creditReward,
    reputationReward: tier.reputationReward,
    expiresAtTick: state.meta.tick + tier.expiresInDays,
    accepted: false,
    progress: 0,
    target: built.params.target ?? 1,
    params: built.params
  }
}

const TARGET_ACTIVE_CONTRACTS = 4

/**
 * Templates whose minCampaignTick gate has been reached. Used to fill the
 * board; may be empty (e.g. high gates in modded content), in which case the
 * board is simply left with fewer slots.
 */
export function eligibleContractTemplates(state: GameState): ContractTemplateDefinition[] {
  const now = state.meta.tick
  return state.definitions.contractTemplates.filter((t) => now >= (t.minCampaignTick ?? 0))
}

export function ensureContractBoard(state: GameState): void {
  const now = state.meta.tick
  state.progression.activeContracts = state.progression.activeContracts.filter(
    (c) => !c.accepted || c.expiresAtTick > now
  )

  const eligible = eligibleContractTemplates(state)
  if (eligible.length === 0) return

  // Round-robin only over eligible templates; never loop indefinitely.
  let cursor = 0
  while (state.progression.activeContracts.length < TARGET_ACTIVE_CONTRACTS) {
    const template = eligible[cursor % eligible.length]!
    state.progression.activeContracts.push(generateContractOffer(state, template))
    cursor++
  }
}

function contractProgress(state: GameState, contract: ActiveContract): number {
  return contractProgressFor(state, contract)
}

export function noteContractSellInFaction(
  state: GameState,
  systemId: string,
  itemId: string,
  quantity: number
): void {
  for (const contract of state.progression.activeContracts) {
    if (!contract.accepted || contract.type !== 'sell_in_faction') continue
    if (contract.params.itemId !== itemId) continue
    const system = state.definitions.systems.find((s) => s.id === systemId)
    if (system?.controllingFactionId !== contract.params.factionId) continue
    if (contract.params.systemId && contract.params.systemId !== systemId) continue
    contract.progress = Math.min(contract.target, contract.progress + quantity)
  }
}

export function refreshContractProgress(state: GameState): void {
  for (const contract of state.progression.activeContracts) {
    if (!contract.accepted) continue
    contract.progress = contractProgress(state, contract)
  }
}

export function buildContractViews(state: GameState): ContractView[] {
  ensureContractBoard(state)
  refreshContractProgress(state)
  return state.progression.activeContracts.map((c) => {
    const faction = state.definitions.factions.find((f) => f.id === c.factionId)
    const progress = c.accepted ? contractProgress(state, c) : 0
    const completable = c.accepted && progress >= c.target && c.expiresAtTick > state.meta.tick
    const rep = repForFaction(state, c.factionId)
    return {
      id: c.id,
      title: c.title,
      description: c.description,
      factionId: c.factionId,
      factionName: faction?.name ?? c.factionId,
      tier: c.tier,
      creditReward: c.creditReward,
      effectiveCreditReward: effectiveContractCreditReward(c.creditReward, rep),
      reputationReward: c.reputationReward,
      expiresAtTick: c.expiresAtTick,
      accepted: c.accepted,
      progress,
      target: c.target,
      completable
    }
  })
}

export function buildFactionReputationViews(state: GameState): FactionReputationView[] {
  return state.definitions.factions.map((f) => {
    const reputation = repForFaction(state, f.id)
    const thresholds = state.definitions.contractTemplates
      .filter((t) => t.factionId === f.id)
      .flatMap((t) => t.tiers.map((tier) => tier.minReputation))
      .filter((min) => min > reputation)
      .sort((a, b) => a - b)
    return {
      factionId: f.id,
      factionName: f.name,
      reputation,
      nextTierAt: thresholds[0] ?? null,
      contractBonusPercent: Math.round((contractCreditBonusMultiplier(reputation) - 1) * 100)
    }
  })
}
export function acceptContract(state: GameState, contractId: string): void {
  ensureContractBoard(state)
  const contract = state.progression.activeContracts.find((c) => c.id === contractId)
  if (!contract) throw new GameError('NOT_FOUND', `Unknown contract "${contractId}".`)
  if (contract.accepted) throw new GameError('CONFLICT', 'Contract already accepted.')
  if (contract.type === 'produce_item' && contract.params.itemId) {
    contract.params.baselineProduced =
      state.progression.producedItems[contract.params.itemId] ?? 0
  }
  contract.accepted = true
  contract.progress = contractProgress(state, contract)
}

export function completeContract(state: GameState, contractId: string): void {
  refreshContractProgress(state)
  const contract = state.progression.activeContracts.find((c) => c.id === contractId)
  if (!contract) throw new GameError('NOT_FOUND', `Unknown contract "${contractId}".`)
  if (!contract.accepted) throw new GameError('CONFLICT', 'Accept the contract before completing it.')
  if (contract.expiresAtTick <= state.meta.tick) {
    throw new GameError('CONFLICT', 'Contract has expired.')
  }
  if (contractProgress(state, contract) < contract.target) {
    throw new GameError('CONFLICT', 'Contract requirements not met yet.')
  }
  const repBefore = state.progression.factionReputation[contract.factionId] ?? 0
  const payout = effectiveContractCreditReward(contract.creditReward, repBefore)
  state.corporation.credits += payout
  state.progression.factionReputation[contract.factionId] = repBefore + contract.reputationReward
  state.progression.completedContractIds.push(contract.id)
  state.progression.activeContracts = state.progression.activeContracts.filter(
    (c) => c.id !== contractId
  )
  ensureContractBoard(state)
}

export function abandonContract(state: GameState, contractId: string): void {
  const contract = state.progression.activeContracts.find((c) => c.id === contractId)
  if (!contract) throw new GameError('NOT_FOUND', `Unknown contract "${contractId}".`)
  state.progression.activeContracts = state.progression.activeContracts.filter(
    (c) => c.id !== contractId
  )
  ensureContractBoard(state)
}

/** Called at end of each tick to expire stale offers and refresh the board. */
export function processContractsEndOfTick(state: GameState): void {
  const now = state.meta.tick
  state.progression.activeContracts = state.progression.activeContracts.filter(
    (c) => c.expiresAtTick > now
  )
  ensureContractBoard(state)
}
