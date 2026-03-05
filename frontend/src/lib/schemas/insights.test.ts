import { describe, it, expect } from 'vitest'
import { insightSchema, insightsResponseSchema, type Insight, type InsightsResponse } from './insights'

describe('insightSchema', () => {
  it('accepts valid risk insight', () => {
    const result = insightSchema.safeParse({
      category: 'risk',
      message: 'You have taken 3 consecutive losses. Consider reducing position size.',
      severity: 'warning',
    })
    expect(result.success).toBe(true)
  })

  it('accepts valid pattern insight', () => {
    const result = insightSchema.safeParse({
      category: 'pattern',
      message: 'You tend to overtrade during volatile market hours.',
    })
    expect(result.success).toBe(true)
  })

  it('accepts valid positive insight', () => {
    const result = insightSchema.safeParse({
      category: 'positive',
      message: 'Great discipline on following your trading plan today.',
      severity: 'success',
    })
    expect(result.success).toBe(true)
  })

  it('accepts insight with info severity', () => {
    const result = insightSchema.safeParse({
      category: 'pattern',
      message: 'You often exit trades early during trending markets.',
      severity: 'info',
    })
    expect(result.success).toBe(true)
  })

  it('accepts insight without severity', () => {
    const result = insightSchema.safeParse({
      category: 'risk',
      message: 'This is a risk observation.',
    })
    expect(result.success).toBe(true)
  })

  it('accepts maximum length message (500 chars)', () => {
    const result = insightSchema.safeParse({
      category: 'positive',
      message: 'x'.repeat(500),
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid category', () => {
    const result = insightSchema.safeParse({
      category: 'opportunity',
      message: 'Some message',
    })
    expect(result.success).toBe(false)
  })

  it('rejects message over 500 chars', () => {
    const result = insightSchema.safeParse({
      category: 'risk',
      message: 'x'.repeat(501),
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid severity', () => {
    const result = insightSchema.safeParse({
      category: 'risk',
      message: 'Some message',
      severity: 'critical',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing category', () => {
    const result = insightSchema.safeParse({
      message: 'Some message',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing message', () => {
    const result = insightSchema.safeParse({
      category: 'pattern',
    })
    expect(result.success).toBe(false)
  })

  it('exports inferred Insight type', () => {
    // Type-level test — compilation is the assertion
    const insight: Insight = {
      category: 'positive',
      message: 'Great job following your plan',
    }
    expect(insight.category).toBe('positive')
  })
})

describe('insightsResponseSchema', () => {
  const validInsightsResponse = {
    insights: [
      {
        category: 'risk',
        message: 'You have taken 3 consecutive losses.',
        severity: 'warning',
      },
      {
        category: 'pattern',
        message: 'You tend to overtrade during volatile hours.',
      },
      {
        category: 'positive',
        message: 'Great discipline today.',
        severity: 'success',
      },
    ],
    generated_at: '2024-01-15T10:30:00.000Z',
    trade_count: 15,
  }

  it('accepts valid insights response with 3 insights', () => {
    const result = insightsResponseSchema.safeParse(validInsightsResponse)
    expect(result.success).toBe(true)
  })

  it('accepts empty insights array', () => {
    const result = insightsResponseSchema.safeParse({
      ...validInsightsResponse,
      insights: [],
    })
    expect(result.success).toBe(true)
  })

  it('accepts single insight', () => {
    const result = insightsResponseSchema.safeParse({
      ...validInsightsResponse,
      insights: [
        {
          category: 'positive',
          message: 'Good job!',
        },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejects more than 3 insights', () => {
    const result = insightsResponseSchema.safeParse({
      ...validInsightsResponse,
      insights: [
        { category: 'risk', message: 'Insight 1' },
        { category: 'pattern', message: 'Insight 2' },
        { category: 'positive', message: 'Insight 3' },
        { category: 'risk', message: 'Insight 4' },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('accepts zero trade_count', () => {
    const result = insightsResponseSchema.safeParse({
      ...validInsightsResponse,
      trade_count: 0,
    })
    expect(result.success).toBe(true)
  })

  it('rejects negative trade_count', () => {
    const result = insightsResponseSchema.safeParse({
      ...validInsightsResponse,
      trade_count: -1,
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-integer trade_count', () => {
    const result = insightsResponseSchema.safeParse({
      ...validInsightsResponse,
      trade_count: 1.5,
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid datetime for generated_at', () => {
    const result = insightsResponseSchema.safeParse({
      ...validInsightsResponse,
      generated_at: 'not-a-date',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing insights', () => {
    const result = insightsResponseSchema.safeParse({
      generated_at: '2024-01-15T10:30:00.000Z',
      trade_count: 10,
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing generated_at', () => {
    const result = insightsResponseSchema.safeParse({
      insights: [],
      trade_count: 10,
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing trade_count', () => {
    const result = insightsResponseSchema.safeParse({
      insights: [],
      generated_at: '2024-01-15T10:30:00.000Z',
    })
    expect(result.success).toBe(false)
  })

  it('exports inferred InsightsResponse type', () => {
    // Type-level test — compilation is the assertion
    const response: InsightsResponse = {
      insights: [],
      generated_at: '2024-01-15T10:30:00.000Z',
      trade_count: 0,
    }
    expect(response.trade_count).toBe(0)
  })
})
