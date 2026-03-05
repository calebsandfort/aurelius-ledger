import { describe, it, expect } from 'vitest'
import { tradeInputSchema, tradeResponseSchema, type TradeInput, type TradeResponse } from './trade'

describe('tradeInputSchema', () => {
  it('accepts valid trade input', () => {
    const result = tradeInputSchema.safeParse({
      raw_input: 'Long NQ at 17800, exited at 17850 for +$500 profit. Sticked to my trading plan.',
    })
    expect(result.success).toBe(true)
  })

  it('accepts maximum length input (5000 chars)', () => {
    const result = tradeInputSchema.safeParse({
      raw_input: 'x'.repeat(5000),
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty raw_input', () => {
    const result = tradeInputSchema.safeParse({
      raw_input: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects raw_input over 5000 chars', () => {
    const result = tradeInputSchema.safeParse({
      raw_input: 'x'.repeat(5001),
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

  it('rejects missing raw_input', () => {
    const result = tradeInputSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('exports inferred TradeInput type', () => {
    // Type-level test — compilation is the assertion
    const input: TradeInput = { raw_input: 'test' }
    expect(input.raw_input).toBe('test')
  })
})

describe('tradeResponseSchema', () => {
  const validTradeResponse = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    session_id: '550e8400-e29b-41d4-a716-446655440001',
    sequence_number: 1,
    direction: 'long',
    outcome: 'win',
    pnl: 500.00,
    setup_description: 'Pullback to EMA',
    discipline_score: 1,
    agency_score: 1,
    discipline_confidence: 'high',
    agency_confidence: 'high',
    created_at: '2024-01-15T10:30:00.000Z',
  }

  it('accepts valid trade response', () => {
    const result = tradeResponseSchema.safeParse(validTradeResponse)
    expect(result.success).toBe(true)
  })

  it('accepts null setup_description', () => {
    const result = tradeResponseSchema.safeParse({
      ...validTradeResponse,
      setup_description: null,
    })
    expect(result.success).toBe(true)
  })

  it('accepts short direction', () => {
    const result = tradeResponseSchema.safeParse({
      ...validTradeResponse,
      direction: 'short',
    })
    expect(result.success).toBe(true)
  })

  it('accepts loss outcome', () => {
    const result = tradeResponseSchema.safeParse({
      ...validTradeResponse,
      outcome: 'loss',
      pnl: -250.00,
    })
    expect(result.success).toBe(true)
  })

  it('accepts breakeven outcome', () => {
    const result = tradeResponseSchema.safeParse({
      ...validTradeResponse,
      outcome: 'breakeven',
      pnl: 0,
    })
    expect(result.success).toBe(true)
  })

  it('accepts negative pnl', () => {
    const result = tradeResponseSchema.safeParse({
      ...validTradeResponse,
      pnl: -1000.50,
    })
    expect(result.success).toBe(true)
  })

  it('accepts medium confidence', () => {
    const result = tradeResponseSchema.safeParse({
      ...validTradeResponse,
      discipline_confidence: 'medium',
      agency_confidence: 'low',
    })
    expect(result.success).toBe(true)
  })

  it('accepts positive discipline and agency scores', () => {
    const result = tradeResponseSchema.safeParse({
      ...validTradeResponse,
      discipline_score: 1,
      agency_score: 1,
    })
    expect(result.success).toBe(true)
  })

  it('accepts zero discipline and agency scores', () => {
    const result = tradeResponseSchema.safeParse({
      ...validTradeResponse,
      discipline_score: 0,
      agency_score: 0,
    })
    expect(result.success).toBe(true)
  })

  it('accepts negative discipline and agency scores', () => {
    const result = tradeResponseSchema.safeParse({
      ...validTradeResponse,
      discipline_score: -1,
      agency_score: -1,
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid uuid for id', () => {
    const result = tradeResponseSchema.safeParse({
      ...validTradeResponse,
      id: 'not-a-uuid',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid uuid for session_id', () => {
    const result = tradeResponseSchema.safeParse({
      ...validTradeResponse,
      session_id: 'not-a-uuid',
    })
    expect(result.success).toBe(false)
  })

  it('rejects zero sequence_number', () => {
    const result = tradeResponseSchema.safeParse({
      ...validTradeResponse,
      sequence_number: 0,
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative sequence_number', () => {
    const result = tradeResponseSchema.safeParse({
      ...validTradeResponse,
      sequence_number: -1,
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-integer sequence_number', () => {
    const result = tradeResponseSchema.safeParse({
      ...validTradeResponse,
      sequence_number: 1.5,
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid direction', () => {
    const result = tradeResponseSchema.safeParse({
      ...validTradeResponse,
      direction: 'neutral',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid outcome', () => {
    const result = tradeResponseSchema.safeParse({
      ...validTradeResponse,
      outcome: 'partial',
    })
    expect(result.success).toBe(false)
  })

  it('rejects setup_description over 2000 chars', () => {
    const result = tradeResponseSchema.safeParse({
      ...validTradeResponse,
      setup_description: 'x'.repeat(2001),
    })
    expect(result.success).toBe(false)
  })

  it('rejects discipline_score outside -1 to 1 range', () => {
    const result = tradeResponseSchema.safeParse({
      ...validTradeResponse,
      discipline_score: 2,
    })
    expect(result.success).toBe(false)
  })

  it('rejects discipline_score outside -1 to 1 range (negative)', () => {
    const result = tradeResponseSchema.safeParse({
      ...validTradeResponse,
      discipline_score: -2,
    })
    expect(result.success).toBe(false)
  })

  it('rejects agency_score outside -1 to 1 range', () => {
    const result = tradeResponseSchema.safeParse({
      ...validTradeResponse,
      agency_score: 2,
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid discipline_confidence', () => {
    const result = tradeResponseSchema.safeParse({
      ...validTradeResponse,
      discipline_confidence: 'very_high',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid agency_confidence', () => {
    const result = tradeResponseSchema.safeParse({
      ...validTradeResponse,
      agency_confidence: 'medium-high',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid datetime for created_at', () => {
    const result = tradeResponseSchema.safeParse({
      ...validTradeResponse,
      created_at: 'not-a-date',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing required fields', () => {
    const result = tradeResponseSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
    })
    expect(result.success).toBe(false)
  })

  it('exports inferred TradeResponse type', () => {
    // Type-level test — compilation is the assertion
    const response: TradeResponse = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      session_id: '550e8400-e29b-41d4-a716-446655440001',
      sequence_number: 1,
      direction: 'long',
      outcome: 'win',
      pnl: 500,
      setup_description: null,
      discipline_score: 1,
      agency_score: 1,
      discipline_confidence: 'high',
      agency_confidence: 'high',
      created_at: '2024-01-15T10:30:00.000Z',
    }
    expect(response.direction).toBe('long')
  })
})
