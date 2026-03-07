"use client"

import { useState, useRef, useCallback } from 'react'
import { useOptimisticTrades } from '@/hooks/useOptimisticTrades'
import { tradeInputSchema } from '@/lib/schemas/trade'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface TradeEntryProps {
  className?: string
}

/**
 * TradeEntry - Natural language trade input component
 *
 * Fixed at bottom of screen, accepts free-form natural language descriptions
 * of completed trades with optimistic UI updates.
 *
 * FR 1.0: The system SHALL provide a persistent text input at the bottom
 * of the dashboard that accepts free-form natural language descriptions.
 *
 * FR 1.1: The system SHALL accept any natural language text describing
 * a trade without requiring a specific format or structure.
 *
 * FR 1.2: The system SHALL process trade submissions with immediate feedback
 * and no page refresh.
 *
 * FR 1.3: The system SHALL clear the input field upon successful submission.
 *
 * FR 1.4: The system SHALL display a visual confirmation (green flash) upon
 * successful trade logging.
 *
 * FR 1.5: The input field SHALL auto-focus after each submission to enable
 * rapid logging.
 *
 * FR 1.6: The input SHALL remain fixed at the bottom of the screen and remain
 * accessible without navigation.
 */
export function TradeEntry({ className }: TradeEntryProps) {
  const [inputValue, setInputValue] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const { addOptimisticTrade, resolveTrade, rejectTrade } = useOptimisticTrades()

  // FR 1.2.2 - Handle successful submission and sync with server
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSuccess = useCallback((tempId: string, actualTrade: any) => {
    resolveTrade(tempId, actualTrade)
  }, [resolveTrade])

  // Submit handler with optimistic UI
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // FR 1.1: Accept any natural language text - no specific format required
    const trimmedInput = inputValue.trim()
    if (!trimmedInput) return

    // Validate input against schema
    const validation = tradeInputSchema.safeParse({ raw_input: trimmedInput })
    if (!validation.success) {
      console.error('Invalid trade input:', validation.error.errors)
      return
    }

    setIsSubmitting(true)

    // Generate temp ID for optimistic update
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`

    // FR 1.2.1: Optimistic UI - add trade immediately
    addOptimisticTrade(tempId, trimmedInput)

    try {
      const response = await fetch('/api/v1/trades', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw_input: trimmedInput }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()
      const tradeData = result.data

      // FR 1.2.2: Sync with server response
      handleSuccess(tempId, tradeData)

      // FR 1.3: Clear input field
      setInputValue('')

      // FR 1.4: Show visual confirmation (green flash)
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 1500)

      // FR 1.5: Auto-focus after submission
      inputRef.current?.focus()
    } catch (error) {
      console.error('Failed to submit trade:', error)

      // On error, remove the optimistic trade
      // The trade would need to be re-submitted by the user
      rejectTrade(tempId)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle Enter key press
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as unknown as React.FormEvent)
    }
  }

  return (
    <div
      data-testid="trade-entry-container"
      className={cn(
        // FR 1.6: Fixed at bottom of screen
        'fixed bottom-0 left-0 right-0 z-50',
        // Dark background matching design system
        'border-t border-slate-800 bg-slate-900/95 backdrop-blur-sm',
        className
      )}
    >
      <form
        onSubmit={handleSubmit}
        className="mx-auto max-w-3xl px-4 py-4"
      >
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe your trade (e.g., 'Long NQ at 17800, exited at 17850 for +$500')"
              disabled={isSubmitting}
              // FR 1.1: Accept any natural language text
              // No pattern or format restrictions
              className={cn(
                // Dark input styling
                'h-12 bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-500',
                // Focus state - blue accent
                'focus-visible:ring-blue-500 focus-visible:border-blue-500',
                // FR 1.4: Green flash on success
                showSuccess && 'border-green-500/50 bg-green-500/10',
                // Smooth transitions
                'transition-colors duration-300'
              )}
              aria-label="Trade description"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !inputValue.trim()}
            className={cn(
              // Blue primary styling
              'h-12 px-6 rounded-lg font-semibold text-sm',
              'bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500',
              'text-white transition-all duration-200',
              // Focus ring
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900',
              // FR 1.4: Green flash on success
              showSuccess && 'bg-green-600 hover:bg-green-500'
            )}
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Logging...
              </span>
            ) : showSuccess ? (
              <span className="flex items-center gap-2">
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                Logged
              </span>
            ) : (
              'Log Trade'
            )}
          </button>
        </div>

        {/* Helper text */}
        <p className="mt-2 text-xs text-slate-500">
          Press Enter to log a trade. The input auto-focuses after each submission for rapid logging.
        </p>
      </form>
    </div>
  )
}
