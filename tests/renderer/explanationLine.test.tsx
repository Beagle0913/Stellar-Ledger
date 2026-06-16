// @vitest-environment jsdom
import './setup.js'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ExplanationLine } from '../../src/renderer/components/ExplanationLine.js'
import type { Explanation } from '../../src/shared/explanations/types.js'

describe('ExplanationLine', () => {
  it('applies severity CSS classes', () => {
    const warning: Explanation = {
      code: 'market.price.rising.shortage',
      severity: 'warning',
      title: 'Price rising',
      message: 'Shortage pressure.'
    }
    const { container, rerender } = render(<ExplanationLine explanation={warning} />)
    expect(container.querySelector('.explanation-line.explanation-warning')).toBeTruthy()

    rerender(
      <ExplanationLine
        explanation={{ ...warning, severity: 'critical', code: 'error.internal' }}
      />
    )
    expect(container.querySelector('.explanation-critical')).toBeTruthy()

    rerender(
      <ExplanationLine explanation={{ ...warning, severity: 'info', code: 'objective.active.in_progress' }} />
    )
    expect(container.querySelector('.explanation-info')).toBeTruthy()
  })

  it('renders title and message when showTitle is set', () => {
    render(
      <ExplanationLine
        explanation={{
          code: 'production.idle.no_job',
          severity: 'info',
          title: 'Building idle',
          message: 'Your Smelter has no running or queued jobs.'
        }}
        showTitle
      />
    )
    expect(screen.getByText('Building idle')).toBeInTheDocument()
    expect(screen.getByText(/Smelter has no running/)).toBeInTheDocument()
  })
})
