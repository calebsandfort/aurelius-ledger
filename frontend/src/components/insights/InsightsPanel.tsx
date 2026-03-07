'use client'

import type { Insight } from '@/lib/schemas/insights'

interface InsightsPanelProps {
  insights: Insight[]
  generatedAt?: string
  isLoading?: boolean
  className?: string
}

function formatTime(dateString: string): string {
  const date = new Date(dateString)
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const seconds = date.getSeconds().toString().padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}

export function InsightsPanel({
  insights,
  generatedAt,
  isLoading,
  className,
}: InsightsPanelProps) {
  const displayInsights = insights.slice(0, 3)

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case 'success':
        return 'border-green-500/30 bg-green-500/5 text-green-400'
      case 'warning':
        return 'border-yellow-500/30 bg-yellow-500/5 text-yellow-400'
      default:
        return 'border-slate-700 bg-slate-800/50 text-slate-300'
    }
  }

  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-lg p-4 ${className ?? ''}`}>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-medium text-rose-400">AI Insights</h3>
        {generatedAt && (
          <span className="text-xs text-slate-500">
            Last updated: {formatTime(generatedAt)}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <div className="h-16 bg-slate-800/50 animate-pulse rounded-lg" />
          <div className="h-16 bg-slate-800/50 animate-pulse rounded-lg" />
        </div>
      ) : displayInsights.length === 0 ? (
        <p className="text-slate-500 text-sm">No insights available yet.</p>
      ) : (
        <ul className="space-y-2">
          {displayInsights.map((insight, index) => (
            <li
              key={index}
              className={`p-3 rounded-lg border ${getSeverityColor(insight.severity)}`}
            >
              <p className="text-sm">{insight.message}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
