'use client'

import { AlertTriangle } from 'lucide-react'
import type { WarningLevel } from '@/hooks/useBehavioralWarnings'

interface WarningIndicatorProps {
  level: WarningLevel
  message: string
  triggeredBy: number[]
  className?: string
}

/**
 * WarningIndicator - Visual behavioral warning display
 *
 * FR 4.4: Visual only, not interruptive
 * FR 4.4: Include tooltip explaining trigger
 * FR 4.4: Fade when negative pattern resolves
 */
export function WarningIndicator({
  level,
  message,
  triggeredBy,
  className,
}: WarningIndicatorProps) {
  if (level === 'none' || !message) {
    return null
  }

  const isAmber = level === 'amber'
  const isOrange = level === 'orange'

  return (
    <div
      className={`
        flex items-center gap-2 px-4 py-2 rounded-lg border transition-opacity duration-300
        ${isAmber ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : ''}
        ${isOrange ? 'bg-orange-500/10 border-orange-500/20 text-orange-400' : ''}
        ${className || ''}
      `}
      title={`Triggered by trades: ${triggeredBy.map((i) => i + 1).join(', ')}`}
    >
      <AlertTriangle size={16} className="flex-shrink-0" />
      <span className="text-sm font-medium">{message}</span>
      {triggeredBy.length > 0 && (
        <span className="text-xs text-slate-500 ml-2">
          (Trades {triggeredBy.map((i) => i + 1).join(', ')})
        </span>
      )}
    </div>
  )
}
