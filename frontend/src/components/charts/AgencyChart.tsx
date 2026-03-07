'use client'

import { useMemo, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import type { TradeResponse } from '@/lib/schemas/trade'

interface AgencyChartProps {
  trades: TradeResponse[]
  isLoading?: boolean
  className?: string
}

interface ChartDataPoint {
  sequence: number
  runningSum: number
  score: number
  movingAverage?: number
}

/**
 * AgencyChart - Running Agency Score Chart
 *
 * FR 4.3: Mirror discipline chart format
 * FR 4.3: Use distinct colors (indigo/rose palette)
 * FR 4.3: Show running sum of agency scores
 * FR 4.3: Reference line at y=0
 * FR 4.3: Toggle for 3-trade moving average overlay
 * FR 4.3: Window to last 50 trades if session exceeds 50
 */
export function AgencyChart({ trades, isLoading, className }: AgencyChartProps) {
  const [showMovingAverage, setShowMovingAverage] = useState(false)

  const chartData = useMemo(() => {
    const limitedTrades = trades.length > 50 ? trades.slice(-50) : trades

    if (limitedTrades.length === 0) return []

    let runningSum = 0
    const data = limitedTrades.map((trade, index) => {
      runningSum += trade.agency_score
      return {
        sequence: index + 1,
        runningSum,
        score: trade.agency_score,
      }
    })

    // Calculate 3-trade moving average
    if (showMovingAverage && data.length >= 3) {
      for (let i = 2; i < data.length; i++) {
        const avg = (data[i - 2].score + data[i - 1].score + data[i].score) / 3
        data[i] = { ...data[i], movingAverage: avg }
      }
    }

    return data
  }, [trades, showMovingAverage])

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-[300px] ${className || ''}`}>
        <p className="text-slate-400">Loading...</p>
      </div>
    )
  }

  const getScoreColor = (score: number) => {
    if (score === 1) return '#8b5cf6' // violet/indigo
    if (score === -1) return '#f43f5e' // rose
    return '#64748b' // gray
  }

  return (
    <div className={className}>
      <div className="flex justify-end mb-2">
        <button
          onClick={() => setShowMovingAverage(!showMovingAverage)}
          className={`
            px-3 py-1 text-xs rounded-md transition-colors
            ${showMovingAverage
              ? 'bg-violet-600 text-white'
              : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }
          `}
        >
          3-Trade Moving Avg
        </button>
      </div>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="sequence"
            stroke="#64748b"
            fontSize={12}
            tickLine={false}
            axisLine={{ stroke: '#334155' }}
          />
          <YAxis
            stroke="#64748b"
            fontSize={12}
            tickLine={false}
            axisLine={{ stroke: '#334155' }}
            domain={['auto', 'auto']}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '8px',
              color: '#f8fafc',
            }}
            formatter={(value: number, name: string) => {
              if (name === 'runningSum') {
                return [value.toString(), 'Running Sum']
              }
              if (name === 'movingAverage') {
                return [value.toFixed(2), '3-Trade Avg']
              }
              return [value, 'Score']
            }}
            labelFormatter={(label) => `Trade #${label}`}
          />
          <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
          <Line
            type="stepAfter"
            dataKey="runningSum"
            stroke="#8b5cf6"
            strokeWidth={2}
            animationDuration={400}
            dot={(props: { cx?: number; cy?: number; payload?: ChartDataPoint }) => {
              const { cx, cy, payload } = props
              if (cx === undefined || cy === undefined || !payload) return null
              const color = getScoreColor(payload.score)
              return (
                <circle
                  key={`dot-${payload.sequence}`}
                  cx={cx}
                  cy={cy}
                  r={4}
                  fill={color}
                  stroke={color}
                />
              )
            }}
          />
          {showMovingAverage && (
            <Line
              type="monotone"
              dataKey="movingAverage"
              stroke="#f43f5e"
              strokeWidth={2}
              strokeDasharray="5 5"
              animationDuration={400}
              dot={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
