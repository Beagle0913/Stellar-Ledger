/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PriceChart } from '../../src/renderer/components/PriceChart'

describe('PriceChart', () => {
  it('renders empty state', () => {
    render(<PriceChart points={[]} />)
    expect(screen.getByText(/No recorded prices yet/i)).toBeTruthy()
  })

  it('renders points and range controls', () => {
    render(
      <PriceChart
        points={[
          { tick: 1, price: 10 },
          { tick: 2, price: 12, reason: 'stable' }
        ]}
      />
    )
    expect(screen.getByRole('img', { name: /price history chart/i })).toBeTruthy()
    expect(screen.getByText('7d')).toBeTruthy()
    expect(screen.getByText('last 12 (day 2)')).toBeTruthy()
  })
})
