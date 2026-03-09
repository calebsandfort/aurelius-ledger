import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { trades, sessions } from '@/db/schema'
import { tradeInputSchema, tradeResponseSchema } from '@/lib/schemas/trade'
import { eq, desc } from 'drizzle-orm'

// Rate limiting: Max 30 trades per minute per user
const rateLimitMap = new Map<string, { count: number; timestamp: number }>()
const RATE_LIMIT = 30
const RATE_WINDOW_MS = 60000

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const userLimit = rateLimitMap.get(userId)

  if (!userLimit || now - userLimit.timestamp > RATE_WINDOW_MS) {
    rateLimitMap.set(userId, { count: 1, timestamp: now })
    return true
  }

  if (userLimit.count >= RATE_LIMIT) {
    return false
  }

  userLimit.count++
  return true
}

// GET /api/v1/trades - Returns list of trades for the current session/user
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

    // Get the most recent active session for this user
    const userSessions = await db
      .select()
      .from(sessions)
      .where(eq(sessions.userId, user.id))
      .orderBy(desc(sessions.startedAt))
      .limit(1)

    if (userSessions.length === 0) {
      return NextResponse.json({ data: [], meta: { total: 0 } })
    }

    const currentSession = userSessions[0]

    // Get trades for this session
    const userTrades = await db
      .select()
      .from(trades)
      .where(eq(trades.sessionId, currentSession.id))
      .orderBy(desc(trades.sequenceNumber))

    const responseData = userTrades.map(trade => ({
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
    }))

    return NextResponse.json({
      data: responseData,
      meta: { total: responseData.length }
    })
  } catch (error) {
    console.error('GET /api/v1/trades error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/v1/trades - Create a new trade
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { user } = session

    // Rate limiting check
    if (!checkRateLimit(user.id)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Max 30 trades per minute.' },
        { status: 429 }
      )
    }

    const body = await request.json()

    // Validate input
    const validationResult = tradeInputSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.errors[0].message },
        { status: 400 }
      )
    }

    const { raw_input } = validationResult.data

    // Get or create active session for this user
    const userSessions = await db
      .select()
      .from(sessions)
      .where(eq(sessions.userId, user.id))
      .orderBy(desc(sessions.startedAt))
      .limit(1)

    let currentSession = userSessions[0]

    // If no session exists or previous session ended, create a new one
    if (!currentSession || currentSession.endedAt) {
      const [newSession] = await db
        .insert(sessions)
        .values({
          userId: user.id,
          totalPnl: '0',
          winCount: 0,
          lossCount: 0,
          breakevenCount: 0,
          netDisciplineScore: 0,
          netAgencyScore: 0,
          tradeCount: 0,
        })
        .returning()

      currentSession = newSession
    }

    // Get next sequence number for this session
    const existingTrades = await db
      .select({ sequenceNumber: trades.sequenceNumber })
      .from(trades)
      .where(eq(trades.sessionId, currentSession.id))
      .orderBy(desc(trades.sequenceNumber))
      .limit(1)

    const nextSequenceNumber = existingTrades.length > 0
      ? Number(existingTrades[0].sequenceNumber) + 1
      : 1

    // Create trade with pending extraction status
    // In a real implementation, this would call the backend AI service
    // For now, we create a basic trade entry with pending extraction
    const [newTrade] = await db
      .insert(trades)
      .values({
        sessionId: currentSession.id,
        sequenceNumber: nextSequenceNumber,
        rawInput: raw_input,
        direction: 'long',
        outcome: 'win',
        pnl: '0',
        disciplineScore: 0,
        agencyScore: 0,
        disciplineConfidence: 'low',
        agencyConfidence: 'low',
      } as const)
      .returning()

    // Update session trade count
    await db
      .update(sessions)
      .set({ tradeCount: currentSession.tradeCount + 1 })
      .where(eq(sessions.id, currentSession.id))

    // Fire async extraction to backend (non-blocking)
    const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:8000'
    fetch(`${backendUrl}/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trade_id: newTrade.id, raw_input }),
    }).catch((err) => console.error('Extraction fire-and-forget failed:', err))

    const responseData = {
      id: newTrade.id,
      session_id: newTrade.sessionId,
      sequence_number: Number(newTrade.sequenceNumber),
      direction: newTrade.direction,
      outcome: newTrade.outcome,
      pnl: Number(newTrade.pnl),
      setup_description: newTrade.setupDescription,
      discipline_score: Number(newTrade.disciplineScore),
      agency_score: Number(newTrade.agencyScore),
      discipline_confidence: newTrade.disciplineConfidence,
      agency_confidence: newTrade.agencyConfidence,
      created_at: newTrade.createdAt.toISOString(),
    }

    // Validate response matches schema
    tradeResponseSchema.parse(responseData)

    return NextResponse.json({
      data: responseData,
      meta: { sequence_number: nextSequenceNumber }
    }, { status: 201 })
  } catch (error) {
    console.error('POST /api/v1/trades error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
