import type { StarMapSystemView, StarMapTransportArc } from '../shared/types'

export interface MapViewBox {
  minX: number
  minY: number
  width: number
  height: number
}

export function computeMapViewBox(
  systems: Pick<StarMapSystemView, 'x' | 'y'>[],
  padding = 40
): MapViewBox {
  if (systems.length === 0) {
    return { minX: 0, minY: 0, width: 100, height: 100 }
  }
  let minX = systems[0]!.x
  let maxX = systems[0]!.x
  let minY = systems[0]!.y
  let maxY = systems[0]!.y
  for (const s of systems) {
    minX = Math.min(minX, s.x)
    maxX = Math.max(maxX, s.x)
    minY = Math.min(minY, s.y)
    maxY = Math.max(maxY, s.y)
  }
  return {
    minX: minX - padding,
    minY: minY - padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2
  }
}

export function interpolateArcPoint(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  t: number
): { x: number; y: number } {
  const clamped = Math.min(1, Math.max(0, t))
  return {
    x: x1 + (x2 - x1) * clamped,
    y: y1 + (y2 - y1) * clamped
  }
}

export function transportArcPosition(arc: StarMapTransportArc): { x: number; y: number } {
  return interpolateArcPoint(
    arc.originX,
    arc.originY,
    arc.destinationX,
    arc.destinationY,
    arc.progressFraction
  )
}

export function shouldShowLabel(
  system: Pick<StarMapSystemView, 'id' | 'isHome'>,
  options: {
    selectedSystemId: string | null
    hoveredSystemId: string | null
    showAllLabels: boolean
  }
): boolean {
  if (options.showAllLabels) return true
  if (options.selectedSystemId === system.id) return true
  if (system.isHome) return true
  if (options.hoveredSystemId === system.id) return true
  return false
}
