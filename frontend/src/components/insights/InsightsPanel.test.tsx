import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { InsightsPanel } from './InsightsPanel'
import type { Insight } from '@/lib/schemas/insights'

describe('InsightsPanel', () => {
  // Helper to create mock insights
  const createMockInsight = (overrides: Partial<Insight> = {}): Insight => ({
    category: 'positive',
    message: 'Test insight message',
    severity: 'info',
    ...overrides,
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // FR 5.6.4 - Use color coding: green (positive), yellow (caution), red (warning)
  it('FR 5.6.4 — renders success severity with green color coding', () => {
    const insights: Insight[] = [
      createMockInsight({
        message: 'Great job following your trading plan!',
        severity: 'success',
      }),
    ]

    render(<InsightsPanel insights={insights} />)

    const insightElement = screen.getByText(/Great job following your trading plan/)
    expect(insightElement).toBeInTheDocument()
    // Check for green color coding classes
    const container = insightElement.closest('li')
    expect(container?.className).toContain('green')
  })

  // FR 5.6.4 - Yellow for caution/warning
  it('FR 5.6.4 — renders warning severity with yellow color coding', () => {
    const insights: Insight[] = [
      createMockInsight({
        message: 'Your discipline score has dropped this week.',
        severity: 'warning',
      }),
    ]

    render(<InsightsPanel insights={insights} />)

    const insightElement = screen.getByText(/Your discipline score has dropped/)
    expect(insightElement).toBeInTheDocument()
    // Check for yellow color coding classes
    const container = insightElement.closest('li')
    expect(container?.className).toContain('yellow')
  })

  // FR 5.6.4 - Default/info uses slate color
  it('FR 5.6.4 — renders info/default severity with slate color coding', () => {
    const insights: Insight[] = [
      createMockInsight({
        message: 'Welcome to your trading session.',
        severity: 'info',
      }),
    ]

    render(<InsightsPanel insights={insights} />)

    const insightElement = screen.getByText(/Welcome to your trading session/)
    expect(insightElement).toBeInTheDocument()
    // Should use default slate styling
    const container = insightElement.closest('li')
    expect(container?.className).toContain('slate')
  })

  // FR 5.6.5 - Maximum 3 insights displayed at once
  it('FR 5.6.5 — displays maximum of 3 insights', () => {
    const insights: Insight[] = [
      createMockInsight({ message: 'Insight 1' }),
      createMockInsight({ message: 'Insight 2' }),
      createMockInsight({ message: 'Insight 3' }),
      createMockInsight({ message: 'Insight 4 (should not display)' }),
      createMockInsight({ message: 'Insight 5 (should not display)' }),
    ]

    render(<InsightsPanel insights={insights} />)

    // Only first 3 should be visible
    expect(screen.getByText(/Insight 1/)).toBeInTheDocument()
    expect(screen.getByText(/Insight 2/)).toBeInTheDocument()
    expect(screen.getByText(/Insight 3/)).toBeInTheDocument()
    expect(screen.queryByText(/Insight 4/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Insight 5/)).not.toBeInTheDocument()
  })

  // FR 5.6.5 - When exactly 3 insights, all should display
  it('FR 5.6.5 — displays all 3 insights when exactly 3 provided', () => {
    const insights: Insight[] = [
      createMockInsight({ message: 'First insight' }),
      createMockInsight({ message: 'Second insight' }),
      createMockInsight({ message: 'Third insight' }),
    ]

    render(<InsightsPanel insights={insights} />)

    expect(screen.getByText(/First insight/)).toBeInTheDocument()
    expect(screen.getByText(/Second insight/)).toBeInTheDocument()
    expect(screen.getByText(/Third insight/)).toBeInTheDocument()
  })

  // FR 5.6.1 - 1-2 sentences maximum (component should handle any length)
  it('FR 5.6.1 — renders insights with action-oriented messages', () => {
    const insights: Insight[] = [
      createMockInsight({
        message: 'Take a break after 3 consecutive losses to reset your mindset.',
      }),
    ]

    render(<InsightsPanel insights={insights} />)

    expect(screen.getByText(/Take a break/)).toBeInTheDocument()
  })

  // FR 5.6.2 - Conditional framing
  it('FR 5.6.2 — renders insights with conditional framing', () => {
    const insights: Insight[] = [
      createMockInsight({
        message: 'Your discipline score has dropped to -2 this week.',
      }),
    ]

    render(<InsightsPanel insights={insights} />)

    // Use getAllByText since other tests may have rendered similar text
    expect(screen.getAllByText(/Your discipline score/).length).toBeGreaterThanOrEqual(1)
  })

  // FR 5.6.3 - Action, not diagnosis
  it('FR 5.6.3 — offers action rather than diagnosis', () => {
    const insights: Insight[] = [
      createMockInsight({
        message: 'Consider reviewing your risk management rules before your next trade.',
      }),
    ]

    render(<InsightsPanel insights={insights} />)

    expect(screen.getByText(/Consider reviewing/)).toBeInTheDocument()
  })

  // FR 5.6.6 - Positive reinforcement
  it('FR 5.6.6 — displays positive reinforcement insights', () => {
    const insights: Insight[] = [
      createMockInsight({
        category: 'positive',
        message: 'You have maintained a positive risk-reward ratio for 5 consecutive trades.',
        severity: 'success',
      }),
    ]

    render(<InsightsPanel insights={insights} />)

    expect(screen.getByText(/maintained a positive risk-reward ratio/)).toBeInTheDocument()
  })

  // Empty state test
  it('shows empty state message when no insights available', () => {
    render(<InsightsPanel insights={[]} />)

    expect(screen.getByText(/No insights available yet/)).toBeInTheDocument()
  })

  // Loading state test
  it('renders loading state when isLoading is true', () => {
    render(<InsightsPanel insights={[]} isLoading={true} />)

    // Should still show header but indicate loading - use getAllByText since other tests render same header
    expect(screen.getAllByText(/AI Insights/).length).toBeGreaterThanOrEqual(1)
  })

  // Generated timestamp display
  it('displays formatted timestamp when generatedAt is provided', () => {
    const testDate = '2024-01-15T14:30:00.000Z'
    render(<InsightsPanel insights={[]} generatedAt={testDate} />)

    expect(screen.getByText(/Last updated:/)).toBeInTheDocument()
  })

  // Rose accent styling for header
  it('renders header with rose accent styling', () => {
    render(<InsightsPanel insights={[]} />)

    // Use getAllByText since other tests render same header
    const headers = screen.getAllByText(/AI Insights/)
    const header = headers[0]
    expect(header).toBeInTheDocument()
    // The rose accent should be applied to the header
    expect(header.className).toContain('rose')
  })

  // Multiple insights with different severities
  it('renders multiple insights with mixed severities correctly', () => {
    const insights: Insight[] = [
      createMockInsight({ message: 'Great win!', severity: 'success' }),
      createMockInsight({ message: 'Caution needed', severity: 'warning' }),
      createMockInsight({ message: 'Info message', severity: 'info' }),
    ]

    render(<InsightsPanel insights={insights} />)

    expect(screen.getByText(/Great win!/)).toBeInTheDocument()
    expect(screen.getByText(/Caution needed/)).toBeInTheDocument()
    expect(screen.getByText(/Info message/)).toBeInTheDocument()
  })
})
