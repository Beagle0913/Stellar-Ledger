import type { GameState, PlanetId } from '../shared/types.js'
import { planetById } from './stateIndex.js'

// Per-planet population lookup is backed by a derived index so it stays O(1) as
// the galaxy grows. A monotonically increasing "generation" is bumped whenever
// any population changes; the economy rule memo (localEconomy) keys off it so it
// can cache per-system aggregates between population updates without going stale.

interface PopulationState {
  array: GameState['planetPopulations']
  byPlanet: Map<PlanetId, { population: number }>
  generation: number
}

const populationCache = new WeakMap<GameState, PopulationState>()

function popState(state: GameState): PopulationState {
  let cached = populationCache.get(state)
  if (!cached || cached.array !== state.planetPopulations) {
    cached = { array: state.planetPopulations, byPlanet: new Map(), generation: 0 }
    for (const row of state.planetPopulations) cached.byPlanet.set(row.planetId, row)
    populationCache.set(state, cached)
  }
  return cached
}

/** Monotonic counter that increments whenever any planet population changes. */
export function populationGeneration(state: GameState): number {
  return popState(state).generation
}

/** Live population for a planet (falls back to frozen definition). */
export function planetPopulation(state: GameState, planetId: PlanetId): number {
  const row = popState(state).byPlanet.get(planetId)
  if (row) return row.population
  return planetById(state, planetId)?.population ?? 0
}

export function setPlanetPopulation(state: GameState, planetId: PlanetId, population: number): void {
  const next = Math.max(0, Math.round(population))
  const cached = popState(state)
  const row = cached.byPlanet.get(planetId)
  if (row) {
    if (row.population !== next) cached.generation += 1
    row.population = next
  } else {
    const created = { planetId, population: next }
    state.planetPopulations.push(created)
    cached.byPlanet.set(planetId, created)
    cached.generation += 1
  }
}

/** Seed runtime population from planet definitions at campaign start. */
export function initPlanetPopulations(state: GameState): void {
  state.planetPopulations = state.definitions.planets.map((p) => ({
    planetId: p.id,
    population: p.population
  }))
  const cached: PopulationState = {
    array: state.planetPopulations,
    byPlanet: new Map(),
    generation: 0
  }
  for (const row of state.planetPopulations) cached.byPlanet.set(row.planetId, row)
  populationCache.set(state, cached)
}
