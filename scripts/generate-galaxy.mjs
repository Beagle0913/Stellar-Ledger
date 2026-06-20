/**
 * Seeded procedural galaxy generator for Stellar Ledger vanilla content.
 * Usage:
 *   node scripts/generate-galaxy.mjs          # write JSON
 *   node scripts/generate-galaxy.mjs --check  # verify committed JSON matches
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const vanillaDir = join(root, 'data', 'vanilla')

export const GENERATOR_VERSION = '1.0.0'
export const GALAXY_SEED = 42
export const SYSTEM_COUNT = 100
export const PLANET_COUNT_MIN = 480
export const PLANET_COUNT_MAX = 620

const ARCHETYPES = [
  { id: 'sparse', min: 1, max: 2, weight: 0.15 },
  { id: 'typical', min: 3, max: 6, weight: 0.55 },
  { id: 'rich', min: 7, max: 9, weight: 0.24 },
  { id: 'massive', min: 10, max: 13, weight: 0.06 }
]

const FACTIONS = ['faction_consortium', 'faction_independents', 'faction_frontier']

const SYLLABLES_A = ['Al', 'Be', 'Cor', 'Dra', 'El', 'Fen', 'Gar', 'Hel', 'Iri', 'Jun', 'Kal', 'Lun']
const SYLLABLES_B = ['ara', 'en', 'ion', 'os', ' Prime', ' Reach', ' Belt', ' Gate', ' Vale', ' Rim', ' Deep', ' Nova']

const PROFILE_BY_TYPE = {
  terran: ['profile_terran_food_demand', 'profile_food_demand'],
  oceanic: ['profile_aquaculture_food_supply'],
  rocky: ['profile_rocky_mining_supply', 'profile_mining_colony_needs', 'profile_machinery_demand'],
  volcanic: ['profile_ore_supply'],
  gas_giant: ['profile_gas_giant_fuel_supply'],
  ice: ['profile_mining_colony_needs'],
  barren: ['profile_rocky_mining_supply']
}

const SLOT_TYPES = [
  ['rocky', 'rocky'],
  ['terran', 'oceanic', 'rocky'],
  ['rocky', 'terran', 'oceanic', 'rocky', 'ice', 'gas_giant', 'barren'],
  ['rocky', 'volcanic', 'terran', 'oceanic', 'rocky', 'ice', 'gas_giant', 'barren', 'rocky', 'ice', 'gas_giant', 'barren', 'barren']
]

/** @param {number} seed */
export function mulberry32(seed) {
  return function next() {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pickWeighted(rng, items) {
  const total = items.reduce((s, i) => s + i.weight, 0)
  let roll = rng() * total
  for (const item of items) {
    roll -= item.weight
    if (roll <= 0) return item
  }
  return items[items.length - 1]
}

function planetCountForArchetype(arch) {
  return arch.min + Math.floor((arch.max - arch.min + 1) * 0.5)
}

function rollPlanetCount(rng) {
  const arch = pickWeighted(rng, ARCHETYPES)
  const count =
    arch.min + Math.floor(rng() * (arch.max - arch.min + 1))
  return { count, archetype: arch.id }
}

function generateName(rng, used) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const name = `${SYLLABLES_A[Math.floor(rng() * SYLLABLES_A.length)]}${SYLLABLES_B[Math.floor(rng() * SYLLABLES_B.length)]}`
    if (!used.has(name)) {
      used.add(name)
      return name
    }
  }
  return `System ${used.size}`
}

function dist2(a, b) {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return dx * dx + dy * dy
}

function systemDistanceCoords(a, b) {
  return Math.round(Math.sqrt(dist2(a, b)) / 10)
}

function mstEdges(systems) {
  if (systems.length === 0) return []
  const edges = []
  const inTree = new Set([systems[0].id])
  const byId = new Map(systems.map((s) => [s.id, s]))
  while (inTree.size < systems.length) {
    let best = null
    for (const u of inTree) {
      const su = byId.get(u)
      for (const v of systems) {
        if (inTree.has(v.id)) continue
        const d = systemDistanceCoords(su, v)
        if (!best || d < best.dist) best = { u, v: v.id, dist: d }
      }
    }
    if (!best) break
    inTree.add(best.v)
    edges.push(best)
  }
  return edges
}

function statsForType(type, rng) {
  const jitter = () => 0.85 + rng() * 0.3
  switch (type) {
    case 'terran':
      return {
        habitability: 0.75 + rng() * 0.2,
        mineralRichness: 0.4 + rng() * 0.4,
        fertility: 1.1 + rng() * 0.4,
        energyPotential: 0.9 + rng() * 0.2,
        population: Math.floor(500_000 + rng() * 4_500_000),
        modifiers: {}
      }
    case 'oceanic':
      return {
        habitability: 0.55 + rng() * 0.25,
        mineralRichness: 0.3 + rng() * 0.3,
        fertility: 1.3 + rng() * 0.4,
        energyPotential: 0.8 + rng() * 0.2,
        population: Math.floor(200_000 + rng() * 2_000_000),
        modifiers: { aquaculture: 1.2 + rng() * 0.2 }
      }
    case 'volcanic':
      return {
        habitability: 0.02 + rng() * 0.1,
        mineralRichness: 1.5 + rng() * 0.4,
        fertility: 0.05 + rng() * 0.1,
        energyPotential: 1.4 + rng() * 0.4,
        population: Math.floor(rng() * 20_000),
        modifiers: { geothermal: 1.2 + rng() * 0.3 }
      }
    case 'gas_giant':
      return {
        habitability: 0,
        mineralRichness: 0.1 + rng() * 0.2,
        fertility: 0,
        energyPotential: 1.6 + rng() * 0.4,
        population: 0,
        modifiers: { gasHarvest: 1.3 + rng() * 0.3 }
      }
    case 'ice':
      return {
        habitability: 0.05 + rng() * 0.15,
        mineralRichness: 0.7 + rng() * 0.5,
        fertility: 0.2 + rng() * 0.3,
        energyPotential: 0.4 + rng() * 0.3,
        population: Math.floor(rng() * 80_000),
        modifiers: {}
      }
    case 'barren':
      return {
        habitability: 0,
        mineralRichness: 1.2 + rng() * 0.6,
        fertility: 0,
        energyPotential: 0.4 + rng() * 0.4,
        population: 0,
        modifiers: rng() > 0.5 ? { asteroidMining: 1.1 + rng() * 0.2 } : {}
      }
    default:
      return {
        habitability: 0.15 + rng() * 0.3,
        mineralRichness: 1.0 + rng() * 0.5,
        fertility: 0.3 + rng() * 0.4,
        energyPotential: 0.7 + rng() * 0.4,
        population: Math.floor(20_000 + rng() * 200_000),
        modifiers: {}
      }
  }
}

function pickProfile(type, profiles, rng) {
  const candidates = PROFILE_BY_TYPE[type] ?? ['profile_rocky_mining_supply']
  const valid = candidates.filter((id) => profiles.has(id))
  const pool = valid.length > 0 ? valid : [...profiles]
  return pool[Math.floor(rng() * pool.length)]
}

/** @returns {{ systems: object[], planets: object[], meta: object, campaignStart: object, npcCorps: object[] }} */
export function generateGalaxy(options = {}) {
  const seed = options.seed ?? GALAXY_SEED
  const rng = mulberry32(seed >>> 0)
  const profiles = new Set(
    JSON.parse(readFileSync(join(vanillaDir, 'economic_profiles.json'), 'utf8')).map((p) => p.id)
  )

  const usedNames = new Set()
  const systems = []
  const planets = []
  const planetCountByArchetype = { sparse: 0, typical: 0, rich: 0, massive: 0 }
  const cx = 600
  const cy = 600

  for (let i = 0; i < SYSTEM_COUNT; i += 1) {
    const id = `sys_${String(i + 1).padStart(3, '0')}`
    const angle = i * 2.399963229728653
    const radius = 60 + i * 9
    const x = Math.round(cx + radius * Math.cos(angle) + (rng() - 0.5) * 20)
    const y = Math.round(cy + radius * Math.sin(angle) + (rng() - 0.5) * 20)
    const ring = radius / (60 + (SYSTEM_COUNT - 1) * 9)
    const faction =
      ring < 0.33
        ? FACTIONS[0]
        : ring < 0.66
          ? FACTIONS[1]
          : FACTIONS[2]

    const { count, archetype } = rollPlanetCount(rng)
    planetCountByArchetype[archetype] = (planetCountByArchetype[archetype] ?? 0) + 1

    systems.push({
      id,
      name: generateName(rng, usedNames),
      x,
      y,
      controllingFactionId: faction
    })

    const slotTypes = SLOT_TYPES[Math.min(count, SLOT_TYPES.length) - 1] ?? SLOT_TYPES[2]
    for (let p = 0; p < count; p += 1) {
      const planetType = slotTypes[p % slotTypes.length] ?? 'rocky'
      const stats = statsForType(planetType, rng)
      const suffix = [' I', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX', ' X', ' XI', ' XII', ' XIII'][
        p
      ] ?? ` ${p + 1}`
      planets.push({
        id: `${id}_p${p + 1}`,
        name: `${systems[systems.length - 1].name}${suffix}`.trim(),
        systemId: id,
        planetType,
        ...stats,
        economicProfileId: pickProfile(planetType, profiles, rng)
      })
    }
  }

  // Home: terran/oceanic in inner systems with highest habitability
  const inner = [...systems].sort((a, b) => dist2(a, { x: cx, y: cy }) - dist2(b, { x: cx, y: cy }))
  let homeSystemId = systems[0].id
  let homePlanetId = planets[0].id
  let bestHab = -1
  for (const sys of inner.slice(0, 15)) {
    for (const p of planets.filter((pl) => pl.systemId === sys.id)) {
      if (
        (p.planetType === 'terran' || p.planetType === 'oceanic') &&
        p.habitability > bestHab
      ) {
        bestHab = p.habitability
        homeSystemId = sys.id
        homePlanetId = p.id
      }
    }
  }

  // NPC Helion: volcanic + ore profile, away from home
  let helionSystem = null
  let helionPlanet = null
  for (const sys of systems) {
    if (sys.id === homeSystemId) continue
    const candidates = planets.filter(
      (p) =>
        p.systemId === sys.id &&
        (p.planetType === 'volcanic' || p.economicProfileId === 'profile_ore_supply')
    )
    if (candidates.length > 0) {
      helionSystem = sys
      helionPlanet = candidates[0]
      break
    }
  }
  if (!helionPlanet) {
    helionSystem = systems.find((s) => s.id !== homeSystemId) ?? systems[0]
    helionPlanet = planets.find((p) => p.systemId === helionSystem.id) ?? planets[0]
  }

  // NPC Orion: different system, machinery/refining profile
  let orionSystem = null
  let orionPlanet = null
  for (const sys of systems) {
    if (sys.id === homeSystemId || sys.id === helionSystem.id) continue
    const candidates = planets.filter(
      (p) =>
        p.systemId === sys.id &&
        (p.economicProfileId === 'profile_machinery_demand' || p.planetType === 'rocky')
    )
    if (candidates.length > 0) {
      orionSystem = sys
      orionPlanet = candidates[0]
      break
    }
  }
  if (!orionPlanet) {
    orionSystem = systems.find((s) => s.id !== homeSystemId && s.id !== helionSystem.id) ?? systems[1]
    orionPlanet = planets.find((p) => p.systemId === orionSystem.id) ?? planets[1]
  }

  const meta = {
    seed,
    generatorVersion: GENERATOR_VERSION,
    generatedAt: '2026-06-20T00:00:00.000Z',
    systemCount: systems.length,
    planetCount: planets.length,
    homeSystemId,
    homePlanetId,
    npcCorps: {
      corp_helion_mining: { homeSystemId: helionSystem.id, planetId: helionPlanet.id },
      corp_orion_refining: { homeSystemId: orionSystem.id, planetId: orionPlanet.id }
    },
    planetCountByArchetype
  }

  const campaignStart = {
    ...JSON.parse(readFileSync(join(vanillaDir, 'campaign_start.json'), 'utf8')),
    homeSystemId
  }

  const npcCorps = [
    {
      id: 'corp_helion_mining',
      name: 'Helion Mining',
      factionId: 'faction_consortium',
      homeSystemId: helionSystem.id,
      startingCredits: 55000,
      startingStock: { ore: 120, machinery: 4, fuel: 40, energy: 80 },
      buildings: [{ planetId: helionPlanet.id, buildingType: 'mine' }],
      ships: [{ definitionId: 'ship_hauler_1', name: 'Helion Hauler' }],
      aiProfile: 'extractor'
    },
    {
      id: 'corp_orion_refining',
      name: 'Orion Refining',
      factionId: 'faction_frontier',
      homeSystemId: orionSystem.id,
      startingCredits: 48000,
      startingStock: { ore: 80, metal: 40, machinery: 3, energy: 60 },
      buildings: [{ planetId: orionPlanet.id, buildingType: 'refinery' }],
      aiProfile: 'refiner'
    }
  ]

  return { systems, planets, meta, campaignStart, npcCorps }
}

/** @param {ReturnType<typeof generateGalaxy>} galaxy */
export function validateGalaxy(galaxy) {
  const errors = []
  const { systems, planets, meta, campaignStart, npcCorps } = galaxy
  const profileIds = new Set(
    JSON.parse(readFileSync(join(vanillaDir, 'economic_profiles.json'), 'utf8')).map((p) => p.id)
  )
  const factionIds = new Set(
    JSON.parse(readFileSync(join(vanillaDir, 'factions.json'), 'utf8')).map((f) => f.id)
  )

  if (systems.length !== SYSTEM_COUNT) errors.push(`Expected ${SYSTEM_COUNT} systems, got ${systems.length}`)
  if (planets.length < PLANET_COUNT_MIN || planets.length > PLANET_COUNT_MAX) {
    errors.push(`Planet count ${planets.length} outside ${PLANET_COUNT_MIN}-${PLANET_COUNT_MAX}`)
  }

  const systemIds = new Set(systems.map((s) => s.id))
  const planetIds = new Set()
  for (const p of planets) {
    if (!systemIds.has(p.systemId)) errors.push(`Planet ${p.id} unknown system ${p.systemId}`)
    if (planetIds.has(p.id)) errors.push(`Duplicate planet id ${p.id}`)
    planetIds.add(p.id)
    if (p.economicProfileId && !profileIds.has(p.economicProfileId)) {
      errors.push(`Planet ${p.id} unknown profile ${p.economicProfileId}`)
    }
  }

  for (const s of systems) {
    const count = planets.filter((p) => p.systemId === s.id).length
    if (count < 1) errors.push(`System ${s.id} has no planets`)
    if (s.controllingFactionId && !factionIds.has(s.controllingFactionId)) {
      errors.push(`System ${s.id} unknown faction`)
    }
  }

  if (meta.systemCount !== systems.length) errors.push('meta.systemCount mismatch')
  if (meta.planetCount !== planets.length) errors.push('meta.planetCount mismatch')
  if (!systemIds.has(meta.homeSystemId)) errors.push('homeSystemId missing')
  if (!planetIds.has(meta.homePlanetId)) errors.push('homePlanetId missing')

  const homePlanet = planets.find((p) => p.id === meta.homePlanetId)
  if (!homePlanet || homePlanet.habitability < 0.5) {
    errors.push('home planet habitability too low')
  }

  if (campaignStart.homeSystemId !== meta.homeSystemId) {
    errors.push('campaign_start homeSystemId mismatch')
  }

  for (const corp of npcCorps) {
    if (!systemIds.has(corp.homeSystemId)) errors.push(`NPC ${corp.id} bad homeSystemId`)
    for (const b of corp.buildings) {
      if (!planetIds.has(b.planetId)) errors.push(`NPC ${corp.id} bad planetId ${b.planetId}`)
    }
  }

  if (meta.npcCorps.corp_helion_mining.homeSystemId === meta.npcCorps.corp_orion_refining.homeSystemId) {
    errors.push('NPC corps share the same home system')
  }

  const mst = mstEdges(systems)
  if (mst.length !== systems.length - 1) errors.push('MST connectivity failed')

  const homeSys = systems.find((s) => s.id === meta.homeSystemId)
  const neighbors = systems
    .filter((s) => s.id !== meta.homeSystemId)
    .map((s) => ({ s, d: systemDistanceCoords(homeSys, s) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 5)
  const diverseProfiles = new Set(
    neighbors.flatMap(({ s }) =>
      planets.filter((p) => p.systemId === s.id).map((p) => p.economicProfileId)
    )
  )
  if (diverseProfiles.size < 2) errors.push('Home system lacks nearby trade diversity')

  return errors
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

function writeGalaxy(galaxy) {
  writeFileSync(join(vanillaDir, 'systems.json'), stableJson(galaxy.systems))
  writeFileSync(join(vanillaDir, 'planets.json'), stableJson(galaxy.planets))
  writeFileSync(join(vanillaDir, 'galaxy-meta.json'), stableJson(galaxy.meta))
  writeFileSync(join(vanillaDir, 'campaign_start.json'), stableJson(galaxy.campaignStart))
  writeFileSync(join(vanillaDir, 'npc_corporations.json'), stableJson(galaxy.npcCorps))
  writeFileSync(
    join(vanillaDir, 'content_version.json'),
    stableJson({ version: 4, galaxySeed: GALAXY_SEED, generatorVersion: GENERATOR_VERSION })
  )
}

function hashFile(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function checkCommitted(galaxy) {
  const tempPaths = {
    systems: join(vanillaDir, 'systems.json'),
    planets: join(vanillaDir, 'planets.json'),
    meta: join(vanillaDir, 'galaxy-meta.json'),
    campaignStart: join(vanillaDir, 'campaign_start.json'),
    npcCorps: join(vanillaDir, 'npc_corporations.json')
  }
  const expected = {
    systems: stableJson(galaxy.systems),
    planets: stableJson(galaxy.planets),
    meta: stableJson(galaxy.meta),
    campaignStart: stableJson(galaxy.campaignStart),
    npcCorps: stableJson(galaxy.npcCorps)
  }
  for (const [key, path] of Object.entries(tempPaths)) {
    if (!existsSync(path)) {
      console.error(`[generate:galaxy] Missing ${path}`)
      process.exit(1)
    }
    const actual = readFileSync(path, 'utf8')
    if (actual !== expected[key]) {
      console.error(`[generate:galaxy] Drift in ${path} — run pnpm generate:galaxy`)
      process.exit(1)
    }
  }
  console.log('[generate:galaxy] --check OK')
}

const checkMode = process.argv.includes('--check')

const galaxy = generateGalaxy()
const errors = validateGalaxy(galaxy)
if (errors.length > 0) {
  console.error('[generate:galaxy] Validation failed:')
  for (const e of errors) console.error(`  - ${e}`)
  process.exit(1)
}

if (checkMode) {
  checkCommitted(galaxy)
} else {
  writeGalaxy(galaxy)
  console.log(
    `[generate:galaxy] Wrote ${galaxy.systems.length} systems, ${galaxy.planets.length} planets (home=${galaxy.meta.homeSystemId})`
  )
}
