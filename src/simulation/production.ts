import { GameError } from '../shared/errors.js'
import { newId } from '../shared/ids.js'
import type {
  BuildingInstance,
  GameState,
  PlanetDefinition,
  ProductionJob,
  RecipeDefinition
} from '../shared/types.js'
import {
  addInventory,
  availableQuantity,
  findInventory,
  itemLabel,
  removeInventory
} from './economyMath.js'
import { effectiveOutput } from './extraction.js'
import { noteProductionOutput } from './progression.js'
import { planetById, recipeById } from './stateIndex.js'

// Production system. Buildings run recipes. Inputs are consumed when a job
// STARTS; outputs are created when it COMPLETES. One running job per building;
// additional jobs queue until the slot opens.

/** Recipes a given building type is able to run. */
export function recipesForBuildingType(
  state: GameState,
  buildingType: string
): RecipeDefinition[] {
  return state.definitions.recipes.filter((r) => r.buildingType === buildingType)
}

function buildingOrThrow(state: GameState, buildingId: string): BuildingInstance {
  const b = state.buildings.find((x) => x.id === buildingId)
  if (!b) throw new GameError('NOT_FOUND', `Unknown building "${buildingId}".`)
  return b
}

function planetForBuilding(state: GameState, building: BuildingInstance): PlanetDefinition {
  const planet = planetById(state, building.planetId)
  if (!planet) throw new GameError('NOT_FOUND', `Building "${building.id}" is on unknown planet "${building.planetId}".`)
  return planet
}

/** Resolve the system a building's planet sits in (where inputs/outputs live). */
function systemForBuilding(state: GameState, building: BuildingInstance): string {
  return planetForBuilding(state, building).systemId
}

function runningJobForBuilding(state: GameState, buildingId: string): ProductionJob | undefined {
  return state.productionJobs.find((j) => j.buildingId === buildingId && j.status === 'running')
}

/** Group production jobs by building once, for the per-tick processing path. */
function indexJobsByBuilding(state: GameState): Map<string, ProductionJob[]> {
  const byBuilding = new Map<string, ProductionJob[]>()
  for (const job of state.productionJobs) {
    const list = byBuilding.get(job.buildingId)
    if (list) list.push(job)
    else byBuilding.set(job.buildingId, [job])
  }
  return byBuilding
}

function consumeInputsForJob(
  state: GameState,
  building: BuildingInstance,
  recipe: RecipeDefinition,
  quantity: number
): void {
  const systemId = systemForBuilding(state, building)
  for (const input of recipe.inputs) {
    const removed = removeInventory(
      state,
      building.ownerId,
      systemId,
      input.itemId,
      input.quantity * quantity
    )
    if (!removed) {
      throw new Error(
        `Failed to consume ${itemLabel(state, input.itemId)} (need ${input.quantity * quantity}).`
      )
    }
  }
}

function depositJobOutputs(
  state: GameState,
  job: ProductionJob,
  building: BuildingInstance | undefined
): void {
  const recipe = recipeById(state, job.recipeId)
  if (!building || !recipe) return
  const planet = planetById(state, building.planetId)
  if (!planet) return
  const systemId = planet.systemId
  for (const output of recipe.outputs) {
    const perRun = effectiveOutput(planet, recipe, output.quantity)
    const total = perRun * job.quantity
    addInventory(state, building.ownerId, systemId, output.itemId, total)
    noteProductionOutput(state, output.itemId, total)
  }
}

/**
 * Try to promote the next queued job on a building (consumes inputs when
 * successful). An optional pre-grouped job list avoids re-scanning all jobs,
 * which matters on the per-tick path with many buildings.
 */
export function tryPromoteQueuedJob(
  state: GameState,
  buildingId: string,
  jobs?: ProductionJob[]
): boolean {
  const list = jobs ?? state.productionJobs.filter((j) => j.buildingId === buildingId)
  if (list.some((j) => j.status === 'running')) return false
  const next = list.find((j) => j.status === 'queued')
  if (!next) return false
  const check = canStartProduction(state, buildingId, next.recipeId, next.quantity)
  if (!check.ok) return false
  const building = buildingOrThrow(state, buildingId)
  const recipe = recipeById(state, next.recipeId)!
  consumeInputsForJob(state, building, recipe, next.quantity)
  next.status = 'running'
  next.progress = 0
  return true
}

/**
 * Check whether a production job can be started: the building must support the
 * recipe and all scaled inputs must be available in the building's system.
 */
export function canStartProduction(
  state: GameState,
  buildingId: string,
  recipeId: string,
  quantity: number
): { ok: true } | { ok: false; reason: string } {
  if (quantity <= 0) return { ok: false, reason: 'Quantity must be positive.' }
  const building = state.buildings.find((b) => b.id === buildingId)
  if (!building) return { ok: false, reason: 'Building not found.' }
  const recipe = recipeById(state, recipeId)
  if (!recipe) return { ok: false, reason: 'Recipe not found.' }
  if (recipe.buildingType !== building.definitionId) {
    return { ok: false, reason: 'This building cannot run that recipe.' }
  }
  const systemId = systemForBuilding(state, building)
  for (const input of recipe.inputs) {
    const row = findInventory(state, building.ownerId, systemId, input.itemId)
    const have = availableQuantity(row)
    const need = input.quantity * quantity
    if (have < need) {
      return {
        ok: false,
        reason: `Not enough ${itemLabel(state, input.itemId)} here: need ${need}, have ${have}. Inputs must be in the building's system.`
      }
    }
  }
  return { ok: true }
}

/** Max recipe runs affordable right now from available inputs. */
export function maxAffordableRuns(
  state: GameState,
  buildingId: string,
  recipeId: string
): number {
  const building = state.buildings.find((b) => b.id === buildingId)
  const recipe = recipeById(state, recipeId)
  if (!building || !recipe || recipe.buildingType !== building.definitionId) return 0
  if (recipe.inputs.length === 0) return Number.MAX_SAFE_INTEGER
  const systemId = systemForBuilding(state, building)
  let max = Number.MAX_SAFE_INTEGER
  for (const input of recipe.inputs) {
    const row = findInventory(state, building.ownerId, systemId, input.itemId)
    const have = availableQuantity(row)
    const perRun = input.quantity
    if (perRun <= 0) continue
    max = Math.min(max, Math.floor(have / perRun))
  }
  return max === Number.MAX_SAFE_INTEGER ? 0 : max
}

/**
 * Start or queue a production job. If the building is busy, the job is queued
 * without consuming inputs. Otherwise inputs are consumed immediately.
 */
export function startProductionJob(
  state: GameState,
  buildingId: string,
  recipeId: string,
  quantity: number
): ProductionJob {
  const check = canStartProduction(state, buildingId, recipeId, quantity)
  if (!check.ok) throw new GameError('VALIDATION', check.reason)

  const building = buildingOrThrow(state, buildingId)
  const recipe = recipeById(state, recipeId)!
  const running = runningJobForBuilding(state, buildingId)

  const job: ProductionJob = {
    id: newId('job'),
    buildingId,
    recipeId,
    quantity,
    progress: 0,
    duration: recipe.duration,
    status: running ? 'queued' : 'running'
  }

  if (!running) {
    consumeInputsForJob(state, building, recipe, quantity)
  }

  state.productionJobs.push(job)
  return job
}

/** Queue another run of the same recipe; fails gracefully when inputs are insufficient. */
export function repeatProductionJob(
  state: GameState,
  buildingId: string,
  recipeId: string,
  quantity: number
): { ok: true; job: ProductionJob } | { ok: false; reason: string } {
  const check = canStartProduction(state, buildingId, recipeId, quantity)
  if (!check.ok) return check
  return { ok: true, job: startProductionJob(state, buildingId, recipeId, quantity) }
}

/** Queue as many single-run jobs as currently affordable from available inputs. */
export function runProductionUntilExhausted(
  state: GameState,
  buildingId: string,
  recipeId: string
): number {
  const max = maxAffordableRuns(state, buildingId, recipeId)
  for (let i = 0; i < max; i += 1) {
    startProductionJob(state, buildingId, recipeId, 1)
  }
  return max
}

/**
 * Cancel a production job. Running jobs forfeit consumed inputs. Queued jobs
 * cancel with no loss. Promotes the next queued job when a running slot opens.
 */
export function cancelProductionJob(state: GameState, jobId: string): ProductionJob {
  const job = state.productionJobs.find((j) => j.id === jobId)
  if (!job) throw new GameError('NOT_FOUND', `Unknown production job "${jobId}".`)
  if (job.status === 'queued') {
    job.status = 'cancelled'
    return job
  }
  if (job.status !== 'running') {
    throw new GameError(
      'CONFLICT',
      `Only running or queued production jobs can be cancelled (job is "${job.status}").`
    )
  }
  job.status = 'cancelled'
  tryPromoteQueuedJob(state, job.buildingId)
  return job
}

/**
 * Advance all running production jobs by one tick. Completed jobs deposit their
 * (extraction-scaled) outputs into the building's system inventory.
 */
export function processProductionJobs(state: GameState): void {
  const jobsByBuilding = indexJobsByBuilding(state)
  const buildingById = new Map(state.buildings.map((b) => [b.id, b]))

  for (const building of state.buildings) {
    const list = jobsByBuilding.get(building.id)
    if (!list || !list.some((j) => j.status === 'running')) {
      tryPromoteQueuedJob(state, building.id, list)
    }
  }

  for (const job of state.productionJobs) {
    if (job.status !== 'running') continue
    job.progress += 1
    if (job.progress < job.duration) continue

    job.status = 'completed'
    depositJobOutputs(state, job, buildingById.get(job.buildingId))
    tryPromoteQueuedJob(state, job.buildingId, jobsByBuilding.get(job.buildingId))
  }
}
