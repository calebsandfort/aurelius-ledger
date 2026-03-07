import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { ReactNode } from 'react'
import { useInsights } from './useInsights'
import type { InsightsResponse } from '@/lib/schemas/insights'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

// Wrapper component to provide React Query context
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  }
}

// Helper to create mock insights response
function createMockInsightsResponse(overrides: Partial<InsightsResponse> = {}): InsightsResponse {
  return {
    insights: [
      {
        category: 'positive',
        message: 'Welcome to your trading session. Log your first trade to get personalized insights.',
        severity: 'info',
      },
    ],
    generated_at: '2024-01-15T10:30:00.000Z',
    trade_count: 0,
    ...overrides,
  }
}

describe('useInsights', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
  })

  // Test that hook fetches from correct API endpoint
  it('fetches insights from /api/v1/insights endpoint', async () => {
    const mockResponse = createMockInsightsResponse()
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    })

    const { result } = renderHook(() => useInsights(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    // Just verify URL was called
    expect(mockFetch).toHaveBeenCalled()
    expect(mockFetch).toHaveBeenCalledWith('/api/v1/insights')
  })

  // Test that hook returns loading state initially
  it('returns isLoading true initially', () => {
    const mockResponse = createMockInsightsResponse()
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    })

    const { result } = renderHook(() => useInsights(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)
  })

  // Test that hook returns insights data on success
  it('returns insights data on successful fetch', async () => {
    const mockResponse = createMockInsightsResponse({
      insights: [
        { category: 'positive', message: 'Great trading!', severity: 'success' },
        { category: 'pattern', message: 'You tend to trade more in the morning.', severity: 'info' },
      ],
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    })

    const { result } = renderHook(() => useInsights(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockResponse)
  })

  // Test that hook returns error state on fetch failure
  it('returns error state on fetch failure', async () => {
    // Create a mock that throws when json() is called (simulating failed response)
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => {
        throw new Error('Failed to parse JSON')
      },
    })

    const { result } = renderHook(() => useInsights(), {
      wrapper: createWrapper(),
    })

    // Wait for either success or error state
    await waitFor(() => {
      expect(result.current.isSuccess || result.current.isError).toBe(true)
    }, { timeout: 3000 })

    // Since response.ok is false, the hook should throw
    expect(result.current.isError).toBe(true)
  })

  // Test that hook returns empty insights array when no trades
  it('returns empty insights when trade_count is 0', async () => {
    const mockResponse = createMockInsightsResponse({
      insights: [],
      trade_count: 0,
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    })

    const { result } = renderHook(() => useInsights(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data?.insights).toHaveLength(0)
  })

  // Test that hook can accept session_id parameter
  it('accepts optional session_id parameter', async () => {
    const mockResponse = createMockInsightsResponse()
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    })

    const { result } = renderHook(() => useInsights('test-session-123'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/v1/insights?session_id=test-session-123')
  })

  // Test that hook handles multiple insights (up to 3)
  it('returns up to 3 insights', async () => {
    const mockResponse = createMockInsightsResponse({
      insights: [
        { category: 'positive', message: 'Insight 1', severity: 'success' },
        { category: 'pattern', message: 'Insight 2', severity: 'info' },
        { category: 'risk', message: 'Insight 3', severity: 'warning' },
      ],
      trade_count: 5,
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    })

    const { result } = renderHook(() => useInsights(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data?.insights).toHaveLength(3)
  })

  // Test that generated_at timestamp is returned
  it('returns generated_at timestamp', async () => {
    const testTimestamp = '2024-01-15T14:30:00.000Z'
    const mockResponse = createMockInsightsResponse({
      generated_at: testTimestamp,
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    })

    const { result } = renderHook(() => useInsights(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data?.generated_at).toBe(testTimestamp)
  })

  // Test that trade_count is returned
  it('returns trade_count', async () => {
    const mockResponse = createMockInsightsResponse({
      trade_count: 10,
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    })

    const { result } = renderHook(() => useInsights(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data?.trade_count).toBe(10)
  })

  // Test refetch capability
  it('has refetch function available', async () => {
    const mockResponse = createMockInsightsResponse()
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    })

    const { result } = renderHook(() => useInsights(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(typeof result.current.refetch).toBe('function')
  })
})
