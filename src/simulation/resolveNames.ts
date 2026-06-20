import type { GameState } from '../shared/types.js'
import {
  buildingDefById,
  itemById,
  planetById,
  recipeById,
  systemById
} from './stateIndex.js'

export function resolveItemName(state: GameState, id: string): string {
  return itemById(state, id)?.name ?? id
}

export function resolveBuildingName(state: GameState, id: string): string {
  return buildingDefById(state, id)?.name ?? id
}

export function resolveBuildingNameForInstance(state: GameState, instanceId: string): string {
  const inst = state.buildings.find((b) => b.id === instanceId)
  return inst ? resolveBuildingName(state, inst.definitionId) : instanceId
}

export function resolveRecipeName(state: GameState, id: string): string {
  return recipeById(state, id)?.name ?? id
}

export function resolveSystemName(state: GameState, id: string): string {
  return systemById(state, id)?.name ?? id
}

export function resolvePlanetName(state: GameState, id: string): string {
  return planetById(state, id)?.name ?? id
}
