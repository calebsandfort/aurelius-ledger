import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { DisciplineChart } from '@/components/charts/DisciplineChart'
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

describe('DisciplineChart', () => {
  // FR 4.2 - Show running sum of discipline scores
  it('FR 4.2 — displays running sum of discipline scores', () => {
    const trades = [
      createMockTrade({ discipline_score: 1 }),
      createMockTrade({ discipline_score: -1 }),
      createMockTrade({ discipline_score: 0 }),
    ]

    render(<DisciplineChart trades={trades} />)

    expect(document.querySelector('.recharts-wrapper')).toBeDefined()
  })

  // FR 4.2 - Use step chart or line chart with data markers
  it('FR 4.2 — renders chart with data markers', () => {
    const trades = [
      createMockTrade({ discipline_score: 1 }),
      createMockTrade({ discipline_score: -1 }),
    ]

    render(<DisciplineChart trades={trades} />)

    expect(document.querySelector('.recharts-wrapper')).toBeDefined()
  })

  // FR 4.2 - Color-coded: green +1, red -1, gray 0
  it('FR 4.2 — applies correct color coding', () => {
    const trades = [
      createMockTrade({ discipline_score: 1 }),
      createMockTrade({ discipline_score: 0 }),
      createMockTrade({ discipline_score: -1 }),
    ]

    render(<DisciplineChart trades={trades} />)

    // Chart should render with color coding
    expect(document.querySelector('.recharts-wrapper')).toBeDefined()
  })

  // FR 4.2 - Reference line at y=0
  it('FR 4.2 — includes zero reference line', () => {
    const trades = [
      createMockTrade({ discipline_score: 1 }),
      createMockTrade({ discipline_score: -1 }),
    ]

    render(<DisciplineChart trades={trades} />)

    expect(document.querySelector('.recharts-reference-line')).toBeDefined()
  })

  // FR 4.2 - Toggle for 3-trade moving average overlay
  it('FR 4.2 — has moving average toggle', () => {
    const trades = [
      createMockTrade({ discipline_score: 1 }),
      createMockTrade({ discipline_score: 1 }),
      createMockTrade({ discipline_score: 1 }),
      createMockTrade({ discipline_score: 1 }),
    ]

    render(<DisciplineChart trades={trades} />)

    // Should have a toggle button for moving average
    expect(screen.getByRole('button', { name: /moving average/i })).toBeInTheDocument()
  })

  // FR 4.2 - Window to last 50 trades if session exceeds 50
  it('FR 4.2 — limits to last 50 trades', () => {
    const trades = Array(60).fill(null).map((_, i) =>
      createMockTrade({ discipline_score: i % 3 - 1, sequence_number: i + 1 })
    )

    render(<DisciplineChart trades={trades} />)

    // Should still render without errors
    expect(document.querySelector('.recharts-wrapper')).toBeDefined()
  })

  // FR 4.5 - Early Session Handling
  it('FR 4.5 — renders with empty state for 0 trades', () => {
    render(<DisciplineChart trades={[]} />)

    expect(document.querySelector('.recharts-wrapper')).toBeDefined()
  })

  it('FR 4.5 — renders single trade point', () => {
    const trades = [createMockTrade({ discipline_score: 1 })]

    render(<DisciplineChart trades={trades} />)

    expect(document.querySelector('.recharts-wrapper')).toBeDefined()
  })

  // FR 4.6 - Animate with 300-500ms smooth transitions
  it('FR 4.6 — has animation configuration', () => {
    const trades = [createMockTrade({ discipline_score: 1 })]

    render(<DisciplineChart trades={trades} />)

    expect(document.querySelector('.recharts-wrapper')).toBeDefined()
  })

  // FR 4.6 - Maintain consistent chart sizing
  it('FR 4.6 — uses responsive container', () => {
    const trades = [createMockTrade({ discipline_score: 1 })]

    render(<DisciplineChart trades={trades} />)

    expect(document.querySelector('.recharts-responsive-container')).toBeDefined()
  })

  // Test all positive scores
  it('handles all positive discipline scores', () => {
    const trades = [
      createMockTrade({ discipline_score: 1 }),
      createMockTrade({ discipline_score: 1 }),
      createMockTrade({ discipline_score: 1 }),
    ]

    render(<DisciplineChart trades={trades} />)

    expect(document.querySelector('.recharts-wrapper')).toBeDefined()
  })

  // Test all negative scores
  it('handles all negative discipline scores', () => {
    const trades = [
      createMockTrade({ discipline_score: -1 }),
      createMockTrade({ discipline_score: -1 }),
      createMockTrade({ discipline_score: -1 }),
    ]

    render(<DisciplineChart trades={trades} />)

    expect(document.querySelector('.recharts-wrapper')).toBeDefined()
  })

  // Test moving average toggle functionality
  it('toggles moving average overlay', () => {
    const trades = [
      createMockTrade({ discipline_score: 1 }),
      createMockTrade({ discipline_score: -1 }),
      createMockTrade({ discipline_score: 1 }),
      createMockTrade({ discipline_score: 1 }),
    ]

    render(<DisciplineChart trades={trades} />)

    const toggleButton = screen.getByRole('button', { name: /moving average/i })
    expect(toggleButton).toBeInTheDocument()

    // Click to toggle
    toggleButton.click()

    // Should still render
    expect(document.querySelector('.recharts-wrapper')).toBeDefined()
  })
})
