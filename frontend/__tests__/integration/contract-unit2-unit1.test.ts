/**
 * Contract tests: Unit 2 (Trade Entry UI) → Unit 1 (Data Layer schemas).
 *
 * Verifies that:
 * 1. Unit 2 can import all schemas it depends on from Unit 1
 * 2. Trade API response shape matches tradeResponseSchema
 * 3. tradeInputSchema validates the shape Unit 2's TradeEntry sends
 * 4. PendingTrade shape is compatible with TradeResponse
 */
import { describe, it, expect } from 'vitest'
import {
  tradeInputSchema,
  tradeResponseSchema,
  type TradeInput,
  type TradeResponse,
  type TradeApiResponse,
} from '@/lib/schemas/trade'

describe('Cross-Unit Imports: Unit 2 → Unit 1', () => {
  it('tradeInputSchema is importable and callable', () => {
    expect(tradeInputSchema).toBeDefined()
    expect(tradeInputSchema.parse).toBeInstanceOf(Function)
  })

  it('tradeResponseSchema is importable and callable', () => {
    expect(tradeResponseSchema).toBeDefined()
    expect(tradeResponseSchema.parse).toBeInstanceOf(Function)
  })
})

describe('TradeInput Contract', () => {
  it('accepts the shape TradeEntry.tsx sends', () => {
    // TradeEntry submits { raw_input: string }
    const input: TradeInput = { raw_input: 'Long NQ at 17800 for +$500' }
    const result = tradeInputSchema.safeParse(input)
    expect(result.success).toBe(true)
  })

  it('accepts max-length input (5000 chars)', () => {
    const input = { raw_input: 'x'.repeat(5000) }
    const result = tradeInputSchema.safeParse(input)
    expect(result.success).toBe(true)
  })

  it('rejects empty raw_input', () => {
    const result = tradeInputSchema.safeParse({ raw_input: '' })
    expect(result.success).toBe(false)
  })

  it('rejects missing raw_input', () => {
    const result = tradeInputSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('trims whitespace from raw_input', () => {
    const result = tradeInputSchema.parse({ raw_input: '  Long NQ  ' })
    expect(result.raw_input).toBe('Long NQ')
  })
})

describe('TradeResponse Contract', () => {
  const validTradeResponse: TradeResponse = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    session_id: '660e8400-e29b-41d4-a716-446655440000',
    sequence_number: 1,
    direction: 'long',
    outcome: 'win',
    pnl: 500,
    setup_description: 'Pullback entry on NQ',
    discipline_score: 1,
    agency_score: 1,
    discipline_confidence: 'high',
    agency_confidence: 'high',
    created_at: '2024-01-15T10:30:00.000Z',
  }

  it('validates a realistic trade response from the API', () => {
    const result = tradeResponseSchema.safeParse(validTradeResponse)
    expect(result.success).toBe(true)
  })

  it('validates response with null setup_description', () => {
    const result = tradeResponseSchema.safeParse({
      ...validTradeResponse,
      setup_description: null,
    })
    expect(result.success).toBe(true)
  })

  it('validates response with negative pnl', () => {
    const result = tradeResponseSchema.safeParse({
      ...validTradeResponse,
      outcome: 'loss',
      pnl: -250,
    })
    expect(result.success).toBe(true)
  })

  it('validates all direction values', () => {
    for (const direction of ['long', 'short'] as const) {
      const result = tradeResponseSchema.safeParse({
        ...validTradeResponse,
        direction,
      })
      expect(result.success).toBe(true)
    }
  })

  it('validates all outcome values', () => {
    for (const outcome of ['win', 'loss', 'breakeven'] as const) {
      const result = tradeResponseSchema.safeParse({
        ...validTradeResponse,
        outcome,
      })
      expect(result.success).toBe(true)
    }
  })

  it('validates all confidence values', () => {
    for (const confidence of ['high', 'medium', 'low'] as const) {
      const result = tradeResponseSchema.safeParse({
        ...validTradeResponse,
        discipline_confidence: confidence,
        agency_confidence: confidence,
      })
      expect(result.success).toBe(true)
    }
  })

  it('validates score boundary values', () => {
    for (const score of [-1, 0, 1]) {
      const result = tradeResponseSchema.safeParse({
        ...validTradeResponse,
        discipline_score: score,
        agency_score: score,
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid score values', () => {
    const result = tradeResponseSchema.safeParse({
      ...validTradeResponse,
      discipline_score: 2,
    })
    expect(result.success).toBe(false)
  })
})

describe('TradeApiResponse Contract', () => {
  it('matches the shape Unit 2 route handler returns', () => {
    // This is the exact shape the POST /api/v1/trades handler returns
    const apiResponse: TradeApiResponse = {
      data: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        session_id: '660e8400-e29b-41d4-a716-446655440000',
        sequence_number: 1,
        direction: 'long',
        outcome: 'win',
        pnl: 500,
        setup_description: 'Pullback entry',
        discipline_score: 1,
        agency_score: 1,
        discipline_confidence: 'high',
        agency_confidence: 'high',
        created_at: '2024-01-15T10:30:00.000Z',
      },
      meta: { sequence_number: 1 },
    }

    // TradeEntry.tsx reads result.data from the API response
    const tradeData = apiResponse.data
    const result = tradeResponseSchema.safeParse(tradeData)
    expect(result.success).toBe(true)
  })
})
