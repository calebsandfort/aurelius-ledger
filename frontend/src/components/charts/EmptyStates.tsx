'use client'

interface EmptyStatesProps {
  tradeCount: number
  className?: string
}

/**
 * EmptyStates - Early session placeholder messages
 *
 * FR 4.5: 0 trades: placeholder with "Log your first trade..."
 * FR 4.5: 1 trade: single data point with "1 trade logged..."
 * FR 4.5: 2 trades: line connecting points with "2 trades..."
 * FR 4.5: Clearly indicate 5+ trade threshold
 */
export function EmptyStates({ tradeCount, className }: EmptyStatesProps) {
  // Handle invalid trade counts
  if (tradeCount < 0 || tradeCount >= 5) {
    return null
  }

  return (
    <div
      className={className}
      data-testid="empty-state"
    >
      {tradeCount === 0 && (
        <div className="flex flex-col items-center justify-center h-full text-slate-400">
          <p className="text-sm">Log your first trade to see performance insights</p>
        </div>
      )}
      {tradeCount === 1 && (
        <div className="flex flex-col items-center justify-center h-full text-slate-400">
          <p className="text-sm">1 trade logged, keep going...</p>
        </div>
      )}
      {tradeCount === 2 && (
        <div className="flex flex-col items-center justify-center h-full text-slate-400">
          <p className="text-sm">2 trades logged, patterns emerging...</p>
        </div>
      )}
      {tradeCount === 3 && (
        <div className="flex flex-col items-center justify-center h-full text-slate-400">
          <p className="text-sm">3 trades logged, building momentum...</p>
        </div>
      )}
      {tradeCount === 4 && (
        <div className="flex flex-col items-center justify-center h-full text-slate-400">
          <p className="text-sm">Almost there - 5 trades for full analysis</p>
        </div>
      )}
    </div>
  )
}
