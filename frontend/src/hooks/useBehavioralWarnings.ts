import { useMemo } from 'react'
import type { TradeResponse } from '@/lib/schemas/trade'

export type WarningLevel = 'none' | 'amber' | 'orange'

export interface WarningState {
  level: WarningLevel
  message: string
  triggeredBy: number[]
}

/**
 * useBehavioralWarnings - Detects behavioral patterns in trade data
 *
 * Analyzes discipline and agency scores to detect negative behavioral patterns:
 * - 3 consecutive -1 scores: amber warning
 * - 4+ consecutive -1 scores: orange warning
 *
 * FR 4.4: NOT show warnings for <3 trades
 * FR 4.4: No alert for 2 consecutive -1 scores
 * FR 4.4: Yellow (amber) for 3 consecutive -1 scores
 * FR 4.4: Orange for 4+ consecutive -1 scores
 */
export function useBehavioralWarnings(trades: TradeResponse[]): WarningState {
  return useMemo(() => {
    if (trades.length < 3) {
      return { level: 'none', message: '', triggeredBy: [] }
    }

    // Find the longest consecutive streak of -1 scores (discipline or agency)
    let maxStreak = 0
    let maxStreakType: 'discipline' | 'agency' = 'discipline'
    let maxStreakEnd = 0

    let currentDisciplineStreak = 0
    let currentAgencyStreak = 0

    for (let i = 0; i < trades.length; i++) {
      const trade = trades[i]

      // Track discipline streak
      if (trade.discipline_score === -1) {
        currentDisciplineStreak++
        if (currentDisciplineStreak > maxStreak) {
          maxStreak = currentDisciplineStreak
          maxStreakType = 'discipline'
          maxStreakEnd = i
        }
      } else {
        currentDisciplineStreak = 0
      }

      // Track agency streak
      if (trade.agency_score === -1) {
        currentAgencyStreak++
        if (currentAgencyStreak > maxStreak) {
          maxStreak = currentAgencyStreak
          maxStreakType = 'agency'
          maxStreakEnd = i
        }
      } else {
        currentAgencyStreak = 0
      }
    }

    // Determine warning level based on max streak (use 0-indexed positions)
    if (maxStreak >= 4) {
      const triggeredBy: number[] = []
      for (let j = maxStreakEnd - maxStreak + 1; j <= maxStreakEnd; j++) {
        triggeredBy.push(j) // 0-indexed position
      }
      return {
        level: 'orange',
        message: maxStreak > 4 ? `${maxStreak}+ consecutive ${maxStreakType} violations` : `4+ consecutive ${maxStreakType} violations`,
        triggeredBy,
      }
    } else if (maxStreak >= 3) {
      const triggeredBy: number[] = []
      for (let j = maxStreakEnd - maxStreak + 1; j <= maxStreakEnd; j++) {
        triggeredBy.push(j) // 0-indexed position
      }
      return {
        level: 'amber',
        message: `${maxStreak} consecutive ${maxStreakType} violations`,
        triggeredBy,
      }
    }

    return { level: 'none', message: '', triggeredBy: [] }
  }, [trades])
}
