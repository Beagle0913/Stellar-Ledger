import { DEFAULT_CORP_ID } from '../shared/constants.js'
import { newId } from '../shared/ids.js'
import type { GameState, NpcCorporationDefinition } from '../shared/types.js'
import { buildingDefById, planetById } from './stateIndex.js'

/** Seed passive NPC corporations from mod definitions (new campaigns only). */
export function seedNpcCorporations(state: GameState): void {
  for (const def of state.definitions.npcCorporations) {
    seedOneNpcCorporation(state, def)
  }
}

function seedOneNpcCorporation(state: GameState, def: NpcCorporationDefinition): void {
  if (def.id === DEFAULT_CORP_ID) return
  if (state.corporations.some((c) => c.id === def.id)) return

  if (!state.definitions.systems.some((s) => s.id === def.homeSystemId)) return

  state.corporations.push({
    id: def.id,
    name: def.name,
    credits: def.startingCredits,
    homeSystemId: def.homeSystemId,
    aiProfile: def.aiProfile
  })

  for (const [itemId, qty] of Object.entries(def.startingStock)) {
    if (qty <= 0) continue
    if (!state.definitions.items.some((i) => i.id === itemId)) continue
    state.inventories.push({
      ownerId: def.id,
      systemId: def.homeSystemId,
      itemId,
      quantity: qty,
      reserved: 0
    })
  }

  for (const b of def.buildings) {
    const planet = planetById(state, b.planetId)
    if (!planet) continue
    if (!buildingDefById(state, b.buildingType)) continue
    state.buildings.push({
      id: newId('bld'),
      definitionId: b.buildingType,
      planetId: b.planetId,
      ownerId: def.id
    })
  }

  for (const shipSeed of def.ships ?? []) {
    const shipDef = state.definitions.ships.find((s) => s.id === shipSeed.definitionId)
    if (!shipDef) continue
    state.ships.push({
      id: newId('ship'),
      name: shipSeed.name.slice(0, 64),
      definitionId: shipDef.id,
      cargoCapacity: shipDef.cargoCapacity,
      fuelUsePerDistance: shipDef.fuelUsePerDistance,
      speed: shipDef.speed,
      currentSystemId: def.homeSystemId,
      ownerId: def.id
    })
  }
}
