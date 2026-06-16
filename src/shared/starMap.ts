/** Map colors and timing constants for optional mod star-map UIs (see `getStarMap`). */
export const FACTION_MAP_COLORS: Record<string, string> = {
  faction_consortium: '#e3b341',
  faction_independents: '#4493f8',
  faction_frontier: '#f85149'
}

export const NEUTRAL_FACTION_COLOR = '#6e7681'
export const HOME_RING_COLOR = '#3fb950'

export const ECONOMY_HEAT_COLORS: Record<'surplus' | 'stable' | 'shortage', string> = {
  surplus: '#3fb950',
  stable: '#484f58',
  shortage: '#f85149'
}

export const EVENT_PULSE_COLOR = '#a371f7'
export const CONTRACT_HIGHLIGHT_COLOR = '#ffa657'
export const NPC_CONVOY_COLOR = '#79c0ff'

/** NPC convoys remain visible on the map for this many ticks. */
export const MAP_CONVOY_VISIBLE_TICKS = 3

/** Event warning rings show for this many ticks after firing. */
export const MAP_EVENT_PULSE_TICKS = 3

const FALLBACK_PALETTE = ['#a371f7', '#79c0ff', '#ffa657', '#7ee787', '#ff7b72']

export function factionMapColor(factionId: string | null | undefined, index: number): string {
  if (!factionId) return NEUTRAL_FACTION_COLOR
  return FACTION_MAP_COLORS[factionId] ?? FALLBACK_PALETTE[index % FALLBACK_PALETTE.length]!
}
