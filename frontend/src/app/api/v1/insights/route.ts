import { NextResponse } from 'next/server'
import { insightsResponseSchema } from '@/lib/schemas/insights'

// Stub for insights API - returns mock data until Unit 4 is implemented
export async function GET() {
  // Mock response for development until Unit 4 (Insights Agent) is implemented
  const mockInsights = {
    insights: [
      {
        category: 'positive' as const,
        message: 'Welcome to your trading session. Log your first trade to get personalized insights.',
        severity: 'info' as const,
      },
    ],
    generated_at: new Date().toISOString(),
    trade_count: 0,
  }

  return NextResponse.json(mockInsights)
}
