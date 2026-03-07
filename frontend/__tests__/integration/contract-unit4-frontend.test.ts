/**
 * Contract tests: Unit 4 (Insights Agent) → Frontend (Insights Zod schemas).
 *
 * Verifies that:
 * 1. Backend Insight/InsightsResponse shape satisfies frontend Zod validation
 * 2. Frontend insightSchema/insightsResponseSchema accept all valid backend outputs
 * 3. The API envelope shape used by insights endpoint is compatible
 */
import { describe, it, expect } from 'vitest'
import {
  insightSchema,
  insightsResponseSchema,
  type Insight,
  type InsightsResponse,
} from '@/lib/schemas/insights'

describe('Cross-Unit Imports: Frontend Insights Schemas', () => {
  it('insightSchema is importable and callable', () => {
    expect(insightSchema).toBeDefined()
    expect(insightSchema.parse).toBeInstanceOf(Function)
  })

  it('insightsResponseSchema is importable and callable', () => {
    expect(insightsResponseSchema).toBeDefined()
    expect(insightsResponseSchema.parse).toBeInstanceOf(Function)
  })
})

describe('Insight Schema Contract', () => {
  it('accepts risk category with warning severity', () => {
    const insight: Insight = {
      category: 'risk',
      message: 'Tilt risk detected: 2+ consecutive losses with low discipline.',
      severity: 'warning',
    }
    const result = insightSchema.safeParse(insight)
    expect(result.success).toBe(true)
  })

  it('accepts pattern category with info severity', () => {
    const insight: Insight = {
      category: 'pattern',
      message: 'Discipline trajectory concerning.',
      severity: 'info',
    }
    const result = insightSchema.safeParse(insight)
    expect(result.success).toBe(true)
  })

  it('accepts positive category with success severity', () => {
    const insight: Insight = {
      category: 'positive',
      message: 'Excellent streak!',
      severity: 'success',
    }
    const result = insightSchema.safeParse(insight)
    expect(result.success).toBe(true)
  })

  it('accepts insight without severity (optional)', () => {
    const result = insightSchema.safeParse({
      category: 'pattern',
      message: 'No severity provided.',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid category', () => {
    const result = insightSchema.safeParse({
      category: 'unknown',
      message: 'Test',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid severity', () => {
    const result = insightSchema.safeParse({
      category: 'risk',
      message: 'Test',
      severity: 'critical', // Not in enum
    })
    expect(result.success).toBe(false)
  })

  it('accepts message at max length (500)', () => {
    const result = insightSchema.safeParse({
      category: 'risk',
      message: 'x'.repeat(500),
      severity: 'warning',
    })
    expect(result.success).toBe(true)
  })

  it('rejects message exceeding max length', () => {
    const result = insightSchema.safeParse({
      category: 'risk',
      message: 'x'.repeat(501),
      severity: 'warning',
    })
    expect(result.success).toBe(false)
  })
})

describe('InsightsResponse Schema Contract', () => {
  it('validates a realistic backend response', () => {
    // This matches the shape Unit 4's API returns in the `data` field
    const backendResponse: InsightsResponse = {
      insights: [
        { category: 'risk', message: 'Tilt risk detected.', severity: 'warning' },
        { category: 'positive', message: 'Great discipline!', severity: 'success' },
      ],
      generated_at: '2024-01-15T10:30:00Z',
      trade_count: 7,
    }

    const result = insightsResponseSchema.safeParse(backendResponse)
    expect(result.success).toBe(true)
  })

  it('validates empty insights array', () => {
    const result = insightsResponseSchema.safeParse({
      insights: [],
      generated_at: '2024-01-15T10:30:00Z',
      trade_count: 0,
    })
    expect(result.success).toBe(true)
  })

  it('validates max 3 insights', () => {
    const result = insightsResponseSchema.safeParse({
      insights: [
        { category: 'risk', message: 'msg1', severity: 'warning' },
        { category: 'pattern', message: 'msg2', severity: 'info' },
        { category: 'positive', message: 'msg3', severity: 'success' },
      ],
      generated_at: '2024-01-15T10:30:00Z',
      trade_count: 10,
    })
    expect(result.success).toBe(true)
  })

  it('rejects more than 3 insights', () => {
    const result = insightsResponseSchema.safeParse({
      insights: [
        { category: 'risk', message: 'msg1' },
        { category: 'risk', message: 'msg2' },
        { category: 'risk', message: 'msg3' },
        { category: 'risk', message: 'msg4' },
      ],
      generated_at: '2024-01-15T10:30:00Z',
      trade_count: 10,
    })
    expect(result.success).toBe(false)
  })

  it('validates trade_count is non-negative integer', () => {
    const result = insightsResponseSchema.safeParse({
      insights: [],
      generated_at: '2024-01-15T10:30:00Z',
      trade_count: -1,
    })
    expect(result.success).toBe(false)
  })

  it('validates generated_at is ISO datetime string', () => {
    const result = insightsResponseSchema.safeParse({
      insights: [],
      generated_at: 'not-a-date',
      trade_count: 0,
    })
    expect(result.success).toBe(false)
  })
})

describe('Backend API Envelope → Frontend Contract', () => {
  it('API success envelope wraps InsightsResponse correctly', () => {
    // Unit 4's get_insights returns ApiResponse with data containing insights fields
    const apiEnvelope = {
      success: true,
      data: {
        insights: [
          { category: 'risk' as const, message: 'Tilt detected.', severity: 'warning' as const },
        ],
        generated_at: '2024-01-15T10:30:00Z',
        trade_count: 5,
      },
    }

    // Frontend would extract data and validate
    const result = insightsResponseSchema.safeParse(apiEnvelope.data)
    expect(result.success).toBe(true)
  })

  it('small session welcome message passes frontend validation', () => {
    // Unit 4 returns encouraging message for 0 trades (FR 5.4)
    const welcomeResponse = {
      insights: [
        {
          category: 'pattern' as const,
          message: 'Welcome to your trading session! Log your first trade to start tracking your performance.',
        },
      ],
      generated_at: '2024-01-15T10:00:00Z',
      trade_count: 0,
    }

    const result = insightsResponseSchema.safeParse(welcomeResponse)
    expect(result.success).toBe(true)
  })
})
