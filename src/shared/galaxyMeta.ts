import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { GameError } from './errors.js'
import type { GameDefinitions } from './types.js'

/** Expected galaxy size for v0.2.0+ vanilla content. */
export const EXPECTED_GALAXY_SYSTEM_COUNT = 100

export interface GalaxyMeta {
  seed: number
  generatorVersion: string
  generatedAt: string
  systemCount: number
  planetCount: number
  homeSystemId: string
  homePlanetId: string
  npcCorps: Record<string, { homeSystemId: string; planetId: string }>
  planetCountByArchetype: Record<string, number>
}

let cachedMeta: GalaxyMeta | null | undefined

export function readGalaxyMetaFile(dataRoot?: string): GalaxyMeta | null {
  const base = dataRoot ?? join(process.cwd(), 'data', 'vanilla')
  const path = join(base, 'galaxy-meta.json')
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, 'utf8')) as GalaxyMeta
}

export function getGalaxyMeta(dataRoot?: string): GalaxyMeta | null {
  if (cachedMeta === undefined) {
    cachedMeta = readGalaxyMetaFile(dataRoot)
  }
  return cachedMeta
}

export function clearGalaxyMetaCache(): void {
  cachedMeta = undefined
}

export function expectedGalaxySystemCount(dataRoot?: string): number {
  return getGalaxyMeta(dataRoot)?.systemCount ?? EXPECTED_GALAXY_SYSTEM_COUNT
}

/** Reject saves frozen with a pre-v0.2.0 galaxy (Option A). */
export function assertSaveGalaxyCompatible(definitions: GameDefinitions): void {
  const expected = expectedGalaxySystemCount()
  const actual = definitions.systems.length
  if (actual === expected) return
  throw new GameError(
    'CONFLICT',
    `This save was created with an older galaxy (${actual} systems). ` +
      `Start a new campaign to play the ${expected}-system galaxy.`
  )
}

export function homeSystemIdFromDefs(definitions: GameDefinitions): string {
  const meta = getGalaxyMeta()
  if (meta?.homeSystemId && definitions.systems.some((s) => s.id === meta.homeSystemId)) {
    return meta.homeSystemId
  }
  const configured = definitions.campaignStartConfig?.homeSystemId
  if (configured && definitions.systems.some((s) => s.id === configured)) {
    return configured
  }
  const first = definitions.systems[0]
  if (!first) throw new GameError('INTERNAL', 'No systems in definitions.')
  return first.id
}

export function homePlanetIdFromDefs(definitions: GameDefinitions): string {
  const meta = getGalaxyMeta()
  if (meta?.homePlanetId && definitions.planets.some((p) => p.id === meta.homePlanetId)) {
    return meta.homePlanetId
  }
  const systemId = homeSystemIdFromDefs(definitions)
  const minHab = definitions.campaignStartConfig?.homePlanetMinHabitability ?? 0.5
  const planet =
    definitions.planets.find((p) => p.systemId === systemId && p.habitability >= minHab) ??
    definitions.planets.find((p) => p.systemId === systemId)
  if (!planet) throw new GameError('INTERNAL', `No planet in home system ${systemId}.`)
  return planet.id
}
