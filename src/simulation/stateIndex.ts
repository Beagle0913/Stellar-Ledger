import type {
  BuildingDefinition,
  EconomicProfileDefinition,
  FactionDefinition,
  GameState,
  ItemDefinition,
  Market,
  PlanetDefinition,
  RecipeDefinition,
  SystemDefinition
} from '../shared/types.js'

// Derived, in-memory lookup indexes over a GameState. These exist purely to make
// the simulation scale to large galaxies (thousands of systems/planets) by
// replacing repeated O(n) `Array.find`/`filter` scans with O(1) map lookups.
//
// Everything indexed here is either FROZEN definition content (immutable for the
// life of a campaign) or the `markets` list (created once at campaign start and
// never mutated afterwards), so a single lazily-built cache keyed by the
// GameState object stays valid for as long as that state lives. Nothing here is
// persisted — it is rebuilt on demand for each loaded campaign.

interface StateIndex {
  systemById: Map<string, SystemDefinition>
  itemById: Map<string, ItemDefinition>
  profileById: Map<string, EconomicProfileDefinition>
  factionById: Map<string, FactionDefinition>
  planetById: Map<string, PlanetDefinition>
  recipeById: Map<string, RecipeDefinition>
  buildingDefById: Map<string, BuildingDefinition>
  planetsBySystem: Map<string, PlanetDefinition[]>
  marketById: Map<string, Market>
  marketBySystem: Map<string, Market>
}

const cache = new WeakMap<GameState, StateIndex>()

function build(state: GameState): StateIndex {
  const defs = state.definitions

  const planetsBySystem = new Map<string, PlanetDefinition[]>()
  for (const planet of defs.planets) {
    const list = planetsBySystem.get(planet.systemId)
    if (list) list.push(planet)
    else planetsBySystem.set(planet.systemId, [planet])
  }

  const marketBySystem = new Map<string, Market>()
  const marketById = new Map<string, Market>()
  for (const market of state.markets) {
    marketById.set(market.id, market)
    // First market per system wins, matching the previous `find` semantics.
    if (!marketBySystem.has(market.systemId)) marketBySystem.set(market.systemId, market)
  }

  return {
    systemById: new Map(defs.systems.map((s) => [s.id, s])),
    itemById: new Map(defs.items.map((i) => [i.id, i])),
    profileById: new Map(defs.economicProfiles.map((p) => [p.id, p])),
    factionById: new Map(defs.factions.map((f) => [f.id, f])),
    planetById: new Map(defs.planets.map((p) => [p.id, p])),
    recipeById: new Map(defs.recipes.map((r) => [r.id, r])),
    buildingDefById: new Map(defs.buildings.map((b) => [b.id, b])),
    planetsBySystem,
    marketById,
    marketBySystem
  }
}

function indexFor(state: GameState): StateIndex {
  let idx = cache.get(state)
  if (!idx) {
    idx = build(state)
    cache.set(state, idx)
  }
  return idx
}

export function systemById(state: GameState, id: string): SystemDefinition | undefined {
  return indexFor(state).systemById.get(id)
}

export function itemById(state: GameState, id: string): ItemDefinition | undefined {
  return indexFor(state).itemById.get(id)
}

export function profileById(state: GameState, id: string): EconomicProfileDefinition | undefined {
  return indexFor(state).profileById.get(id)
}

export function factionById(state: GameState, id: string): FactionDefinition | undefined {
  return indexFor(state).factionById.get(id)
}

export function planetById(state: GameState, id: string): PlanetDefinition | undefined {
  return indexFor(state).planetById.get(id)
}

export function recipeById(state: GameState, id: string): RecipeDefinition | undefined {
  return indexFor(state).recipeById.get(id)
}

export function buildingDefById(state: GameState, id: string): BuildingDefinition | undefined {
  return indexFor(state).buildingDefById.get(id)
}

/** Planets in a system, in definition order. Returns a shared array — do not mutate. */
export function planetsInSystem(state: GameState, systemId: string): PlanetDefinition[] {
  return indexFor(state).planetsBySystem.get(systemId) ?? EMPTY_PLANETS
}

export function marketById(state: GameState, id: string): Market | undefined {
  return indexFor(state).marketById.get(id)
}

export function marketBySystemId(state: GameState, systemId: string): Market | undefined {
  return indexFor(state).marketBySystem.get(systemId)
}

const EMPTY_PLANETS: PlanetDefinition[] = []
