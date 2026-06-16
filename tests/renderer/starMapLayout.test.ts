import { describe, expect, it } from 'vitest'
import {
  computeMapViewBox,
  interpolateArcPoint,
  shouldShowLabel,
  transportArcPosition
} from '../../src/renderer/starMapLayout.js'
import type { StarMapTransportArc } from '../../src/shared/types.js'

describe('starMapLayout', () => {
  it('computeMapViewBox pads system coordinates', () => {
    const box = computeMapViewBox([
      { x: 100, y: 200 },
      { x: 300, y: 400 }
    ])
    expect(box.minX).toBe(60)
    expect(box.minY).toBe(160)
    expect(box.width).toBe(280)
    expect(box.height).toBe(280)
  })

  it('computeMapViewBox returns default for empty systems', () => {
    const box = computeMapViewBox([])
    expect(box).toEqual({ minX: 0, minY: 0, width: 100, height: 100 })
  })

  it('interpolateArcPoint clamps progress', () => {
    expect(interpolateArcPoint(0, 0, 100, 100, 0.5)).toEqual({ x: 50, y: 50 })
    expect(interpolateArcPoint(0, 0, 100, 100, 2)).toEqual({ x: 100, y: 100 })
  })

  it('transportArcPosition uses arc progressFraction', () => {
    const arc: StarMapTransportArc = {
      jobId: 'j1',
      originSystemId: 'a',
      originX: 0,
      originY: 0,
      destinationSystemId: 'b',
      destinationX: 100,
      destinationY: 0,
      progressFraction: 0.25,
      itemName: 'Ore',
      quantity: 5
    }
    expect(transportArcPosition(arc)).toEqual({ x: 25, y: 0 })
  })

  it('shouldShowLabel follows selected, home, hover, and show-all rules', () => {
    const helion = { id: 'sys_helion', isHome: true }
    const cinder = { id: 'sys_cinder', isHome: false }

    expect(
      shouldShowLabel(cinder, {
        selectedSystemId: null,
        hoveredSystemId: null,
        showAllLabels: false
      })
    ).toBe(false)

    expect(
      shouldShowLabel(helion, {
        selectedSystemId: null,
        hoveredSystemId: null,
        showAllLabels: false
      })
    ).toBe(true)

    expect(
      shouldShowLabel(cinder, {
        selectedSystemId: 'sys_cinder',
        hoveredSystemId: null,
        showAllLabels: false
      })
    ).toBe(true)

    expect(
      shouldShowLabel(cinder, {
        selectedSystemId: null,
        hoveredSystemId: 'sys_cinder',
        showAllLabels: false
      })
    ).toBe(true)

    expect(
      shouldShowLabel(cinder, {
        selectedSystemId: null,
        hoveredSystemId: null,
        showAllLabels: true
      })
    ).toBe(true)
  })
})
