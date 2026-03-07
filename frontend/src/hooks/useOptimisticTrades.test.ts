import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useOptimisticTrades } from './useOptimisticTrades'
import type { TradeResponse } from '@/lib/schemas/trade'

// Mock trade data factory
function createMockTrade(overrides: Partial<TradeResponse> = {}): TradeResponse {
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

describe('useOptimisticTrades', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // FR 1.2.1 - The system SHALL use optimistic UI updates, displaying the submitted trade data immediately
  it('FR 1.2.1 — adds optimistic trade immediately to pendingTrades', () => {
    const { result } = renderHook(() => useOptimisticTrades())

    const tempId = 'temp-1'
    const rawInput = 'Long NQ at 17800, exited at 17850 for +$500'

    act(() => {
      result.current.addOptimisticTrade(tempId, rawInput)
    })

    expect(result.current.pendingTrades.has(tempId)).toBe(true)
    const optimisticTrade = result.current.pendingTrades.get(tempId)
    expect(optimisticTrade?.raw_input).toBe(rawInput)
    expect(optimisticTrade?.sequence_number).toBe(-1) // Placeholder for optimistic trades
  })

  // FR 1.2.1 - Optimistic trades should be displayed immediately
  it('FR 1.2.1 — optimistic trade has pending/placeholder data', () => {
    const { result } = renderHook(() => useOptimisticTrades())

    const tempId = 'temp-2'
    const rawInput = 'Short ES at 4800, stopped out for -$250'

    act(() => {
      result.current.addOptimisticTrade(tempId, rawInput)
    })

    const optimisticTrade = result.current.pendingTrades.get(tempId)
    expect(optimisticTrade).toBeDefined()
    expect(optimisticTrade?.direction).toBe('long') // Default direction
    expect(optimisticTrade?.outcome).toBe('win') // Default outcome
    expect(optimisticTrade?.pnl).toBe(0) // Default PnL - will be updated by AI
    expect(optimisticTrade?.raw_input).toBe(rawInput)
  })

  // FR 1.2.2 - The system SHALL sync with the server response after submission to ensure consistency
  it('FR 1.2.2 — resolves pending trade with actual server response', () => {
    const { result } = renderHook(() => useOptimisticTrades())

    const tempId = 'temp-3'
    const rawInput = 'Long NQ at 17800'

    // Add optimistic trade first
    act(() => {
      result.current.addOptimisticTrade(tempId, rawInput)
    })

    // Simulate server response
    const serverResponse = createMockTrade({
      id: '550e8400-e29b-41d4-a716-446655440099',
      sequence_number: 5,
      pnl: 750,
      direction: 'long',
      outcome: 'win',
    })

    act(() => {
      result.current.resolveTrade(tempId, serverResponse)
    })

    // Trade should be resolved and removed from pending
    expect(result.current.pendingTrades.has(tempId)).toBe(false)
  })

  // FR 1.2.2 - Server response syncs properly
  it('FR 1.2.2 — resolveTrade replaces optimistic data with actual data', () => {
    const { result } = renderHook(() => useOptimisticTrades())

    const tempId = 'temp-4'

    // Add optimistic trade
    act(() => {
      result.current.addOptimisticTrade(tempId, 'Test input')
    })

    // Resolve with actual trade data
    const actualTrade = createMockTrade({
      id: 'new-uuid',
      sequence_number: 10,
      pnl: 1000,
      direction: 'short',
      outcome: 'loss',
    })

    act(() => {
      result.current.resolveTrade(tempId, actualTrade)
    })

    // Trade should be resolved
    expect(result.current.pendingTrades.size).toBe(0)
  })

  // Test that pending trades Map is properly managed
  it('manages multiple pending trades correctly', () => {
    const { result } = renderHook(() => useOptimisticTrades())

    act(() => {
      result.current.addOptimisticTrade('temp-1', 'Trade 1')
      result.current.addOptimisticTrade('temp-2', 'Trade 2')
      result.current.addOptimisticTrade('temp-3', 'Trade 3')
    })

    expect(result.current.pendingTrades.size).toBe(3)

    // Resolve one trade
    act(() => {
      result.current.resolveTrade('temp-2', createMockTrade({ id: 'actual-2' }))
    })

    expect(result.current.pendingTrades.size).toBe(2)
    expect(result.current.pendingTrades.has('temp-1')).toBe(true)
    expect(result.current.pendingTrades.has('temp-2')).toBe(false)
    expect(result.current.pendingTrades.has('temp-3')).toBe(true)
  })

  // Test that non-existent tempId resolve is handled gracefully
  it('handles resolveTrade for non-existent tempId gracefully', () => {
    const { result } = renderHook(() => useOptimisticTrades())

    act(() => {
      result.current.addOptimisticTrade('temp-1', 'Trade 1')
    })

    // Try to resolve a non-existent trade - should not throw
    act(() => {
      result.current.resolveTrade('non-existent', createMockTrade())
    })

    // Original trade should still be there
    expect(result.current.pendingTrades.size).toBe(1)
  })

  // Test that the hook returns the expected interface
  it('returns correct interface with addOptimisticTrade and resolveTrade functions', () => {
    const { result } = renderHook(() => useOptimisticTrades())

    expect(result.current.pendingTrades).toBeDefined()
    expect(result.current.pendingTrades).toBeInstanceOf(Map)
    expect(typeof result.current.addOptimisticTrade).toBe('function')
    expect(typeof result.current.resolveTrade).toBe('function')
    expect(typeof result.current.rejectTrade).toBe('function')
  })

  // Test rejectTrade removes pending trade
  it('removes pending trade on rejectTrade', () => {
    const { result } = renderHook(() => useOptimisticTrades())

    act(() => {
      result.current.addOptimisticTrade('temp-1', 'Trade 1')
    })

    expect(result.current.pendingTrades.size).toBe(1)

    act(() => {
      result.current.rejectTrade('temp-1')
    })

    expect(result.current.pendingTrades.size).toBe(0)
  })

  // Test rejectTrade handles non-existent tempId
  it('handles rejectTrade for non-existent tempId gracefully', () => {
    const { result } = renderHook(() => useOptimisticTrades())

    act(() => {
      result.current.addOptimisticTrade('temp-1', 'Trade 1')
    })

    // Should not throw
    act(() => {
      result.current.rejectTrade('non-existent')
    })

    expect(result.current.pendingTrades.size).toBe(1)
  })
})
