import { describe, expect, it } from 'vitest'
import { explainObjectiveView } from '../../src/shared/explanations/objectives.js'
import { buildObjectiveViews } from '../../src/simulation/progression.js'
import { newGame } from '../helpers.js'

describe('explainObjectiveView', () => {
  it('explains locked objective with prerequisite title', () => {
    const state = newGame()
    const views = buildObjectiveViews(state)
    const convoy = views.find((o) => o.id === 'obj_arc_convoy')!
    expect(convoy.explanation?.code).toBe('objective.locked.requires_prerequisite')
    expect(convoy.explanation?.message).toMatch(/2,000|Earn/)
  })

  it('returns null for unlocked active objectives', () => {
    const state = newGame()
    const views = buildObjectiveViews(state)
    const first = views.find((o) => o.id === 'obj_arc_first_metal')!
    expect(explainObjectiveView(state, first)).toBeNull()
  })
})
