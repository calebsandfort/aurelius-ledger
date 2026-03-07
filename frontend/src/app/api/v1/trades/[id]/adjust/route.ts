import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { trades } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

// Schema for trade adjustment
const adjustmentSchema = z.object({
  discipline_score: z.number().int().min(-1).max(1).optional(),
  agency_score: z.number().int().min(-1).max(1).optional(),
  reason: z.string().min(1, 'Reason is required').max(500),
})

type AdjustmentInput = z.infer<typeof adjustmentSchema>

// PATCH /api/v1/trades/[id]/adjust - Adjust trade scores
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = await params

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: 'Invalid trade ID format' },
        { status: 400 }
      )
    }

    const body = await request.json()

    // Validate input
    const validationResult = adjustmentSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.errors[0].message },
        { status: 400 }
      )
    }

    const { discipline_score, agency_score, reason }: AdjustmentInput = validationResult.data

    // Check if trade exists
    const existingTrade = await db
      .select()
      .from(trades)
      .where(eq(trades.id, id))
      .limit(1)

    if (existingTrade.length === 0) {
      return NextResponse.json(
        { error: 'Trade not found' },
        { status: 404 }
      )
    }

    const trade = existingTrade[0]

    // Log the adjustment with the reason (in a real system, this would go to a separate table)
    // For now, we'll just update the trade with the adjusted values
    const updateData: Partial<typeof trades.$inferInsert> = {
      updatedAt: new Date(),
    }

    if (discipline_score !== undefined) {
      updateData.disciplineScore = discipline_score
    }

    if (agency_score !== undefined) {
      updateData.agencyScore = agency_score
    }

    const [updatedTrade] = await db
      .update(trades)
      .set(updateData)
      .where(eq(trades.id, id))
      .returning()

    // FR 4.8.2: Log AI/trader score discrepancies for model calibration
    // In a production system, this would store to a calibration log table
    const disciplineChanged = discipline_score !== undefined &&
      discipline_score !== Number(trade.disciplineScore)
    const agencyChanged = agency_score !== undefined &&
      agency_score !== Number(trade.agencyScore)

    if (disciplineChanged || agencyChanged) {
      console.log('[Calibration Log]', {
        trade_id: id,
        previous_discipline_score: Number(trade.disciplineScore),
        new_discipline_score: discipline_score,
        previous_agency_score: Number(trade.agencyScore),
        new_agency_score: agency_score,
        adjustment_reason: reason,
        adjusted_at: new Date().toISOString(),
      })
    }

    const responseData = {
      id: updatedTrade.id,
      session_id: updatedTrade.sessionId,
      sequence_number: Number(updatedTrade.sequenceNumber),
      direction: updatedTrade.direction,
      outcome: updatedTrade.outcome,
      pnl: Number(updatedTrade.pnl),
      setup_description: updatedTrade.setupDescription,
      discipline_score: Number(updatedTrade.disciplineScore),
      agency_score: Number(updatedTrade.agencyScore),
      discipline_confidence: updatedTrade.disciplineConfidence,
      agency_confidence: updatedTrade.agencyConfidence,
      created_at: updatedTrade.createdAt.toISOString(),
    }

    return NextResponse.json({ data: responseData })
  } catch (error) {
    console.error('PATCH /api/v1/trades/[id]/adjust error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
