import { GameError } from '../../shared/errors.js'
import type { GameState, PlanetDetail, SystemDetail, SystemSummary } from '../../shared/types.js'
import { getCorporationById, getPlayerCorporation, isPlayerCorporation } from '../corporations.js'
import { explainAffordability, systemDistance } from '../economyMath.js'
import { factionPriceBias } from '../localEconomy.js'
import { planetPopulation } from '../planetPopulation.js'
import { resolveBuildingName } from '../resolveNames.js'
import { factionById, planetById, planetsInSystem, systemById } from '../stateIndex.js'
import { buildMarketItems } from './market.js'

export function buildSystemSummaries(state: GameState): SystemSummary[] {
  const homeSystemId = getPlayerCorporation(state).homeSystemId
  return state.definitions.systems.map((s) => ({
    id: s.id,
    name: s.name,
    x: s.x,
    y: s.y,
    planetCount: state.definitions.planets.filter((p) => p.systemId === s.id).length,
    controllingFactionId: s.controllingFactionId ?? null,
    distanceFromHome: s.id === homeSystemId ? 0 : systemDistance(state, homeSystemId, s.id),
    isHome: s.id === homeSystemId
  }))
}

export function buildSystemDetail(state: GameState, id: string): SystemDetail {
  const system = systemById(state, id)
  if (!system) throw new GameError('NOT_FOUND', `Unknown system "${id}".`)
  const planets = planetsInSystem(state, id).map((p) => ({
    id: p.id,
    name: p.name,
    planetType: p.planetType,
    habitability: p.habitability,
    mineralRichness: p.mineralRichness,
    fertility: p.fertility,
    energyPotential: p.energyPotential,
    population: planetPopulation(state, p.id),
    buildingCount: state.buildings.filter((b) => b.planetId === p.id).length
  }))
  const routes = state.definitions.systems
    .filter((s) => s.id !== id)
    .map((s) => ({ toSystemId: s.id, toName: s.name, distance: systemDistance(state, id, s.id) }))
  const faction =
    system.controllingFactionId != null
      ? factionById(state, system.controllingFactionId)
      : undefined
  const foreignBuildings = state.buildings
    .filter((b) => {
      const planet = planetById(state, b.planetId)
      return planet?.systemId === id && !isPlayerCorporation(state, b.ownerId)
    })
    .map((b) => {
      const planet = planetById(state, b.planetId)!
      const owner = getCorporationById(state, b.ownerId)
      return {
        id: b.id,
        planetId: b.planetId,
        planetName: planet.name,
        definitionName: resolveBuildingName(state, b.definitionId),
        ownerId: b.ownerId,
        ownerName: owner?.name ?? b.ownerId
      }
    })
    .sort(
      (a, b) =>
        a.ownerName.localeCompare(b.ownerName) ||
        a.planetName.localeCompare(b.planetName) ||
        a.definitionName.localeCompare(b.definitionName)
    )
  return {
    id: system.id,
    name: system.name,
    controllingFactionId: system.controllingFactionId ?? null,
    controllingFactionName: faction?.name ?? null,
    factionPriceBias: system.controllingFactionId ? factionPriceBias(state, system.id) : null,
    planets,
    marketItems: buildMarketItems(state, id),
    routes,
    foreignBuildings
  }
}

export function buildPlanetDetail(state: GameState, id: string): PlanetDetail {
  const p = planetById(state, id)
  if (!p) throw new GameError('NOT_FOUND', `Unknown planet "${id}".`)
  const system = systemById(state, p.systemId)
  const buildings = state.buildings
    .filter((b) => b.planetId === id)
    .map((b) => {
      const owner = getCorporationById(state, b.ownerId)
      return {
        id: b.id,
        definitionId: b.definitionId,
        definitionName: resolveBuildingName(state, b.definitionId),
        ownerId: b.ownerId,
        ownerName: owner?.name ?? b.ownerId,
        isPlayerOwned: isPlayerCorporation(state, b.ownerId)
      }
    })
  const buildable = state.definitions.buildings.map((def) => ({
    definitionId: def.id,
    name: def.name,
    buildCost: def.buildCost,
    buildMaterials: def.buildMaterials,
    affordable: explainAffordability(
      state,
      getPlayerCorporation(state).id,
      p.systemId,
      def.buildCost,
      def.buildMaterials
    ) === null
  }))
  return {
    id: p.id,
    name: p.name,
    systemId: p.systemId,
    systemName: system?.name ?? p.systemId,
    planetType: p.planetType,
    habitability: p.habitability,
    mineralRichness: p.mineralRichness,
    fertility: p.fertility,
    energyPotential: p.energyPotential,
    population: planetPopulation(state, p.id),
    modifiers: p.modifiers,
    buildings,
    buildable
  }
}
