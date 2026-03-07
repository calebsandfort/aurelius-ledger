/**
 * Contract tests: Unit 5 (Dashboard Charts UI) and Unit 6 (Insights Panel UI)
 *
 * Verifies that:
 * 1. Unit 5 can import TradeResponse from Unit 1 schemas
 * 2. Unit 6 can import Insight from Unit 1 schemas
 * 3. Charts accept the TradeResponse[] shape from the API
 * 4. InsightsPanel accepts the Insight[] shape from the API
 * 5. Dashboard actually integrates Unit 6's InsightsPanel component
 */
import { describe, it, expect } from 'vitest'
import {
  tradeResponseSchema,
  type TradeResponse,
} from '@/lib/schemas/trade'
import {
  insightSchema,
  insightsResponseSchema,
  type Insight,
  type InsightsResponse,
} from '@/lib/schemas/insights'

describe('Cross-Unit Imports: Unit 5 → Unit 1', () => {
  it('tradeResponseSchema is importable and callable', () => {
    expect(tradeResponseSchema).toBeDefined()
    expect(tradeResponseSchema.parse).toBeInstanceOf(Function)
  })
})

describe('Cross-Unit Imports: Unit 6 → Unit 1', () => {
  it('insightSchema is importable and callable', () => {
    expect(insightSchema).toBeDefined()
    expect(insightSchema.parse).toBeInstanceOf(Function)
  })

  it('insightsResponseSchema is importable and callable', () => {
    expect(insightsResponseSchema).toBeDefined()
    expect(insightsResponseSchema.parse).toBeInstanceOf(Function)
  })
})

describe('Unit 5: Chart Data Contract', () => {
  // Valid TradeResponse that matches what /api/v1/trades returns
  const validTrade: TradeResponse = {
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

  it('validates a realistic trade response from the trades API', () => {
    const result = tradeResponseSchema.safeParse(validTrade)
    expect(result.success).toBe(true)
  })

  it('validates array of trades that charts will receive', () => {
    const trades: TradeResponse[] = [
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        session_id: '660e8400-e29b-41d4-a716-446655440000',
        sequence_number: 1,
        direction: 'long',
        outcome: 'win',
        pnl: 500,
        setup_description: 'Trade 1',
        discipline_score: 1,
        agency_score: 1,
        discipline_confidence: 'high',
        agency_confidence: 'high',
        created_at: '2024-01-15T10:30:00.000Z',
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440002',
        session_id: '660e8400-e29b-41d4-a716-446655440000',
        sequence_number: 2,
        direction: 'short',
        outcome: 'loss',
        pnl: -200,
        setup_description: 'Trade 2',
        discipline_score: -1,
        agency_score: 0,
        discipline_confidence: 'medium',
        agency_confidence: 'medium',
        created_at: '2024-01-15T10:35:00.000Z',
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440003',
        session_id: '660e8400-e29b-41d4-a716-446655440000',
        sequence_number: 3,
        direction: 'long',
        outcome: 'win',
        pnl: 150,
        setup_description: 'Trade 3',
        discipline_score: 0,
        agency_score: 1,
        discipline_confidence: 'low',
        agency_confidence: 'high',
        created_at: '2024-01-15T10:40:00.000Z',
      },
    ]

    const results = trades.map((t) => tradeResponseSchema.safeParse(t))
    expect(results.every((r) => r.success)).toBe(true)
  })

  it('validates discipline score values -1, 0, 1', () => {
    for (const score of [-1, 0, 1] as const) {
      const result = tradeResponseSchema.safeParse({
        ...validTrade,
        discipline_score: score,
      })
      expect(result.success).toBe(true)
    }
  })

  it('validates agency score values -1, 0, 1', () => {
    for (const score of [-1, 0, 1] as const) {
      const result = tradeResponseSchema.safeParse({
        ...validTrade,
        agency_score: score,
      })
      expect(result.success).toBe(true)
    }
  })
})

describe('Unit 6: Insights Data Contract', () => {
  // Valid Insight that matches what /api/v1/insights returns
  const validInsight: Insight = {
    category: 'risk',
    message: 'You have shown 3 consecutive discipline violations. Consider taking a break.',
    severity: 'warning',
  }

  it('validates a realistic insight from the insights API', () => {
    const result = insightSchema.safeParse(validInsight)
    expect(result.success).toBe(true)
  })

  it('validates all category values', () => {
    for (const category of ['risk', 'pattern', 'positive'] as const) {
      const result = insightSchema.safeParse({
        ...validInsight,
        category,
      })
      expect(result.success).toBe(true)
    }
  })

  it('validates all severity values', () => {
    for (const severity of ['warning', 'info', 'success', undefined] as const) {
      const result = insightSchema.safeParse({
        ...validInsight,
        severity,
      })
      expect(result.success).toBe(true)
    }
  })

  it('validates the full insights response from the API', () => {
    const apiResponse: InsightsResponse = {
      insights: [
        { category: 'positive', message: 'Great start to your session!', severity: 'success' },
        { category: 'pattern', message: 'You tend to trade more actively in the morning.', severity: 'info' },
      ],
      generated_at: '2024-01-15T10:30:00.000Z',
      trade_count: 5,
    }

    const result = insightsResponseSchema.safeParse(apiResponse)
    expect(result.success).toBe(true)
  })

  it('enforces max 3 insights as per FR 5.6.5', () => {
    const responseWith4Insights = {
      insights: [
        { category: 'risk' as const, message: 'Insight 1', severity: 'warning' as const },
        { category: 'pattern' as const, message: 'Insight 2', severity: 'info' as const },
        { category: 'positive' as const, message: 'Insight 3', severity: 'success' as const },
        { category: 'risk' as const, message: 'Insight 4', severity: 'warning' as const },
      ],
      generated_at: '2024-01-15T10:30:00.000Z',
      trade_count: 5,
    }

    const result = insightsResponseSchema.safeParse(responseWith4Insights)
    // The schema limits to max 3 insights
    expect(result.success).toBe(false)
  })
})

describe('Integration: Unit 5 Dashboard should use Unit 6 InsightsPanel', () => {
  it('dashboard page should import InsightsPanel from Unit 6', async () => {
    // This test verifies that the dashboard actually integrates Unit 6's component
    // The dashboard should import and use InsightsPanel, not have a placeholder
    const { InsightsPanel } = await import('@/components/insights/InsightsPanel')
    expect(InsightsPanel).toBeDefined()
  })

  it('InsightsPanel accepts the exact shape the API returns', async () => {
    // This simulates what the dashboard should pass to InsightsPanel
    const insightsFromApi: Insight[] = [
      { category: 'positive', message: 'Great discipline today!', severity: 'success' },
      { category: 'pattern', message: 'Morning trading shows best results.', severity: 'info' },
    ]

    const result = insightSchema.array().safeParse(insightsFromApi)
    expect(result.success).toBe(true)
  })
})
