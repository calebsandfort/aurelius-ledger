import { z } from 'zod'

// Insight schema for behavioral analysis
export const insightSchema = z.object({
  category: z.enum(['risk', 'pattern', 'positive']),
  message: z.string().max(500),
  severity: z.enum(['warning', 'info', 'success']).optional(),
})

export type Insight = z.infer<typeof insightSchema>

// Insights response schema
export const insightsResponseSchema = z.object({
  insights: z.array(insightSchema).max(3),
  generated_at: z.string().datetime(),
  trade_count: z.number().int().min(0),
})

export type InsightsResponse = z.infer<typeof insightsResponseSchema>
