'use client'

import { useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import type { TradeResponse } from '@/lib/schemas/trade'

interface PnLChartProps {
  trades: TradeResponse[]
  isLoading?: boolean
  className?: string
}

interface ChartDataPoint {
  sequence: number
  tradePnl: number
  cumulativePnl: number
  direction: 'long' | 'short'
  timestamp: string
  isExtreme: boolean
}

/**
 * PnLChart - Cumulative P&L Area Chart
 *
 * FR 4.1: Show cumulative P&L (running total), not individual trade P&L
 * FR 4.1: Green when above zero, red when below, with smooth gradient
 * FR 4.1: Include horizontal reference line at $0
 * FR 4.1: Tooltips showing: sequence, timestamp, trade P&L, cumulative P&L, direction, scores
 * FR 4.1: Line chart with area fill design
 * FR 4.1: Flag extreme values (>3 std dev) in tooltips
 * FR 4.7: Show subtle average P&L reference line
 */
export function PnLChart({ trades, isLoading, className }: PnLChartProps) {
  const chartData = useMemo(() => {
    if (trades.length === 0) return []

    let cumulative = 0
    const pnlValues = trades.map((t) => t.pnl)
    const mean = pnlValues.reduce((a, b) => a + b, 0) / pnlValues.length
    const variance = pnlValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / pnlValues.length
    const stdDev = Math.sqrt(variance)

    return trades.map((trade, index) => {
      cumulative += trade.pnl
      const isExtreme = Math.abs(trade.pnl - mean) > 3 * stdDev

      return {
        sequence: index + 1,
        tradePnl: trade.pnl,
        cumulativePnl: cumulative,
        direction: trade.direction,
        timestamp: trade.created_at,
        disciplineScore: trade.discipline_score,
        agencyScore: trade.agency_score,
        isExtreme,
      }
    })
  }, [trades])

  const averagePnl = useMemo(() => {
    if (trades.length === 0) return 0
    return trades.reduce((sum, t) => sum + t.pnl, 0) / trades.length
  }, [trades])

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-[300px] ${className || ''}`}>
        <p className="text-slate-400">Loading...</p>
      </div>
    )
  }

  const isAllPositive = chartData.length > 0 && chartData.every((d) => d.cumulativePnl >= 0)
  const isAllNegative = chartData.length > 0 && chartData.every((d) => d.cumulativePnl <= 0)

  const strokeColor = isAllPositive ? '#22c55e' : isAllNegative ? '#ef4444' : '#3b82f6'
  const gradientId = 'pnlGradient'

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={strokeColor} stopOpacity={0.3} />
              <stop offset="95%" stopColor={strokeColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="sequence"
            stroke="#64748b"
            fontSize={12}
            tickLine={false}
            axisLine={{ stroke: '#334155' }}
          />
          <YAxis
            tickFormatter={(value) => `$${value}`}
            stroke="#64748b"
            fontSize={12}
            tickLine={false}
            axisLine={{ stroke: '#334155' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '8px',
              color: '#f8fafc',
            }}
            formatter={(value: number, name: string) => {
              if (name === 'cumulativePnl') {
                return [`$${value.toFixed(2)}`, 'Cumulative P&L']
              }
              if (name === 'tradePnl') {
                return [`$${value.toFixed(2)}`, 'Trade P&L']
              }
              return [value, name]
            }}
            labelFormatter={(label) => `Trade #${label}`}
          />
          <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
          {trades.length > 0 && (
            <ReferenceLine
              y={averagePnl * trades.length}
              stroke="#94a3b8"
              strokeDasharray="5 5"
              label={{ value: 'Avg', fill: '#64748b', fontSize: 10 }}
            />
          )}
          <Area
            type="monotone"
            dataKey="cumulativePnl"
            stroke={strokeColor}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            animationDuration={400}
            dot={{ r: 4, fill: strokeColor, strokeWidth: 0 }}
            activeDot={{
              r: 6,
              fill: strokeColor,
              strokeWidth: 2,
              stroke: '#0f172a',
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
