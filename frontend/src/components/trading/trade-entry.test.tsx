import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { TradeEntry } from './TradeEntry'
import type { TradeResponse } from '@/lib/schemas/trade'

// Mock the useOptimisticTrades hook
vi.mock('@/hooks/useOptimisticTrades', () => ({
  useOptimisticTrades: () => ({
    pendingTrades: new Map(),
    addOptimisticTrade: vi.fn((tempId: string, rawInput: string) => ({
      id: tempId,
      session_id: 'mock-session',
      sequence_number: -1,
      direction: 'long' as const,
      outcome: 'win' as const,
      pnl: 0,
      setup_description: null,
      discipline_score: 0,
      agency_score: 0,
      discipline_confidence: 'low' as const,
      agency_confidence: 'low' as const,
      created_at: new Date().toISOString(),
      raw_input: rawInput,
    })),
    resolveTrade: vi.fn(),
    rejectTrade: vi.fn(),
  }),
}))

// Mock trade data factory
function createMockTradeResponse(overrides: Partial<TradeResponse> = {}): TradeResponse {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    session_id: '550e8400-e29b-41d4-a716-446655440001',
    sequence_number: 1,
    direction: 'long',
    outcome: 'win',
    pnl: 500,
    setup_description: 'Test setup',
    discipline_score: 1,
    agency_score: 1,
    discipline_confidence: 'high',
    agency_confidence: 'high',
    created_at: '2024-01-15T10:30:00.000Z',
    ...overrides,
  }
}

// Helper to get the first input element (handles double-rendering in test environment)
function getTradeInput() {
  const inputs = screen.getAllByPlaceholderText(/describe your trade/i)
  return inputs[0]
}

// Helper to get the submit button
function getSubmitButton() {
  const buttons = screen.getAllByRole('button', { name: /log trade/i })
  return buttons[0]
}

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('TradeEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // FR 1.0 - The system SHALL provide a persistent text input at the bottom of the dashboard
  it('FR 1.0 — renders text input for trade description', () => {
    render(<TradeEntry />)

    const input = getTradeInput()
    expect(input).toBeInTheDocument()
  })

  // FR 1.1 - The system SHALL accept any natural language text describing a trade
  it('FR 1.1 — accepts natural language input', async () => {
    render(<TradeEntry />)

    const input = getTradeInput()
    const testInput = 'Long NQ at 17800, exited at 17850 for +$500 profit. Stuck to my trading plan.'

    fireEvent.change(input, { target: { value: testInput } })

    expect(input).toHaveValue(testInput)
  })

  // FR 1.2 - The system SHALL clear the input field upon successful submission
  it('FR 1.3 — clears input after successful submission', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: createMockTradeResponse({ id: 'new-trade-id' }),
        meta: { sequence_number: 1 },
      }),
    })

    render(<TradeEntry />)

    const input = getTradeInput()
    fireEvent.change(input, { target: { value: 'Long NQ at 17800' } })

    const submitButton = getSubmitButton()
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(input).toHaveValue('')
    })
  })

  // FR 1.4 - The system SHALL display a visual confirmation (green flash) upon successful trade logging
  it('FR 1.4 — shows green flash on successful submission', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: createMockTradeResponse(),
        meta: { sequence_number: 1 },
      }),
    })

    render(<TradeEntry />)

    const input = getTradeInput()
    fireEvent.change(input, { target: { value: 'Long NQ at 17800' } })

    const submitButton = getSubmitButton()
    fireEvent.click(submitButton)

    // Wait for success state
    await waitFor(() => {
      // The component should show a success indication (green flash)
      // This could be tested by checking for a class or text
      expect(screen.queryByText(/logged/i)).toBeInTheDocument()
    })
  })

  // FR 1.5 - The input field SHALL auto-focus after each submission to enable rapid logging
  it('FR 1.5 — auto-focuses input after submission', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: createMockTradeResponse(),
        meta: { sequence_number: 1 },
      }),
    })

    render(<TradeEntry />)

    const input = getTradeInput()
    fireEvent.change(input, { target: { value: 'Long NQ at 17800' } })

    const submitButton = getSubmitButton()
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(input).toHaveFocus()
    })
  })

  // FR 1.6 - The input SHALL remain fixed at the bottom of the screen
  it('FR 1.6 — component is fixed at bottom of screen', () => {
    render(<TradeEntry />)

    const container = screen.getByTestId('trade-entry-container')
    expect(container).toHaveClass('fixed')
    expect(container).toHaveClass('bottom-0')
  })

  // FR 1.2.1 - The system SHALL use optimistic UI updates
  it('FR 1.2.1 — adds optimistic trade immediately on submit', async () => {
    const mockAddOptimisticTrade = vi.fn((tempId: string, rawInput: string) => ({
      id: tempId,
      session_id: 'mock-session',
      sequence_number: -1,
      direction: 'long' as const,
      outcome: 'win' as const,
      pnl: 0,
      setup_description: null,
      discipline_score: 0,
      agency_score: 0,
      discipline_confidence: 'low' as const,
      agency_confidence: 'low' as const,
      created_at: new Date().toISOString(),
      raw_input: rawInput,
    }))

    vi.mocked(require('@/hooks/useOptimisticTrades').useOptimisticTrades).mockReturnValue({
      pendingTrades: new Map(),
      addOptimisticTrade: mockAddOptimisticTrade,
      resolveTrade: vi.fn(),
      rejectTrade: vi.fn(),
    })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: createMockTradeResponse(),
        meta: { sequence_number: 1 },
      }),
    })

    render(<TradeEntry />)

    const input = getTradeInput()
    fireEvent.change(input, { target: { value: 'Long NQ at 17800' } })

    const submitButton = getSubmitButton()
    fireEvent.click(submitButton)

    expect(mockAddOptimisticTrade).toHaveBeenCalled()
  })

  // FR 1.2.3 - The system SHALL show a loading state during trade processing
  it('FR 1.2.3 — shows loading state during submission', async () => {
    // Create a slow promise that we can control
    let resolveSlow: (value: Response) => void
    const slowPromise = new Promise<Response>((resolve) => {
      resolveSlow = resolve
    })
    mockFetch.mockReturnValue(slowPromise as unknown as ReturnType<typeof fetch>)

    render(<TradeEntry />)

    const input = getTradeInput()
    fireEvent.change(input, { target: { value: 'Long NQ at 17800' } })

    const submitButton = getSubmitButton()
    fireEvent.click(submitButton)

    // Button should be disabled during loading
    await waitFor(() => {
      expect(submitButton).toBeDisabled()
    })

    // Resolve the promise
    act(() => {
      resolveSlow!({
        ok: true,
        json: async () => ({
          data: createMockTradeResponse(),
          meta: { sequence_number: 1 },
        }),
      } as unknown as Response)
    })

    // Button should be enabled again after loading
    await waitFor(() => {
      expect(submitButton).not.toBeDisabled()
    })
  })

  // Test that empty input is not submitted
  it('prevents submission of empty input', async () => {
    render(<TradeEntry />)

    const submitButton = getSubmitButton()
    fireEvent.click(submitButton)

    // Fetch should not be called
    expect(mockFetch).not.toHaveBeenCalled()
  })

  // Test submission with Enter key
  it('submits form on Enter key press', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: createMockTradeResponse(),
        meta: { sequence_number: 1 },
      }),
    })

    render(<TradeEntry />)

    const input = getTradeInput()
    fireEvent.change(input, { target: { value: 'Long NQ at 17800' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })
  })

  // Test that input is trimmed before submission
  it('trims whitespace from input before submission', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: createMockTradeResponse(),
        meta: { sequence_number: 1 },
      }),
    })

    render(<TradeEntry />)

    const input = getTradeInput()
    fireEvent.change(input, { target: { value: '   Long NQ at 17800   ' } })

    const submitButton = getSubmitButton()
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/trades',
        expect.objectContaining({
          body: JSON.stringify({ raw_input: 'Long NQ at 17800' }),
        })
      )
    })
  })

  // Test error handling
  it('handles API errors gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal server error' }),
    })

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<TradeEntry />)

    const input = getTradeInput()
    fireEvent.change(input, { target: { value: 'Long NQ at 17800' } })

    const submitButton = getSubmitButton()
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalled()
    })

    consoleErrorSpy.mockRestore()
  })
})
