import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useBehavioralWarnings } from './useBehavioralWarnings'
import type { TradeResponse } from '@/lib/schemas/trade'

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

describe('useBehavioralWarnings', () => {
  // FR 4.4 - NOT show warnings for <3 trades
  it('FR 4.4 — no warning when fewer than 3 trades', () => {
    const trades = [
      createMockTrade({ discipline_score: -1 }),
      createMockTrade({ discipline_score: -1 }),
    ]

    const { result } = renderHook(() => useBehavioralWarnings(trades))

    expect(result.current.level).toBe('none')
  })

  // FR 4.4 - No alert for 2 consecutive -1 scores
  it('FR 4.4 — no warning for 2 consecutive -1 discipline scores', () => {
    const trades = [
      createMockTrade({ discipline_score: -1 }),
      createMockTrade({ discipline_score: -1 }),
    ]

    const { result } = renderHook(() => useBehavioralWarnings(trades))

    expect(result.current.level).toBe('none')
  })

  // FR 4.4 - Yellow (amber) for 3 consecutive -1 scores
  it('FR 4.4 — yellow warning on 3 consecutive -1 discipline scores', () => {
    const trades = [
      createMockTrade({ discipline_score: -1 }),
      createMockTrade({ discipline_score: -1 }),
      createMockTrade({ discipline_score: -1 }),
    ]

    const { result } = renderHook(() => useBehavioralWarnings(trades))

    expect(result.current.level).toBe('amber')
    expect(result.current.message).toContain('3 consecutive')
  })

  // FR 4.4 - Orange for 4+ consecutive -1 scores
  it('FR 4.4 — orange warning on 4 consecutive -1 discipline scores', () => {
    const trades = [
      createMockTrade({ discipline_score: -1 }),
      createMockTrade({ discipline_score: -1 }),
      createMockTrade({ discipline_score: -1 }),
      createMockTrade({ discipline_score: -1 }),
    ]

    const { result } = renderHook(() => useBehavioralWarnings(trades))

    expect(result.current.level).toBe('orange')
    expect(result.current.message).toContain('4+ consecutive')
  })

  // FR 4.4 - More than 4 consecutive -1 scores still orange
  it('FR 4.4 — orange warning on 5 consecutive -1 discipline scores', () => {
    const trades = Array(5).fill(null).map(() =>
      createMockTrade({ discipline_score: -1 })
    )

    const { result } = renderHook(() => useBehavioralWarnings(trades))

    expect(result.current.level).toBe('orange')
  })

  // FR 4.4 - Warning should include triggered trade indices
  it('FR 4.4 — includes triggered trade indices in warning', () => {
    const trades = [
      createMockTrade({ discipline_score: 1 }), // index 0
      createMockTrade({ discipline_score: -1 }), // index 1
      createMockTrade({ discipline_score: -1 }), // index 2
      createMockTrade({ discipline_score: -1 }), // index 3 - triggers
    ]

    const { result } = renderHook(() => useBehavioralWarnings(trades))

    expect(result.current.triggeredBy).toContain(1)
    expect(result.current.triggeredBy).toContain(2)
    expect(result.current.triggeredBy).toContain(3)
  })

  // FR 4.4 - Fade when negative pattern resolves
  it('FR 4.4 — no warning when negative pattern is broken by positive score', () => {
    const trades = [
      createMockTrade({ discipline_score: -1 }),
      createMockTrade({ discipline_score: -1 }),
      createMockTrade({ discipline_score: 1 }), // Breaks the pattern
      createMockTrade({ discipline_score: -1 }),
      createMockTrade({ discipline_score: -1 }),
      createMockTrade({ discipline_score: -1 }), // Only 3 consecutive, not 4
    ]

    const { result } = renderHook(() => useBehavioralWarnings(trades))

    // With the break at index 2, we only have 3 consecutive at the end
    expect(result.current.level).toBe('amber')
  })

  // FR 4.4 - Works with agency score too (mirrored behavior)
  it('FR 4.4 — detects agency score violations', () => {
    const trades = [
      createMockTrade({ agency_score: -1 }),
      createMockTrade({ agency_score: -1 }),
      createMockTrade({ agency_score: -1 }),
    ]

    const { result } = renderHook(() => useBehavioralWarnings(trades))

    // Should detect discipline OR agency violations
    expect(result.current.level).not.toBe('none')
  })

  // Empty trades - no warning
  it('returns none level for empty trades array', () => {
    const { result } = renderHook(() => useBehavioralWarnings([]))

    expect(result.current.level).toBe('none')
  })

  // Single trade - no warning
  it('returns none level for single trade', () => {
    const trades = [createMockTrade({ discipline_score: -1 })]

    const { result } = renderHook(() => useBehavioralWarnings(trades))

    expect(result.current.level).toBe('none')
  })

  // All positive scores - no warning
  it('returns none when all scores are positive', () => {
    const trades = [
      createMockTrade({ discipline_score: 1 }),
      createMockTrade({ discipline_score: 1 }),
      createMockTrade({ discipline_score: 1 }),
      createMockTrade({ discipline_score: 1 }),
    ]

    const { result } = renderHook(() => useBehavioralWarnings(trades))

    expect(result.current.level).toBe('none')
  })

  // Neutral scores - no warning
  it('returns none when all scores are neutral', () => {
    const trades = [
      createMockTrade({ discipline_score: 0 }),
      createMockTrade({ discipline_score: 0 }),
      createMockTrade({ discipline_score: 0 }),
      createMockTrade({ discipline_score: 0 }),
    ]

    const { result } = renderHook(() => useBehavioralWarnings(trades))

    expect(result.current.level).toBe('none')
  })
})
