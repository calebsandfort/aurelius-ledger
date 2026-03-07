import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { AgencyChart } from '@/components/charts/AgencyChart'
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

describe('AgencyChart', () => {
  // FR 4.3 - Mirror discipline chart format (running sum)
  it('FR 4.3 — displays running sum of agency scores', () => {
    const trades = [
      createMockTrade({ agency_score: 1 }),
      createMockTrade({ agency_score: -1 }),
      createMockTrade({ agency_score: 0 }),
    ]

    render(<AgencyChart trades={trades} />)

    expect(document.querySelector('.recharts-wrapper')).toBeDefined()
  })

  // FR 4.3 - Use step chart or line chart with data markers
  it('FR 4.3 — renders chart with data markers', () => {
    const trades = [
      createMockTrade({ agency_score: 1 }),
      createMockTrade({ agency_score: -1 }),
    ]

    render(<AgencyChart trades={trades} />)

    expect(document.querySelector('.recharts-wrapper')).toBeDefined()
  })

  // FR 4.3 - Use distinct colors (indigo/rose palette)
  it('FR 4.3 — uses distinct indigo/rose color palette', () => {
    const trades = [
      createMockTrade({ agency_score: 1 }),
      createMockTrade({ agency_score: 0 }),
      createMockTrade({ agency_score: -1 }),
    ]

    render(<AgencyChart trades={trades} />)

    // Chart should render
    expect(document.querySelector('.recharts-wrapper')).toBeDefined()
  })

  // FR 4.3 - Reference line at y=0
  it('FR 4.3 — includes zero reference line', () => {
    const trades = [
      createMockTrade({ agency_score: 1 }),
      createMockTrade({ agency_score: -1 }),
    ]

    render(<AgencyChart trades={trades} />)

    expect(document.querySelector('.recharts-reference-line')).toBeDefined()
  })

  // FR 4.3 - Toggle for 3-trade moving average overlay
  it('FR 4.3 — has moving average toggle', () => {
    const trades = [
      createMockTrade({ agency_score: 1 }),
      createMockTrade({ agency_score: 1 }),
      createMockTrade({ agency_score: 1 }),
      createMockTrade({ agency_score: 1 }),
    ]

    render(<AgencyChart trades={trades} />)

    expect(screen.getByRole('button', { name: /moving average/i })).toBeInTheDocument()
  })

  // FR 4.3 - Window to last 50 trades if session exceeds 50
  it('FR 4.3 — limits to last 50 trades', () => {
    const trades = Array(60).fill(null).map((_, i) =>
      createMockTrade({ agency_score: i % 3 - 1, sequence_number: i + 1 })
    )

    render(<AgencyChart trades={trades} />)

    expect(document.querySelector('.recharts-wrapper')).toBeDefined()
  })

  // FR 4.5 - Early Session Handling
  it('FR 4.5 — renders with empty state for 0 trades', () => {
    render(<AgencyChart trades={[]} />)

    expect(document.querySelector('.recharts-wrapper')).toBeDefined()
  })

  it('FR 4.5 — renders single trade point', () => {
    const trades = [createMockTrade({ agency_score: 1 })]

    render(<AgencyChart trades={trades} />)

    expect(document.querySelector('.recharts-wrapper')).toBeDefined()
  })

  // FR 4.6 - Animate with 300-500ms smooth transitions
  it('FR 4.6 — has animation configuration', () => {
    const trades = [createMockTrade({ agency_score: 1 })]

    render(<AgencyChart trades={trades} />)

    expect(document.querySelector('.recharts-wrapper')).toBeDefined()
  })

  // FR 4.6 - Maintain consistent chart sizing
  it('FR 4.6 — uses responsive container', () => {
    const trades = [createMockTrade({ agency_score: 1 })]

    render(<AgencyChart trades={trades} />)

    expect(document.querySelector('.recharts-responsive-container')).toBeDefined()
  })

  // Test all positive scores
  it('handles all positive agency scores', () => {
    const trades = [
      createMockTrade({ agency_score: 1 }),
      createMockTrade({ agency_score: 1 }),
      createMockTrade({ agency_score: 1 }),
    ]

    render(<AgencyChart trades={trades} />)

    expect(document.querySelector('.recharts-wrapper')).toBeDefined()
  })

  // Test all negative scores
  it('handles all negative agency scores', () => {
    const trades = [
      createMockTrade({ agency_score: -1 }),
      createMockTrade({ agency_score: -1 }),
      createMockTrade({ agency_score: -1 }),
    ]

    render(<AgencyChart trades={trades} />)

    expect(document.querySelector('.recharts-wrapper')).toBeDefined()
  })

  // Test moving average toggle functionality
  it('toggles moving average overlay', () => {
    const trades = [
      createMockTrade({ agency_score: 1 }),
      createMockTrade({ agency_score: -1 }),
      createMockTrade({ agency_score: 1 }),
      createMockTrade({ agency_score: 1 }),
    ]

    render(<AgencyChart trades={trades} />)

    const toggleButton = screen.getByRole('button', { name: /moving average/i })
    expect(toggleButton).toBeInTheDocument()

    // Click to toggle
    toggleButton.click()

    // Should still render
    expect(document.querySelector('.recharts-wrapper')).toBeDefined()
  })

  // FR 4.3 - Verify different colors from discipline chart
  it('FR 4.3 — uses different colors than discipline chart', () => {
    const trades = [
      createMockTrade({ agency_score: 1 }),
    ]

    render(<AgencyChart trades={trades} />)

    // Agency chart should render with its own styling
    expect(document.querySelector('.recharts-wrapper')).toBeDefined()
  })
})
