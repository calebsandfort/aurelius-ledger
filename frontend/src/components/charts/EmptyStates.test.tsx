import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { EmptyStates } from '@/components/charts/EmptyStates'

afterEach(() => {
  cleanup()
})

describe('EmptyStates', () => {
  // FR 4.5 - 0 trades: placeholder with "Log your first trade..."
  it('FR 4.5 — renders zero trades message', () => {
    render(<EmptyStates tradeCount={0} />)

    expect(screen.getByText(/log your first trade/i)).toBeInTheDocument()
  })

  // FR 4.5 - 1 trade: single data point with "1 trade logged..."
  it('FR 4.5 — renders single trade message', () => {
    render(<EmptyStates tradeCount={1} />)

    expect(screen.getByText(/1 trade logged/i)).toBeInTheDocument()
  })

  // FR 4.5 - 2 trades: line connecting points with "2 trades..."
  it('FR 4.5 — renders two trades message', () => {
    render(<EmptyStates tradeCount={2} />)

    expect(screen.getByText(/2 trades/i)).toBeInTheDocument()
  })

  // FR 4.5 - Clearly indicate 5+ trade threshold
  it('FR 4.5 — indicates threshold at 5 trades', () => {
    render(<EmptyStates tradeCount={5} />)

    // At 5 trades, should not show early session placeholder
    expect(screen.queryByText(/log your first trade/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/1 trade logged/i)).not.toBeInTheDocument()
  })

  // Test different trade counts
  it('renders nothing for trade count >= 5', () => {
    const { container } = render(<EmptyStates tradeCount={10} />)

    // Should render empty container (no placeholder)
    expect(container.firstChild).toBeNull()
  })

  it('handles negative trade count gracefully', () => {
    const { container } = render(<EmptyStates tradeCount={-1} />)

    expect(container.firstChild).toBeNull()
  })
})
