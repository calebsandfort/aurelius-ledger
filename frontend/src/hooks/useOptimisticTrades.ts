"use client"

import { useCallback, useState } from 'react'
import type { TradeResponse } from '@/lib/schemas/trade'

export interface PendingTrade {
  id: string
  session_id: string
  sequence_number: number
  direction: 'long' | 'short'
  outcome: 'win' | 'loss' | 'breakeven'
  pnl: number
  setup_description: string | null
  discipline_score: number
  agency_score: number
  discipline_confidence: 'high' | 'medium' | 'low'
  agency_confidence: 'high' | 'medium' | 'low'
  created_at: string
  raw_input: string
}

export interface UseOptimisticTradesResult {
  pendingTrades: Map<string, PendingTrade>
  addOptimisticTrade: (tempId: string, rawInput: string) => PendingTrade
  resolveTrade: (tempId: string, actual: TradeResponse) => void
  rejectTrade: (tempId: string) => void
}

/**
 * useOptimisticTrades - Optimistic UI hook for trade management
 *
 * Manages pending trades with optimistic updates for immediate UI feedback.
 * Trades are added optimistically with placeholder data, then resolved
 * when the server responds.
 *
 * FR 1.2.1: The system SHALL use optimistic UI updates, displaying the
 * submitted trade data immediately.
 *
 * FR 1.2.2: The system SHALL sync with the server response after submission
 * to ensure consistency.
 */
export function useOptimisticTrades(): UseOptimisticTradesResult {
  const [pendingTrades, setPendingTrades] = useState<Map<string, PendingTrade>>(new Map())

  /**
   * Add an optimistic trade to the pending map
   * FR 1.2.1: Displays trade immediately with placeholder data
   */
  const addOptimisticTrade = useCallback((tempId: string, rawInput: string): PendingTrade => {
    const optimisticTrade: PendingTrade = {
      id: tempId,
      session_id: 'pending',
      sequence_number: -1, // Placeholder until server responds
      direction: 'long', // Default - will be updated by AI extraction
      outcome: 'win', // Default - will be updated by AI extraction
      pnl: 0, // Default - will be updated by AI extraction
      setup_description: null,
      discipline_score: 0,
      agency_score: 0,
      discipline_confidence: 'low',
      agency_confidence: 'low',
      created_at: new Date().toISOString(),
      raw_input: rawInput,
    }

    setPendingTrades(prev => {
      const newMap = new Map(prev)
      newMap.set(tempId, optimisticTrade)
      return newMap
    })

    return optimisticTrade
  }, [])

  /**
   * Resolve a pending trade with the actual server response
   * FR 1.2.2: Syncs optimistic data with server response
   */
  const resolveTrade = useCallback((tempId: string, _actual: TradeResponse): void => {
    setPendingTrades(prev => {
      const newMap = new Map(prev)
      newMap.delete(tempId)
      return newMap
    })
  }, [])

  /**
   * Reject a pending trade (e.g., on error)
   * Removes the optimistic trade without replacing it with server data
   */
  const rejectTrade = useCallback((tempId: string): void => {
    setPendingTrades(prev => {
      const newMap = new Map(prev)
      newMap.delete(tempId)
      return newMap
    })
  }, [])

  return {
    pendingTrades,
    addOptimisticTrade,
    resolveTrade,
    rejectTrade,
  }
}
