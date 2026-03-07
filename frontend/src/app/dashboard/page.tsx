"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PnLChart } from "@/components/charts/PnLChart"
import { DisciplineChart } from "@/components/charts/DisciplineChart"
import { AgencyChart } from "@/components/charts/AgencyChart"
import { WarningIndicator } from "@/components/charts/WarningIndicator"
import { EmptyStates } from "@/components/charts/EmptyStates"
import { useBehavioralWarnings } from "@/hooks/useBehavioralWarnings"
import type { TradeResponse } from "@/lib/schemas/trade"

/**
 * DashboardPage - Main trading dashboard
 *
 * FR 4.0: Display current-day data in a single-screen vertically-stacked layout
 * FR 4.0: Four main components: P&L Chart, Discipline Chart, Agency Chart, Insights Panel
 * FR 4.0: P&L Chart is largest and most prominent
 * FR 4.0: Discipline and agency charts side-by-side
 * FR 4.0: Assess session state in 3 seconds or less
 * FR 4.1-4.7: Chart components handle their specific requirements
 */
export default function DashboardPage() {
  const { user, isPending: authPending, signOut } = useAuth()
  const [trades, setTrades] = useState<TradeResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch trades on mount
  useEffect(() => {
    async function fetchTrades() {
      try {
        const response = await fetch('/api/v1/trades')
        if (!response.ok) {
          throw new Error('Failed to fetch trades')
        }
        const data = await response.json()
        // API returns data in reverse order (newest first), reverse for display
        setTrades(data.data ? [...data.data].reverse() : [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setIsLoading(false)
      }
    }

    if (user) {
      fetchTrades()
    }
  }, [user])

  // Get warning state
  const warningState = useBehavioralWarnings(trades)

  if (authPending) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950">
        <p className="text-muted-foreground">Loading...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-100">Dashboard</h1>
            <p className="text-slate-400 mt-1">
              {user?.name ? `Welcome back, ${user.name}` : 'Your trading session'}
            </p>
          </div>
          <div className="flex gap-3 items-center">
            <Link
              href="/docs/architecture/index.html"
              className="font-bold uppercase tracking-widest text-xs text-slate-400 hover:text-slate-200 px-3 py-2"
            >
              Docs
            </Link>
            <Link
              href="/help/getting-started/index.html"
              className="font-bold uppercase tracking-widest text-xs text-slate-400 hover:text-slate-200 px-3 py-2"
            >
              Help
            </Link>
            <Button variant="outline" asChild>
              <Link href="/chat">Chat</Link>
            </Button>
            <Button variant="ghost" onClick={signOut}>
              Sign Out
            </Button>
          </div>
        </div>

        {/* Warning Indicator */}
        <div className="mb-4">
          <WarningIndicator
            level={warningState.level}
            message={warningState.message}
            triggeredBy={warningState.triggeredBy}
          />
        </div>

        {/* P&L Chart - Largest and most prominent */}
        <Card className="mb-6 bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-slate-100">Cumulative P&L</CardTitle>
            <CardDescription className="text-slate-400">
              Running total of your profit and loss
            </CardDescription>
          </CardHeader>
          <CardContent>
            {trades.length < 5 ? (
              <EmptyStates tradeCount={trades.length} className="h-[300px]" />
            ) : (
              <PnLChart trades={trades} isLoading={isLoading} />
            )}
            {isLoading && (
              <div className="flex items-center justify-center h-[300px]">
                <p className="text-slate-400">Loading...</p>
              </div>
            )}
            {!isLoading && error && (
              <div className="flex items-center justify-center h-[300px]">
                <p className="text-red-400">Error: {error}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Discipline and Agency Charts - Side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Discipline Chart */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-slate-100">Discipline Score</CardTitle>
              <CardDescription className="text-slate-400">
                Track your trading discipline over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              {trades.length === 0 ? (
                <EmptyStates tradeCount={0} className="h-[250px]" />
              ) : (
                <DisciplineChart trades={trades} isLoading={isLoading} />
              )}
            </CardContent>
          </Card>

          {/* Agency Chart */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-slate-100">Agency Score</CardTitle>
              <CardDescription className="text-slate-400">
                Track your trading agency over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              {trades.length === 0 ? (
                <EmptyStates tradeCount={0} className="h-[250px]" />
              ) : (
                <AgencyChart trades={trades} isLoading={isLoading} />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Insights Panel Placeholder */}
        <Card className="mt-6 bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-slate-100">Session Insights</CardTitle>
            <CardDescription className="text-slate-400">
              AI-powered analysis of your trading patterns
            </CardDescription>
          </CardHeader>
          <CardContent>
            {trades.length === 0 ? (
              <p className="text-slate-500 text-sm">
                Log trades to see AI-powered insights about your trading patterns.
              </p>
            ) : trades.length < 5 ? (
              <p className="text-slate-500 text-sm">
                Keep logging trades to unlock personalized insights. {5 - trades.length} more{' '}
                {5 - trades.length === 1 ? 'trade' : 'trades'} needed.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-slate-800/50">
                  <p className="text-sm text-slate-400">Total Trades</p>
                  <p className="text-2xl font-bold text-slate-100">{trades.length}</p>
                </div>
                <div className="p-4 rounded-lg bg-slate-800/50">
                  <p className="text-sm text-slate-400">Win Rate</p>
                  <p className="text-2xl font-bold text-slate-100">
                    {trades.filter((t) => t.outcome === 'win').length > 0
                      ? Math.round(
                          (trades.filter((t) => t.outcome === 'win').length / trades.length) * 100
                        )
                      : 0}
                    %
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-slate-800/50">
                  <p className="text-sm text-slate-400">Net Discipline</p>
                  <p
                    className={`text-2xl font-bold ${
                      trades.reduce((sum, t) => sum + t.discipline_score, 0) >= 0
                        ? 'text-green-500'
                        : 'text-red-500'
                    }`}
                  >
                    {trades.reduce((sum, t) => sum + t.discipline_score, 0)}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
