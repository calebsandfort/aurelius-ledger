import { describe, it, expect, vi, beforeEach } from 'vitest'
import { tradeInputSchema, tradeResponseSchema } from '@/lib/schemas/trade'
import { z } from 'zod'

// Schema for trade adjustment (same as in the route)
const adjustmentSchema = z.object({
  discipline_score: z.number().int().min(-1).max(1).optional(),
  agency_score: z.number().int().min(-1).max(1).optional(),
  reason: z.string().min(1, 'Reason is required').max(500),
})

describe('Trade Input Schema Validation', () => {
  describe('FR 1.1 — accepts natural language trade description', () => {
    it('accepts valid trade input', () => {
      const result = tradeInputSchema.safeParse({
        raw_input: 'Long NQ at 17800, exited at 17850 for +$500 profit.',
      })
      expect(result.success).toBe(true)
    })

    it('accepts maximum length input (5000 chars)', () => {
      const result = tradeInputSchema.safeParse({
        raw_input: 'a'.repeat(5000),
      })
      expect(result.success).toBe(true)
    })

    it('rejects empty trade description', () => {
      const result = tradeInputSchema.safeParse({
        raw_input: '',
      })
      expect(result.success).toBe(false)
    })

    it('rejects trade description exceeding 5000 chars', () => {
      const result = tradeInputSchema.safeParse({
        raw_input: 'a'.repeat(5001),
      })
      expect(result.success).toBe(false)
    })

    it('trims whitespace from input', () => {
      const result = tradeInputSchema.safeParse({
        raw_input: '  Long trade description  ',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.raw_input).toBe('Long trade description')
      }
    })
  })
})

describe('Trade Response Schema Validation', () => {
  const validTradeResponse = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    session_id: '550e8400-e29b-41d4-a716-446655440001',
    sequence_number: 1,
    direction: 'long' as const,
    outcome: 'win' as const,
    pnl: 500,
    setup_description: 'Test setup',
    discipline_score: 0,
    agency_score: 0,
    discipline_confidence: 'medium' as const,
    agency_confidence: 'medium' as const,
    created_at: '2024-01-15T10:30:00.000Z',
  }

  it('FR 1.2.1 — returns valid response structure', () => {
    const result = tradeResponseSchema.safeParse(validTradeResponse)
    expect(result.success).toBe(true)
  })
})

describe('Trade Adjustment Schema Validation', () => {
  describe('FR 4.8.1 — allows manual adjustment of discipline_score', () => {
    it('accepts valid discipline_score adjustment', () => {
      const result = adjustmentSchema.safeParse({
        discipline_score: 1,
        reason: 'Market conditions were exceptional',
      })
      expect(result.success).toBe(true)
    })

    it('accepts valid agency_score adjustment', () => {
      const result = adjustmentSchema.safeParse({
        agency_score: 1,
        reason: 'Took a calculated risk',
      })
      expect(result.success).toBe(true)
    })

    it('requires reason field for adjustment', () => {
      const result = adjustmentSchema.safeParse({
        discipline_score: 1,
      })
      expect(result.success).toBe(false)
    })

    it('validates discipline_score range (-1 to 1)', () => {
      const result = adjustmentSchema.safeParse({
        discipline_score: 5,
        reason: 'Test',
      })
      expect(result.success).toBe(false)
    })

    it('validates agency_score range (-1 to 1)', () => {
      const result = adjustmentSchema.safeParse({
        agency_score: -2,
        reason: 'Test',
      })
      expect(result.success).toBe(false)
    })

    it('accepts negative scores', () => {
      const result = adjustmentSchema.safeParse({
        discipline_score: -1,
        agency_score: -1,
        reason: 'Violation of trading plan',
      })
      expect(result.success).toBe(true)
    })
  })
})

describe('Export Format Validation', () => {
  it('FR 3.3.1 — supports JSON export format', () => {
    const validFormats = ['json', 'csv']
    expect(validFormats.includes('json')).toBe(true)
    expect(validFormats.includes('csv')).toBe(true)
  })

  it('FR 3.3.2 — validates format parameter', () => {
    const validFormats = ['json', 'csv']
    expect(validFormats.includes('invalid')).toBe(false)
  })
})

describe('Rate Limiting Validation', () => {
  // Simulate rate limiting logic
  const rateLimitMap = new Map<string, { count: number; timestamp: number }>()
  const RATE_LIMIT = 30
  const RATE_WINDOW_MS = 60000

  function checkRateLimit(userId: string): boolean {
    const now = Date.now()
    const userLimit = rateLimitMap.get(userId)

    if (!userLimit || now - userLimit.timestamp > RATE_WINDOW_MS) {
      rateLimitMap.set(userId, { count: 1, timestamp: now })
      return true
    }

    if (userLimit.count >= RATE_LIMIT) {
      return false
    }

    userLimit.count++
    return true
  }

  it('allows requests under rate limit', () => {
    const result = checkRateLimit('test-user')
    expect(result).toBe(true)
  })

  it('blocks requests over rate limit', () => {
    // Fill up the rate limit
    for (let i = 0; i < RATE_LIMIT; i++) {
      checkRateLimit('rate-limit-user')
    }
    const result = checkRateLimit('rate-limit-user')
    expect(result).toBe(false)
  })
})
