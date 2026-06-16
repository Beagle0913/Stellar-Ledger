import { describe, expect, it } from 'vitest'
import {
  filterDashboardDigestForTickReport,
  isDashboardSectionExplanation
} from '../../src/renderer/dashboardDigestFilter.js'
import type { Explanation } from '../../src/shared/explanations/types.js'
import { TICK_DIGEST_MAX } from '../../src/shared/explanations/types.js'

function ex(code: Explanation['code'], message: string): Explanation {
  return { code, severity: 'info', title: 'T', message }
}

describe('isDashboardSectionExplanation', () => {
  it('treats market and event codes as section-owned', () => {
    expect(isDashboardSectionExplanation('market.price.rising.shortage')).toBe(true)
    expect(isDashboardSectionExplanation('event.fired.trigger_match')).toBe(true)
  })

  it('does not treat other families as section-owned', () => {
    expect(isDashboardSectionExplanation('production.idle.no_job')).toBe(false)
    expect(isDashboardSectionExplanation('objective.locked.requires_prerequisite')).toBe(false)
  })
})

describe('filterDashboardDigestForTickReport', () => {
  it('removes market and event items shown elsewhere on the Dashboard', () => {
    const digest = [
      ex('market.price.rising.shortage', 'Market msg'),
      ex('event.fired.trigger_match', 'Event msg'),
      ex('production.idle.no_job', 'Idle smelter')
    ]
    const filtered = filterDashboardDigestForTickReport(digest)
    expect(filtered).toHaveLength(1)
    expect(filtered[0]!.code).toBe('production.idle.no_job')
  })

  it('returns empty when digest is only market and event explanations', () => {
    const digest = [
      ex('market.price.falling.surplus', 'A'),
      ex('event.blocked.cooldown', 'B')
    ]
    expect(filterDashboardDigestForTickReport(digest)).toEqual([])
  })

  it('preserves the max digest cap after filtering', () => {
    const digest = Array.from({ length: TICK_DIGEST_MAX + 4 }, (_, i) =>
      ex('production.idle.no_job', `Idle ${i}`)
    )
    expect(filterDashboardDigestForTickReport(digest)).toHaveLength(TICK_DIGEST_MAX)
  })
})
