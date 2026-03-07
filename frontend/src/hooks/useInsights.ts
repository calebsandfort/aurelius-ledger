'use client'

import { useQuery } from '@tanstack/react-query'
import type { InsightsResponse } from '@/lib/schemas/insights'

interface UseInsightsOptions {
  sessionId?: string
}

async function fetchInsights(sessionId?: string): Promise<InsightsResponse> {
  const url = sessionId
    ? `/api/v1/insights?session_id=${encodeURIComponent(sessionId)}`
    : '/api/v1/insights'

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to fetch insights: ${response.statusText}`)
  }

  return response.json()
}

export function useInsights(sessionId?: string) {
  return useQuery<InsightsResponse, Error>({
    queryKey: ['insights', sessionId],
    queryFn: () => fetchInsights(sessionId),
    staleTime: 30000, // 30 seconds
    retry: 1,
  })
}
