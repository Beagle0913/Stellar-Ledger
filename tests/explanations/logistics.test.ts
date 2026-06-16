import { describe, expect, it } from 'vitest'
import {
  explainTransportBlockFromMessage,
  explainTransportInTransit
} from '../../src/shared/explanations/logistics.js'

describe('logistics explanations', () => {
  it('maps fuel block message', () => {
    const ex = explainTransportBlockFromMessage('Not enough Fuel in origin system (need 15, have 6).')
    expect(ex.code).toBe('logistics.blocked.insufficient_fuel')
  })

  it('maps same-system block', () => {
    const ex = explainTransportBlockFromMessage('Origin and destination must differ.')
    expect(ex.code).toBe('logistics.blocked.same_system')
  })

  it('explains in-transit ETA', () => {
    const ex = explainTransportInTransit(
      {
        id: 't1',
        shipId: 's1',
        originSystemId: 'a',
        destinationSystemId: 'b',
        itemId: 'ore',
        quantity: 10,
        progress: 2,
        distance: 5,
        fuelCost: 10,
        status: 'running',
        ownerId: 'corp'
      },
      'Helion',
      'Nexus'
    )
    expect(ex.code).toBe('logistics.in_transit.days_remaining')
    expect(ex.message).toContain('3/5')
  })
})
