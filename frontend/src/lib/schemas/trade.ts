import { z } from 'zod'

// Input schema for trade submission
export const tradeInputSchema = z.object({
  raw_input: z.string().min(1, 'Trade description is required').max(5000).trim(),
})

export type TradeInput = z.infer<typeof tradeInputSchema>

// Response schema for trade data
export const tradeResponseSchema = z.object({
  id: z.string().uuid(),
  session_id: z.string().uuid(),
  sequence_number: z.number().int().positive(),
  direction: z.enum(['long', 'short']),
  outcome: z.enum(['win', 'loss', 'breakeven']),
  pnl: z.number(),
  setup_description: z.string().max(2000).nullable(),
  discipline_score: z.number().int().min(-1).max(1),
  agency_score: z.number().int().min(-1).max(1),
  discipline_confidence: z.enum(['high', 'medium', 'low']),
  agency_confidence: z.enum(['high', 'medium', 'low']),
  created_at: z.string().datetime(),
})

export type TradeResponse = z.infer<typeof tradeResponseSchema>

// For API responses
export interface TradeApiResponse {
  data: TradeResponse
  meta?: { sequence_number: number }
}
