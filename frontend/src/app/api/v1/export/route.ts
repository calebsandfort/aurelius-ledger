import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { trades, sessions } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'

type ExportFormat = 'json' | 'csv'

// GET /api/v1/export - Export session data
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { user } = session
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') as ExportFormat | null

    // Validate format parameter
    if (!format || !['json', 'csv'].includes(format)) {
      return NextResponse.json(
        { error: 'Invalid format. Use format=json or format=csv' },
        { status: 400 }
      )
    }

    // Get all sessions for this user
    const userSessions = await db
      .select()
      .from(sessions)
      .where(eq(sessions.userId, user.id))
      .orderBy(desc(sessions.startedAt))

    if (userSessions.length === 0) {
      if (format === 'json') {
        return NextResponse.json({
          sessions: [],
          trades: [],
          exported_at: new Date().toISOString(),
        })
      }
      // For CSV with no data, return headers only
      return new NextResponse(
        'id,session_id,sequence_number,direction,outcome,pnl,setup_description,discipline_score,agency_score,discipline_confidence,agency_confidence,created_at\n',
        {
          status: 200,
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': 'attachment; filename="trades.csv"',
          },
        }
      )
    }

    // Get all trades for all user sessions
    const sessionIds = userSessions.map(s => s.id)
    const userTrades = await db
      .select()
      .from(trades)
      .where(eq(trades.sessionId, sessionIds[0])) // Export current session by default
      .orderBy(desc(trades.sequenceNumber))

    // If format is CSV, convert to CSV
    if (format === 'csv') {
      const headers = [
        'id',
        'session_id',
        'sequence_number',
        'direction',
        'outcome',
        'pnl',
        'setup_description',
        'discipline_score',
        'agency_score',
        'discipline_confidence',
        'agency_confidence',
        'created_at',
      ]

      const csvRows = [headers.join(',')]

      for (const trade of userTrades) {
        const row = [
          trade.id,
          trade.sessionId,
          String(trade.sequenceNumber),
          trade.direction,
          trade.outcome,
          String(trade.pnl),
          trade.setupDescription || '',
          String(trade.disciplineScore),
          String(trade.agencyScore),
          trade.disciplineConfidence,
          trade.agencyConfidence,
          trade.createdAt.toISOString(),
        ]
        // Escape commas and quotes in CSV
        const escapedRow = row.map(cell => {
          const escaped = cell.replace(/"/g, '""')
          return escaped.includes(',') || escaped.includes('"') || escaped.includes('\n')
            ? `"${escaped}"`
            : escaped
        })
        csvRows.push(escapedRow.join(','))
      }

      return new NextResponse(csvRows.join('\n'), {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="trades.csv"',
        },
      })
    }

    // JSON format - return full session data
    const currentSession = userSessions[0]

    const responseData = {
      session: {
        id: currentSession.id,
        user_id: currentSession.userId,
        total_pnl: Number(currentSession.totalPnl),
        win_count: currentSession.winCount,
        loss_count: currentSession.lossCount,
        breakeven_count: currentSession.breakevenCount,
        net_discipline_score: currentSession.netDisciplineScore,
        net_agency_score: currentSession.netAgencyScore,
        trade_count: currentSession.tradeCount,
        started_at: currentSession.startedAt.toISOString(),
        ended_at: currentSession.endedAt?.toISOString() || null,
      },
      trades: userTrades.map(trade => ({
        id: trade.id,
        session_id: trade.sessionId,
        sequence_number: Number(trade.sequenceNumber),
        direction: trade.direction,
        outcome: trade.outcome,
        pnl: Number(trade.pnl),
        setup_description: trade.setupDescription,
        discipline_score: Number(trade.disciplineScore),
        agency_score: Number(trade.agencyScore),
        discipline_confidence: trade.disciplineConfidence,
        agency_confidence: trade.agencyConfidence,
        created_at: trade.createdAt.toISOString(),
      })),
      exported_at: new Date().toISOString(),
    }

    return NextResponse.json(responseData)
  } catch (error) {
    console.error('GET /api/v1/export error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
