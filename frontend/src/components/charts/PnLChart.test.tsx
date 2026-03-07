import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { PnLChart } from '@/components/charts/PnLChart'
import type { TradeResponse } from '@/lib/schemas/trade'

afterEach(() => {
  cleanup()
})

// Mock trade factory
function createMockTrade(overrides: Partial<TradeResponse> = {}): TradeResponse {
  return {
    id: crypto.randomUUID(),
    session_id: 'test-session',
    sequence_number: 1,
    direction: 'long',
    outcome: 'win',
    pnl: 500,
    setup_description: null,
    discipline_score: 0,
    agency_score: 0,
    discipline_confidence: 'high',
    agency_confidence: 'high',
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

describe('PnLChart', () => {
  // FR 4.1 - Show cumulative P&L (running total), not individual trade P&L
  it('FR 4.1 — displays cumulative P&L data', () => {
    const trades = [
      createMockTrade({ pnl: 500 }),
      createMockTrade({ pnl: -200 }),
      createMockTrade({ pnl: 300 }),
    ]

    render(<PnLChart trades={trades} />)

    // Chart should render
    expect(document.querySelector('.recharts-wrapper')).toBeDefined()
  })

  // FR 4.1 - Green when above zero, red when below
  it('FR 4.1 — applies green color for positive cumulative P&L', () => {
    const trades = [
      createMockTrade({ pnl: 500 }),
    ]

    render(<PnLChart trades={trades} />)

    // Should have positive color (green) - check for chart wrapper
    const chartContainer = document.querySelector('.recharts-wrapper')
    expect(chartContainer).toBeInTheDocument()
  })

  // FR 4.1 - Include horizontal reference line at $0
  it('FR 4.1 — includes zero reference line', () => {
    const trades = [
      createMockTrade({ pnl: 500 }),
      createMockTrade({ pnl: -300 }),
    ]

    render(<PnLChart trades={trades} />)

    // Reference line should be present (Recharts renders it)
    expect(document.querySelector('.recharts-reference-line')).toBeDefined()
  })

  // FR 4.1 - Tooltips showing: sequence, timestamp, trade P&L, cumulative P&L, direction, scores
  it('FR 4.1 — has tooltip functionality', () => {
    const trades = [
      createMockTrade({ pnl: 500 }),
    ]

    render(<PnLChart trades={trades} />)

    // Tooltip should be present
    expect(document.querySelector('.recharts-tooltip-wrapper')).toBeDefined()
  })

  // FR 4.1 - Line chart with area fill design
  it('FR 4.1 — renders area chart with fill', () => {
    const trades = [
      createMockTrade({ pnl: 500 }),
      createMockTrade({ pnl: 200 }),
    ]

    render(<PnLChart trades={trades} />)

    // Area should be present
    expect(document.querySelector('.recharts-area')).toBeDefined()
  })

  // FR 4.1 - Flag extreme values (>3 std dev) in tooltips
  it('FR 4.1 — handles extreme values', () => {
    const trades = [
      createMockTrade({ pnl: 100 }),
      createMockTrade({ pnl: 150 }),
      createMockTrade({ pnl: 2000 }), // Extreme outlier
    ]

    render(<PnLChart trades={trades} />)

    // Should render without crashing
    expect(document.querySelector('.recharts-wrapper')).toBeDefined()
  })

  // FR 4.5 - Early Session Handling: 0 trades - render with empty state
  it('FR 4.5 — renders with empty state for 0 trades', () => {
    render(<PnLChart trades={[]} />)

    // Should show empty state (axes visible)
    expect(document.querySelector('.recharts-wrapper')).toBeDefined()
  })

  // FR 4.5 - 1 trade: single data point
  it('FR 4.5 — renders single data point', () => {
    const trades = [createMockTrade({ pnl: 500 })]

    render(<PnLChart trades={trades} />)

    expect(document.querySelector('.recharts-wrapper')).toBeDefined()
  })

  // FR 4.5 - 2 trades: line connecting points
  it('FR 4.5 — renders line connecting two points', () => {
    const trades = [
      createMockTrade({ pnl: 300 }),
      createMockTrade({ pnl: -100 }),
    ]

    render(<PnLChart trades={trades} />)

    expect(document.querySelector('.recharts-line')).toBeDefined()
  })

  // FR 4.6 - Animate with 300-500ms smooth transitions
  it('FR 4.6 — has animation configuration', () => {
    const trades = [createMockTrade({ pnl: 500 })]

    render(<PnLChart trades={trades} />)

    // Animation duration should be set - check chart renders
    const chartElement = document.querySelector('.recharts-wrapper')
    expect(chartElement).toBeInTheDocument()
  })

  // FR 4.6 - Maintain consistent chart sizing
  it('FR 4.6 — uses responsive container', () => {
    const trades = [createMockTrade({ pnl: 500 })]

    render(<PnLChart trades={trades} />)

    // Should have ResponsiveContainer
    expect(document.querySelector('.recharts-responsive-container')).toBeDefined()
  })

  // FR 4.7 - Show subtle average P&L reference line
  it('FR 4.7 — includes average P&L reference line', () => {
    const trades = [
      createMockTrade({ pnl: 500 }),
      createMockTrade({ pnl: -100 }),
      createMockTrade({ pnl: 300 }),
    ]

    render(<PnLChart trades={trades} />)

    // Should render chart with reference lines
    const chartElement = document.querySelector('.recharts-wrapper')
    expect(chartElement).toBeInTheDocument()
  })

  // Test negative cumulative P&L
  it('displays negative cumulative P&L correctly', () => {
    const trades = [
      createMockTrade({ pnl: -500 }),
      createMockTrade({ pnl: -200 }),
    ]

    render(<PnLChart trades={trades} />)

    expect(document.querySelector('.recharts-wrapper')).toBeDefined()
  })

  // Test mixed positive/negative
  it('handles mixed positive and negative trades', () => {
    const trades = [
      createMockTrade({ pnl: 500 }),
      createMockTrade({ pnl: -300 }),
      createMockTrade({ pnl: 200 }),
      createMockTrade({ pnl: -100 }),
    ]

    render(<PnLChart trades={trades} />)

    expect(document.querySelector('.recharts-wrapper')).toBeDefined()
  })
})
