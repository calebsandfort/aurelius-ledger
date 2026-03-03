# Aurelius Ledger Technical Specification

## Project Goal

The Aurelius Ledger is a lightweight web application for logging futures trades during live trading sessions. The system enables frictionless natural language trade logging with AI-powered behavioral scoring and real-time session insights, helping traders improve their discipline and decision-making.

---

## Functional Requirements

### FR 1.0 Trade Entry System

The system SHALL accept free-form natural language trade descriptions through a persistent text input field at the bottom of the dashboard.

- **FR 1.1** The system SHALL clear the input field upon successful trade submission.
- **FR 1.2** The system SHALL auto-populate the trade timestamp at the moment of submission.
- **FR 1.3** The system SHALL require no specific format or structure from the user.
- **FR 1.4** The system SHALL process one trade per submission.

#### Technical Implementation

**Component Structure:**
- **Frontend Component:** `frontend/src/components/dashboard/TradeEntryInput.tsx`
- **API Endpoint:** `POST /api/v1/trades`
- **State Management:** React useState for input, optimistic UI updates

**Data Flow:**
```
User Input → TradeEntryInput.tsx → API Route → FastAPI Backend → Database
                              ↓
                        WebSocket Broadcast → Dashboard Update
```

**Validation Schema (Zod - frontend/src/lib/schemas/trade.ts):**
```typescript
import { z } from 'zod'

export const TradeEntrySchema = z.object({
  description: z.string()
    .min(1, 'Trade description is required')
    .max(2000, 'Description too long')
})
```

**API Contract:**
- **Request:** `{ "description": string }`
- **Response (Success):** `201 { "success": true, "data": { "trade": Trade, "insights": Insight[] } }`
- **Response (Error):** `400 { "success": false, "error": string }` | `401` | `500`

**Security Considerations:**
- Input sanitization via Zod validation
- Rate limiting: Max 10 trades per minute per user
- XSS prevention: React auto-escaping handles this

---

### FR 2.0 AI Trade Extraction

The system SHALL extract structured data from natural language trade descriptions using an AI agent.

- **FR 2.1** The system SHALL extract the following required fields from each trade description:
  - `direction`: "long" or "short"
  - `outcome`: "win", "loss", or "breakeven"
  - `pnl`: Decimal dollar value (positive for wins, negative for losses)
  - `setup_description`: Natural language summary of the trade setup
  - `discipline_score`: Integer value of -1, 0, or 1
  - `agency_score`: Integer value of -1, 0, or 1

- **FR 2.2** The system SHALL use a LangGraph-based extraction pipeline with a validation step that retries on schema mismatch.

- **FR 2.3** The system SHALL include 3-5 few-shot examples in the extraction prompt covering: clear wins, clear losses, breakeven trades, ambiguous discipline/agency, and minimal descriptions.

- **FR 2.4** The system SHALL apply heuristic mapping for ambiguous P&L phrases:
  - "small winner": $50-$100
  - "small loser": -$50 to -$100
  - "nice win": $200-$500
  - "big loser": -$500+
  - "breakeven" / "scratched": $0

- **FR 2.5** The system SHALL return confidence scores (0.0-1.0) alongside discipline and agency scores.

- **FR 2.6** The system SHALL handle confidence levels as follows:
  - High confidence (0.85-1.0): Display score normally
  - Medium confidence (0.60-0.84): Display score with subtle indicator
  - Low confidence (0.00-0.59): Display as "insufficient signal" and exclude from rolling averages

- **FR 2.7** The system SHALL return an error if P&L cannot be determined from the description.

- **FR 2.8** The system SHALL surface clear user-facing errors when extraction fails, including specific guidance on what information is missing.

- **FR 2.9** The extraction system prompt SHALL include behavioral scoring criteria (FR 3.1-3.7) as part of the extraction instructions to enable single-pass extraction of all fields.

#### Technical Implementation

**Backend Module:** `backend/src/agents/extraction/graph.py`

**LangGraph Pipeline:**
```
User Description
      ↓
[LLM Node: Extract Fields]
      ↓
[Validation Node: Check Schema]
      ↓ (valid)
[Output: Structured Trade]
      ↓ (invalid, retry count < 2)
[Refinement Node: Add Context]
      ↓
[Retry LLM Node]
```

**Pydantic Models (backend/src/schemas/trade.py):**
```python
from pydantic import BaseModel, Field, field_validator
from typing import Literal, Optional
from decimal import Decimal

class TradeExtraction(BaseModel):
    direction: Literal["long", "short"]
    outcome: Literal["win", "loss", "breakeven"]
    pnl: Decimal = Field(..., ge=-100000, le=100000, decimal_places=2)
    setup_description: str = Field(..., min_length=1, max_length=1000)
    discipline_score: int = Field(..., ge=-1, le=1)
    agency_score: int = Field(..., ge=-1, le=1)
    confidence_score: float = Field(..., ge=0.0, le=1.0)
    is_estimated_pnl: bool = False

    @field_validator('pnl')
    @classmethod
    def validate_pnl_sign(cls, v, info):
        outcome = info.data.get('outcome')
        if outcome == 'win' and v < 0:
            raise ValueError('Win must have positive P&L')
        if outcome == 'loss' and v > 0:
            raise ValueError('Loss must have negative P&L')
        return v

class ExtractionResult(BaseModel):
    success: bool
    trade: Optional[TradeExtraction] = None
    error: Optional[str] = None
    retry_count: int = 0
    prompt_version: str = "1.0.0"
```

**Prompt Template (backend/src/agents/extraction/prompts.py):**
```python
EXTRACTION_PROMPT = """You are a trading trade analyzer. Extract structured data from natural language trade descriptions.

# Few-Shot Examples

Example 1 (Clear Win):
"Longed NQ at 17500, hit target at 17600 for +$500. Waited for the pullback and entered on confirmation."
→ direction: long, outcome: win, pnl: 500, setup_description: Entered on pullback confirmation, discipline_score: 1, agency_score: 1

Example 2 (Clear Loss):
"Chased ES higher, got stopped for -$250. Knew better but couldn't help myself."
→ direction: long, outcome: loss, pnl: -250, setup_description: Chased higher, discipline_score: -1, agency_score: -1

Example 3 (Breakeven):
"Scratched the spread trade at even. No harm done."
→ direction: short, outcome: breakeven, pnl: 0, setup_description: Spread trade, discipline_score: 0, agency_score: 0

# P&L Heuristics
- "small winner" → $50-$100
- "small loser" → -$50 to -$100
- "nice win" → $200-$500
- "big loser" → -$500 or more
- "breakeven" / "scratched" → $0

# Behavioral Scoring Criteria

## Discipline Score
- +1: patience and intentional execution ("waited for confirmation", "followed my plan", "patient entry")
- -1: reactive or impulsive execution ("chased", "fomo'd", "revenge trade", "didn't wait")
- 0: behavioral signals absent or ambiguous

## Agency Score
- +1: intentional action ("decided to", "chose to", "my call")
- -1: loss of control ("knew better but couldn't help it", "lost control")
- -1: self-deprecating patterns:
  - External attribution on wins ("got lucky", "market gave me that one")
  - Internal attribution on losses ("I messed up", "I'm so stupid")

When discipline and agency conflict, agency takes precedence.

# Output Format
Return JSON with all extracted fields. If P&L cannot be determined, return error.
"""
```

**API Endpoint:**
- **Route:** `POST /api/v1/trades/extract`
- **Request:** `{ "description": string }`
- **Response (Success):** `200 { "success": true, "data": TradeExtraction }`
- **Response (Error):** `400 { "success": false, "error": "Cannot determine P&L from description" }`

**Timeout Handling:**
- LLM call timeout: 2.5 seconds (NFR 1.2)
- Retry logic: Max 2 retries with refined prompt

---

### FR 3.0 Behavioral Scoring

The system SHALL infer behavioral scores from trade descriptions to track trading psychology.

- **FR 3.1** The system SHALL assign discipline_score = 1 for language indicating patience and intentional execution (e.g., "waited for confirmation," "followed my plan," "patient entry").

- **FR 3.2** The system SHALL assign discipline_score = -1 for language indicating reactive or impulsive execution (e.g., "chased," "fomo'd," "revenge trade," "didn't wait").

- **FR 3.3** The system SHALL assign discipline_score = 0 when behavioral signals are absent or ambiguous.

- **FR 3.4** The system SHALL assign agency_score = 1 for language indicating intentional action (e.g., "decided to," "chose to," "my call").

- **FR 3.5** The system SHALL assign agency_score = -1 for language indicating loss of control (e.g., "knew better but couldn't help it," "lost control").

- **FR 3.6** When discipline and agency scores conflict, the agency score SHALL take precedence for behavioral insight purposes.

- **FR 3.7** The system SHALL detect self-deprecating language patterns and assign agency_score = -1 for:
  - External attribution on wins (e.g., "got lucky," "market gave me that one")
  - Internal attribution on losses (e.g., "I messed up," "I'm so stupid")

#### Technical Implementation

The behavioral scoring is embedded in the extraction prompt (see FR 2.0 Technical Implementation). The scoring criteria are included as part of the single-pass extraction to ensure consistent behavioral analysis.

**Key Implementation Points:**
- All behavioral scoring happens in the LLM via the prompt (FR 2.9)
- Agency takes precedence when there's conflict (FR 3.6 logic implemented in frontend/backend aggregation)
- Self-deprecating patterns are explicitly in the prompt

**Frontend Display Logic (frontend/src/components/dashboard/BehavioralIndicators.tsx):**
```typescript
interface BehavioralIndicatorProps {
  disciplineScore: number
  agencyScore: number
  confidence: number
}

// Confidence handling per FR 2.6
const getScoreDisplay = (score: number, confidence: number) => {
  if (confidence < 0.60) {
    return { value: null, label: 'Insufficient signal', excludedFromAvg: true }
  }
  if (confidence >= 0.60 && confidence < 0.85) {
    return { value: score, label: `${score > 0 ? '+' : ''}${score}`, indicator: 'subtle' }
  }
  return { value: score, label: `${score > 0 ? '+' : ''}${score}`, indicator: 'normal' }
}
```

---

### FR 4.0 Data Persistence

The system SHALL persist trade data to a relational database.

- **FR 4.1** The system SHALL create a `trading_days` record automatically when the first trade of a calendar day is logged.

- **FR 4.2** The system SHALL maintain running aggregates in the `trading_days` table after each trade insertion:
  - Total P&L
  - Win count, loss count
  - Running sum of discipline scores
  - Running sum of agency scores

- **FR 4.3** The system SHALL store confidence scores and estimated P&L flags in the database for later analysis.

- **FR 4.4** The system SHALL implement the following denormalized session metrics:
  - peak_pnl (highest cumulative P&L)
  - trough_pnl (lowest cumulative P&L)
  - largest_win, largest_loss
  - consecutive_wins, consecutive_losses

- **FR 4.5** The system SHALL store all timestamps in UTC.

- **FR 4.6** The system SHALL display timestamps in the user's configured timezone.

#### Technical Implementation

**Database Schema - Drizzle (frontend/src/db/schema/trading.ts):**
```typescript
import { pgTable, uuid, timestamp, date, decimal, integer, boolean, text, primaryKey } from 'drizzle-orm/pg-core'
import { user } from './auth'

export const tradingDays = pgTable('trading_days', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => user.id),
  date: date('date').notNull().unique(),
  totalPnl: decimal('total_pnl', { precision: 14, scale: 2 }),
  winCount: integer('win_count').default(0),
  lossCount: integer('loss_count').default(0),
  breakevenCount: integer('breakeven_count').default(0),
  disciplineSum: integer('discipline_sum').default(0),
  agencySum: integer('agency_sum').default(0),
  peakPnl: decimal('peak_pnl', { precision: 14, scale: 2 }),
  troughPnl: decimal('trough_pnl', { precision: 14, scale: 2 }),
  largestWin: decimal('largest_win', { precision: 12, scale: 2 }),
  largestLoss: decimal('largest_loss', { precision: 12, scale: 2 }),
  consecutiveWins: integer('consecutive_wins').default(0),
  consecutiveLosses: integer('consecutive_losses').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const trades = pgTable('trades', {
  id: uuid('id').primaryKey().defaultRandom(),
  tradingDayId: uuid('trading_day_id').notNull().references(() => tradingDays.id),
  userId: text('user_id').notNull().references(() => user.id),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
  direction: varchar('direction', { length: 5 }).notNull(), // 'long' | 'short'
  outcome: varchar('outcome', { length: 10 }).notNull(), // 'win' | 'loss' | 'breakeven'
  pnl: decimal('pnl', { precision: 12, scale: 2 }).notNull(),
  setupDescription: text('setup_description'),
  disciplineScore: integer('discipline_score').notNull(),
  agencyScore: integer('agency_score').notNull(),
  confidenceScore: decimal('confidence_score', { precision: 3, scale: 2 }),
  isEstimatedPnl: boolean('is_estimated_pnl').default(false),
  insightText: text('insight_text'), // Stored for idempotency
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
```

**SQL Schema (for reference/migration):**
```sql
-- TimescaleDB hypertable setup
CREATE TABLE IF NOT EXISTS trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trading_day_id UUID NOT NULL REFERENCES trading_days(id),
    user_id TEXT NOT NULL REFERENCES "user"(id),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    direction VARCHAR(5) NOT NULL,
    outcome VARCHAR(10) NOT NULL,
    pnl DECIMAL(12,2) NOT NULL,
    setup_description TEXT,
    discipline_score INTEGER NOT NULL,
    agency_score INTEGER NOT NULL,
    confidence_score DECIMAL(3,2),
    is_estimated_pnl BOOLEAN DEFAULT FALSE,
    insight_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Convert to TimescaleDB hypertable
SELECT create_hypertable('trades', 'timestamp', if_not_exists => TRUE);

-- Indexes for performance
CREATE INDEX idx_trades_trading_day_timestamp ON trades (trading_day_id, timestamp DESC);
CREATE INDEX idx_trades_user_recent ON trades (user_id, timestamp DESC);

-- Trading days table
CREATE TABLE IF NOT EXISTS trading_days (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES "user"(id),
    date DATE NOT NULL UNIQUE,
    total_pnl DECIMAL(14,2),
    win_count INTEGER DEFAULT 0,
    loss_count INTEGER DEFAULT 0,
    breakeven_count INTEGER DEFAULT 0,
    discipline_sum INTEGER DEFAULT 0,
    agency_sum INTEGER DEFAULT 0,
    peak_pnl DECIMAL(14,2),
    trough_pnl DECIMAL(14,2),
    largest_win DECIMAL(12,2),
    largest_loss DECIMAL(12,2),
    consecutive_wins INTEGER DEFAULT 0,
    consecutive_losses INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- Continuous aggregate for hourly rollups (after 90 days)
CREATE MATERIALIZED VIEW trades_hourly_agg
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', timestamp) AS bucket,
    trading_day_id,
    COUNT(*) AS trade_count,
    SUM(pnl) AS total_pnl,
    AVG(discipline_score) AS avg_discipline,
    AVG(agency_score) AS avg_agency
FROM trades
WHERE timestamp < NOW() - INTERVAL '90 days'
GROUP BY bucket, trading_day_id;

-- Add refresh policy
SELECT add_continuous_aggregate_policy('trades_hourly_agg',
    start_offset => INTERVAL '90 days',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour');
```

**Update Aggregate Logic (backend/src/services/trading_day_service.py):**
```python
async def update_trading_day_aggregates(trade: Trade, trading_day: TradingDay) -> TradingDay:
    """Update denormalized aggregates after trade insertion."""
    # Calculate new totals
    new_total_pnl = (trading_day.total_pnl or 0) + trade.pnl
    new_discipline_sum = trading_day.discipline_sum + trade.discipline_score
    new_agency_sum = trading_day.agency_sum + trade.agency_score

    # Update win/loss counts
    new_win_count = trading_day.win_count
    new_loss_count = trading_day.loss_count
    new_breakeven_count = trading_day.breakeven_count

    if trade.outcome == 'win':
        new_win_count += 1
    elif trade.outcome == 'loss':
        new_loss_count += 1
    else:
        new_breakeven_count += 1

    # Update peak/trough
    peak_pnl = max(trading_day.peak_pnl or 0, new_total_pnl)
    trough_pnl = min(trading_day.trough_pnl or 0, new_total_pnl)

    # Update largest win/loss
    largest_win = trading_day.largest_win
    largest_loss = trading_day.largest_loss
    if trade.outcome == 'win' and (not largest_win or trade.pnl > largest_win):
        largest_win = trade.pnl
    if trade.outcome == 'loss' and (not largest_loss or trade.pnl < largest_loss):
        largest_loss = trade.pnl

    # Update consecutive counts
    if trade.outcome == 'win':
        consecutive_wins = trading_day.consecutive_wins + 1
        consecutive_losses = 0
    elif trade.outcome == 'loss':
        consecutive_losses = trading_day.consecutive_losses + 1
        consecutive_wins = 0
    else:
        consecutive_wins = 0
        consecutive_losses = 0

    return TradingDay(
        total_pnl=new_total_pnl,
        win_count=new_win_count,
        loss_count=new_loss_count,
        breakeven_count=new_breakeven_count,
        discipline_sum=new_discipline_sum,
        agency_sum=new_agency_sum,
        peak_pnl=peak_pnl,
        trough_pnl=trough_pnl,
        largest_win=largest_win,
        largest_loss=largest_loss,
        consecutive_wins=consecutive_wins,
        consecutive_losses=consecutive_losses,
    )
```

**Timezone Handling:**
- Database stores all timestamps in UTC (TIMESTAMPTZ)
- Frontend displays in user's configured timezone using Intl.DateTimeFormat
- User timezone stored in user preferences table

---

### FR 5.0 Dashboard Display

The system SHALL display current-day trading data in a real-time dashboard.

- **FR 5.1** The system SHALL display only current-day data in the dashboard (not historical).

- **FR 5.2** The dashboard SHALL use a 2x2 grid layout with:
  - P&L Time Series Chart (top-left, primary)
  - Discipline Score Chart (top-right)
  - Agency Score Chart (bottom-left)
  - AI Insights Panel (bottom-right)

- **FR 5.3** The P&L chart SHALL display cumulative P&L over time using smooth line interpolation.

- **FR 5.4** The discipline and agency charts SHALL use step interpolation (discrete values, not continuous lines).

- **FR 5.5** The dashboard SHALL include a header summary bar with:
  - Session P&L
  - Trade count
  - Win rate
  - Average Win Amount
  - Average Loss Amount
  - Session duration

- **FR 5.6** The P&L chart SHALL use green (#22c55e) for positive values and red (#ef4444) for negative values.

- **FR 5.7** The discipline and agency charts SHALL use blue (#3b82f6) for positive trends and amber (#f59e0b) for negative trends.

- **FR 5.8** The system SHALL provide a collapsible insights panel with a "peek" state showing one insight by default.

- **FR 5.9** The system SHALL use Recharts for dashboard visualizations.

#### Technical Implementation

**Dashboard Layout Component (frontend/src/app/dashboard/page.tsx):**
```typescript
import { PnlChart } from '@/components/dashboard/pnl-chart'
import { DisciplineChart } from '@/components/dashboard/discipline-chart'
import { AgencyChart } from '@/components/dashboard/agency-chart'
import { InsightsPanel } from '@/components/dashboard/insights-panel'
import { SessionSummary } from '@/components/dashboard/session-summary'
import { TradeEntryInput } from '@/components/dashboard/trade-entry-input'

export default function DashboardPage() {
  return (
    <div className="flex flex-col h-screen">
      {/* Header Summary Bar */}
      <SessionSummary />

      {/* 2x2 Grid */}
      <div className="flex-1 grid grid-cols-2 gap-4 p-4">
        <div className="col-span-2 lg:col-span-1">
          <PnlChart />
        </div>
        <div className="col-span-2 lg:col-span-1">
          <DisciplineChart />
        </div>
        <div className="col-span-2 lg:col-span-1">
          <AgencyChart />
        </div>
        <div className="col-span-2 lg:col-span-1">
          <InsightsPanel />
        </div>
      </div>

      {/* Persistent Trade Entry */}
      <TradeEntryInput />
    </div>
  )
}
```

**P&L Chart Component (frontend/src/components/dashboard/pnl-chart.tsx):**
```typescript
'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { useMemo } from 'react'

interface PnlChartProps {
  trades: Trade[]
}

export function PnlChart({ trades }: PnlChartProps) {
  const data = useMemo(() => {
    let cumulative = 0
    return trades.map(trade => {
      cumulative += Number(trade.pnl)
      return {
        time: trade.timestamp,
        pnl: cumulative,
        tradeId: trade.id
      }
    })
  }, [trades])

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <XAxis dataKey="time" tickFormatter={formatTime} />
        <YAxis tickFormatter={formatCurrency} />
        <Tooltip formatter={formatCurrency} labelFormatter={formatTime} />
        <ReferenceLine y={0} stroke="#666" />
        <Line
          type="monotone"
          dataKey="pnl"
          stroke={data[data.length - 1]?.pnl >= 0 ? '#22c55e' : '#ef4444'}
          strokeWidth={2}
          dot={{ r: 4, className: 'animate-pulse' }}
          animationDuration={150}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
```

**Discipline/Agency Chart Component (frontend/src/components/dashboard/discipline-chart.tsx):**
```typescript
'use client'

import { ComposedChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

interface BehavioralChartProps {
  trades: Trade[]
  scoreType: 'discipline' | 'agency'
}

export function DisciplineChart({ trades }: BehavioralChartProps) {
  const data = trades.map(trade => ({
    time: trade.timestamp,
    score: trade.disciplineScore,
    confidence: Number(trade.confidenceScore)
  }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data}>
        <XAxis dataKey="time" tickFormatter={formatTime} />
        <YAxis domain={[-1, 1]} ticks={[-1, 0, 1]} />
        <Tooltip />
        <ReferenceLine y={0} stroke="#666" />
        <Line
          type="step"
          dataKey="score"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={{ r: 4, fill: '#3b82f6' }}
          connectNulls={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
```

**Session Summary Component:**
```typescript
export function SessionSummary({ tradingDay }: { tradingDay: TradingDay }) {
  const winRate = tradingDay.winCount / (tradingDay.winCount + tradingDay.lossCount) * 100
  const avgWin = tradingDay.largestWin && tradingDay.winCount > 0
    ? Number(tradingDay.largestWin) / tradingDay.winCount
    : 0
  const avgLoss = tradingDay.largestLoss && tradingDay.lossCount > 0
    ? Number(tradingDay.largestLoss) / tradingDay.lossCount
    : 0

  return (
    <div className="flex gap-6 p-4 bg-muted/20">
      <Stat label="P&L" value={formatCurrency(tradingDay.totalPnl)} />
      <Stat label="Trades" value={tradingDay.winCount + tradingDay.lossCount + tradingDay.breakevenCount} />
      <Stat label="Win Rate" value={`${winRate.toFixed(1)}%`} />
      <Stat label="Avg Win" value={formatCurrency(avgWin)} />
      <Stat label="Avg Loss" value={formatCurrency(avgLoss)} />
      <Stat label="Duration" value={getSessionDuration(tradingDay)} />
    </div>
  )
}
```

**Color Palette:**
- Positive P&L: `#22c55e` (green-500)
- Negative P&L: `#ef4444` (red-500)
- Positive behavioral: `#3b82f6` (blue-500)
- Negative behavioral: `#f59e0b` (amber-500)

---

### FR 6.0 Real-Time Updates

The system SHALL update the dashboard in real-time after each trade is logged without page refresh.

- **FR 6.1** The system SHALL use WebSocket connections for real-time updates.

- **FR 6.2** The system SHALL implement adaptive throttling:
  - Immediate updates during active trading (within 30 seconds of last trade)
  - Heartbeat every 10 seconds during idle state
  - Maximum 2 updates per second during fast market mode

- **FR 6.3** Chart updates SHALL use instant updates with 150ms transition for normal conditions.

- **FR 6.4** The most recent data point SHALL have a subtle pulse animation to indicate current state.

#### Technical Implementation

**WebSocket Connection (frontend/src/lib/websocket.ts):**
```typescript
'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

interface WebSocketOptions {
  url: string
  onMessage: (data: DashboardUpdate) => void
  onError?: (error: Event) => void
  lastTradeTime: Date | null
}

export function useRealtimeDashboard({ url, onMessage, onError, lastTradeTime }: WebSocketOptions) {
  const ws = useRef<WebSocket | null>(null)
  const [status, setStatus] = useState<'connected' | 'disconnected' | 'reconnecting'>('disconnected')
  const lastUpdateRef = useRef<number>(0)

  const shouldThrottle = useCallback(() => {
    const now = Date.now()
    if (now - lastUpdateRef.current < 500) { // Max 2 updates/second
      return true
    }
    return false
  }, [])

  useEffect(() => {
    ws.current = new WebSocket(url)

    ws.current.onopen = () => setStatus('connected')
    ws.current.onclose = () => setStatus('disconnected')
    ws.current.onerror = (error) => {
      setStatus('reconnecting')
      onError?.(error)
    }

    ws.current.onmessage = (event) => {
      if (shouldThrottle()) return

      const data = JSON.parse(event.data)
      lastUpdateRef.current = Date.now()
      onMessage(data)
    }

    // Adaptive throttling: heartbeat
    const heartbeatInterval = setInterval(() => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({ type: 'heartbeat' }))
      }
    }, 10000)

    return () => {
      ws.current?.close()
      clearInterval(heartbeatInterval)
    }
  }, [url, onMessage, onError, shouldThrottle])

  return { status, send: ws.current?.send }
}
```

**Backend WebSocket (backend/src/websockets/dashboard.py):**
```python
from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, Set
import asyncio

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(websocket)

    def disconnect(self, websocket: WebSocket, user_id: str):
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)

    async def broadcast(self, user_id: str, message: dict):
        if user_id in self.active_connections:
            # Adaptive throttling logic
            await asyncio.gather(
                *[connection.send_json(message) for connection in self.active_connections[user_id]]
            )

manager = ConnectionManager()

@app.websocket("/ws/dashboard/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    await manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            # Handle client messages (e.g., ack, heartbeat response)
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
```

**Chart Animation (frontend/src/components/dashboard/pnl-chart.tsx):**
```typescript
// Add pulse animation to latest dot
<Line
  // ... other props
  dot={(props: any) => {
    const { cx, cy, payload, index } = props
    const isLatest = index === data.length - 1
    return (
      <circle
        cx={cx}
        cy={cy}
        r={isLatest ? 6 : 4}
        className={isLatest ? 'animate-pulse' : ''}
        fill={payload.pnl >= 0 ? '#22c55e' : '#ef4444'}
      />
    )
  }}
/>
```

**Debounced Re-render Hook (frontend/src/hooks/use-debounced-update.ts):**
```typescript
'use client'

import { useEffect, useRef, useState } from 'react'

export function useDebouncedUpdate<T>(value: T, delay: number = 100): T {
  const [debouncedValue, setDebouncedValue] = useState(value)
  const rafRef = useRef<number>()

  useEffect(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
    }

    rafRef.current = requestAnimationFrame(() => {
      setDebouncedValue(value)
    })

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [value])

  return debouncedValue
}
```

**Fallback to Polling:**
- If WebSocket fails to connect, fall back to 2-second polling interval
- Clear polling on reconnection

---

### FR 7.0 AI Insights Generation

The system SHALL generate actionable behavioral insights after each trade is logged.

- **FR 7.1** The system SHALL pass both raw trade records AND aggregated session stats to the insights agent (hybrid context).

- **FR 7.2** The system SHALL include the last 7 trades with full detail plus full-session aggregated statistics in the insights context.

- **FR 7.3** Insights SHALL be generated asynchronously and returned as a complete block (not streamed).

- **FR 7.4** Insights SHALL be generated using a structured `SessionSummary` interface containing:
  - pnl_statistics (total, average, largest_win, largest_loss)
  - outcome_distribution (wins, losses, breakeven counts and percentages)
  - discipline_trend (current score, rolling average, trajectory)
  - agency_trend (current score, rolling average, trajectory)
  - recent_trades (last 7 trades with full detail)

- **FR 7.5** The system SHALL prioritize insights in the following order:
  1. Tilt Risk Indicator (highest priority)
  2. Discipline Trajectory
  3. Agency Trend
  4. Outcome Patterns

- **FR 7.6** The system SHALL calculate a Tilt Risk Score using:
  - Consecutive losses (weighted x2)
  - Discipline decline rate
  - Agency decline rate

- **FR 7.7** The tilt risk thresholds SHALL be:
  - 0-1: No alert
  - 2-3: Yellow alert ("Consider taking a breath before next entry")
  - 4+: Red alert ("You may be tilted. Consider stepping away.")

- **FR 7.8** Insights SHALL differ based on session phase:
  - Mid-session (during active trading): Maximum 2-3 insights, processable in <2 seconds
  - Post-session: Up to 150 words, can reference multiple trades and historical data

- **FR 7.9** The system SHALL display a maximum of 3 insight items at a time.

- **FR 7.10** Generated insights SHALL be stored with the trade record to prevent regeneration on retry (idempotency).

#### Technical Implementation

**Session Summary Interface (backend/src/schemas/insights.py):**
```python
from pydantic import BaseModel
from typing import List, Optional
from decimal import Decimal
from datetime import datetime

class PnlStatistics(BaseModel):
    total: Decimal
    average: Decimal
    largest_win: Decimal
    largest_loss: Decimal

class OutcomeDistribution(BaseModel):
    wins: int
    losses: int
    breakeven: int
    win_rate: float
    loss_rate: float
    breakeven_rate: float

class TrendData(BaseModel):
    current: int
    rolling_average: float
    trajectory: Literal["improving", "stable", "declining"]

class TradeDetail(BaseModel):
    id: str
    timestamp: datetime
    direction: str
    outcome: str
    pnl: Decimal
    discipline_score: int
    agency_score: int
    setup_description: str

class SessionSummary(BaseModel):
    pnl_statistics: PnlStatistics
    outcome_distribution: OutcomeDistribution
    discipline_trend: TrendData
    agency_trend: TrendData
    recent_trades: List[TradeDetail]
    tilt_risk_score: int

class InsightRequest(BaseModel):
    session_summary: SessionSummary
    session_phase: Literal["mid_session", "post_session"]
    previous_insights: Optional[List[str]] = []
```

**Tilt Risk Calculation (backend/src/services/insights_service.py):**
```python
def calculate_tilt_risk(trading_day: TradingDay, recent_trades: List[Trade]) -> int:
    risk_score = 0

    # Consecutive losses (weighted x2)
    risk_score += trading_day.consecutive_losses * 2

    # Discipline decline rate
    if len(recent_trades) >= 3:
        recent_discipline = [t.discipline_score for t in recent_trades[-3:]]
        if sum(recent_discipline) < 0:
            risk_score += abs(sum(recent_discipline))

    # Agency decline rate
    if len(recent_trades) >= 3:
        recent_agency = [t.agency_score for t in recent_trades[-3:]]
        if sum(recent_agency) < 0:
            risk_score += abs(sum(recent_agency))

    return min(risk_score, 10)  # Cap at 10

def get_tilt_alert(score: int) -> Optional[str]:
    if score >= 4:
        return "You may be tilted. Consider stepping away."
    elif score >= 2:
        return "Consider taking a breath before next entry"
    return None
```

**Insights Prompt (backend/src/agents/insights/prompts.py):**
```python
INSIGHTS_PROMPT = """You are a trading psychology coach. Generate actionable insights based on the session summary.

# Session Summary
{summary_json}

# Tilt Risk Score
{score} - {alert}

# Instructions
1. Prioritize tilt risk indicator if score >= 2
2. Analyze discipline trajectory (improving/stable/declining)
3. Analyze agency trend
4. Identify outcome patterns

# Output Format
Return a JSON array of insight objects:
[
  {
    "type": "tilt_risk" | "discipline" | "agency" | "outcome",
    "priority": 1-4,
    "text": "Insight text (max 30 words for mid-session, 150 for post-session)",
    "actionable": true
  }
]

Max 3 insights. Use neutral, observational tone. Never judgmental.
"""
```

**Insights Generation API:**
- **Route:** `POST /api/v1/insights/generate`
- **Request:** `{ "session_summary": SessionSummary, "session_phase": "mid_session" | "post_session" }`
- **Response:** `200 { "success": true, "data": { "insights": Insight[], "tilt_risk_score": int } }`

**Idempotency Handling:**
- If trade already has `insight_text`, return cached insights
- Insights generated asynchronously after trade is saved

---

### FR 8.0 Visual Warnings

The system SHALL provide visual alerts for behavioral warning patterns.

- **FR 8.1** The system SHALL trigger a yellow visual warning when:
  - 3 consecutive discipline -1 scores occur
  - Discipline score crosses below 0
  - Agency score crosses below 0

- **FR 8.2** The system SHALL trigger a red visual warning when:
  - 3+ consecutive losses AND average discipline score < 0
  - Cumulative discipline drops below -3
  - P&L drops below -$500 with negative discipline

- **FR 8.3** Visual warnings SHALL use subtle color tinting on chart areas, not intrusive blocking elements.

#### Technical Implementation

**Warning Detection Hook (frontend/src/hooks/use-warning-detection.ts):**
```typescript
'use client'

import { useMemo } from 'react'

interface WarningState {
  level: 'none' | 'yellow' | 'red'
  reasons: string[]
}

export function useWarningDetection(trades: Trade[], tradingDay: TradingDay): WarningState {
  return useMemo(() => {
    const reasons: string[] = []
    let level: 'none' | 'yellow' | 'red' = 'none'

    // Yellow warnings
    const recentTrades = trades.slice(-3)
    const recentDiscipline = recentTrades.map(t => t.disciplineScore)
    if (recentDiscipline.every(s => s === -1)) {
      reasons.push('3 consecutive discipline violations')
      level = 'yellow'
    }

    const lastDiscipline = trades[trades.length - 1]?.disciplineScore ?? 0
    if (lastDiscipline < 0 && level !== 'red') {
      reasons.push('Discipline below neutral')
      level = 'yellow'
    }

    const lastAgency = trades[trades.length - 1]?.agencyScore ?? 0
    if (lastAgency < 0 && level !== 'red') {
      reasons.push('Agency below neutral')
      level = 'yellow'
    }

    // Red warnings
    const has3ConsecutiveLosses = tradingDay.consecutiveLosses >= 3
    const avgDiscipline = tradingDay.disciplineSum / trades.length
    if (has3ConsecutiveLosses && avgDiscipline < 0) {
      reasons.push('3+ consecutive losses with negative discipline')
      level = 'red'
    }

    if (tradingDay.disciplineSum < -3) {
      reasons.push('Cumulative discipline below -3')
      level = 'red'
    }

    const totalPnl = Number(tradingDay.totalPnl)
    if (totalPnl < -500 && lastDiscipline < 0) {
      reasons.push('P&L below -$500 with negative discipline')
      level = 'red'
    }

    return { level, reasons }
  }, [trades, tradingDay])
}
```

**Visual Implementation (frontend/src/components/dashboard/DashboardContainer.tsx):**
```typescript
'use client'

import { useWarningDetection } from '@/hooks/use-warning-detection'

export function DashboardContainer({ children, trades, tradingDay }: Props) {
  const { level, reasons } = useWarningDetection(trades, tradingDay)

  const borderColor = {
    none: 'border-transparent',
    yellow: 'border-amber-500/30',
    red: 'border-red-500/30'
  }

  const bgTint = {
    none: '',
    yellow: 'bg-amber-500/5',
    red: 'bg-red-500/5'
  }

  return (
    <div className={`border-2 rounded-lg transition-colors ${borderColor[level]} ${bgTint[level]}`}>
      {level !== 'none' && (
        <div className="p-2 text-sm text-amber-600 dark:text-amber-400">
          Warning: {reasons.join(', ')}
        </div>
      )}
      {children}
    </div>
  )
}
```

---

### FR 9.0 Positive Reinforcement

The system SHALL recognize and reinforce positive behavioral patterns.

- **FR 9.1** The system SHALL generate a "strengths highlight" when:
  - A trader maintains positive discipline through volatility
  - A trader demonstrates recovery after a loss (good agency)
  - Win rate exceeds 60% with positive discipline

- **FR 9.2** Positive insights SHALL use active, affirming language ("Your patience paid off" vs "Good discipline score").

#### Technical Implementation

**Positive Pattern Detection (backend/src/services/insights_service.py):**
```python
def detect_positive_patterns(trading_day: TradingDay, recent_trades: List[Trade]) -> List[str]:
    strengths = []

    # Maintain positive discipline through volatility
    if len(recent_trades) >= 3:
        last_3_discipline = [t.discipline_score for t in recent_trades[-3:]]
        if all(s > 0 for s in last_3_discipline):
            strengths.append("maintained_discipline_through_volatility")

    # Recovery after loss
    if len(recent_trades) >= 2:
        if recent_trades[-2].outcome == 'loss' and recent_trades[-1].agency_score > 0:
            strengths.append("recovery_after_loss")

    # Win rate > 60% with positive discipline
    if trading_day.win_count + trading_day.loss_count > 0:
        win_rate = trading_day.win_count / (trading_day.win_count + trading_day.loss_count)
        avg_discipline = trading_day.discipline_sum / (trading_day.win_count + trading_day.loss_count)
        if win_rate > 0.6 and avg_discipline > 0:
            strengths.append("profitable_with_discipline")

    return strengths

POSITIVE_MESSAGES = {
    "maintained_discipline_through_volatility": "Your patience paid off during the chop",
    "recovery_after_loss": "Strong recovery - you bounced back with clear thinking",
    "profitable_with_discipline": "Consistent discipline is generating profits"
}
```

---

### FR 10.0 Recovery Detection

The system SHALL detect and highlight behavioral recovery.

- **FR 10.1** The system SHALL detect behavioral recovery (positive discipline after 2+ consecutive negative scores) and highlight this in insights.

- **FR 10.2** Recovery insights SHALL be prioritized to reinforce successful self-regulation.

#### Technical Implementation

**Recovery Detection:**
```python
def detect_recovery(trades: List[Trade]) -> Optional[str]:
    if len(trades) < 3:
        return None

    last_2 = trades[-2:]
    if all(t.discipline_score < 0 for t in last_2):
        if trades[-1].discipline_score > 0:
            return "Behavioral recovery detected - positive discipline after negative streak"
    return None
```

---

### FR 11.0 Session Management

The system SHALL support end-of-session rituals.

- **FR 11.1** The system SHALL provide an end-of-session summary when no trades occur for 30+ minutes during market hours.

- **FR 11.2** Session summary SHALL include:
  - Win rate
  - Discipline trend
  - One key insight
  - Comparison to previous sessions (optional)

#### Technical Implementation

**Session Detection Service (backend/src/services/session_service.py):**
```python
from datetime import datetime, timedelta

MARKET_HOURS = {
    "start": 9,  # 9 AM
    "end": 16    # 4 PM
}

def is_market_hours() -> bool:
    now = datetime.utcnow()
    return MARKET_HOURS["start"] <= now.hour < MARKET_HOURS["end"]

async def check_session_closure(user_id: str) -> Optional[SessionSummary]:
    """Check if session should be closed (30+ min idle during market hours)."""
    last_trade = await get_last_trade(user_id)

    if not last_trade:
        return None

    idle_time = datetime.utcnow() - last_trade.timestamp

    if idle_time >= timedelta(minutes=30) and is_market_hours():
        trading_day = await get_trading_day(user_id, last_trade.timestamp.date())
        return generate_session_summary(trading_day)

    return None
```

**Session Summary Endpoint:**
- **Route:** `POST /api/v1/sessions/summary`
- **Response:** `{ "win_rate": float, "discipline_trend": str, "key_insight": str, "comparison": str | null }`

---

### FR 12.0 Historical Data Access

The system SHALL provide access to historical trading sessions.

- **FR 12.1** The system SHALL provide a historical sessions list view showing past trading days with summary metrics.

- **FR 12.2** The system SHALL allow users to select a historical trading day to view its dashboard (read-only).

#### Technical Implementation

**History API Endpoints:**
- **Route:** `GET /api/v1/trading-days/history`
- **Query Params:** `?page=1&limit=20`
- **Response:** `{ "success": true, "data": TradingDaySummary[], "meta": { "total": int, "page": int } }`

- **Route:** `GET /api/v1/trading-days/{id}`
- **Response:** `{ "success": true, "data": { "tradingDay": TradingDay, "trades": Trade[] } }`

**History Page (frontend/src/app/dashboard/history/page.tsx):**
```typescript
import { useQuery } from '@tanstack/react-query'
import { TradeHistoryList } from '@/components/history/trade-history-list'

export default function HistoryPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['trading-days', 'history'],
    queryFn: () => fetch('/api/v1/trading-days/history').then(r => r.json())
  })

  if (isLoading) return <LoadingSkeleton />

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Trading History</h1>
      <TradeHistoryList days={data.data} />
    </div>
  )
}
```

---

### FR 13.0 Data Export

The system SHALL enable data export for external analysis.

- **FR 13.1** The system SHALL provide JSON export of individual trading day data.

- **FR 13.2** The system SHALL provide CSV export of trading day summaries for external analysis.

#### Technical Implementation

**Export API Endpoints:**
- **Route:** `GET /api/v1/trading-days/{id}/export/json`
- **Response:** `200 { "Content-Type": "application/json", "Content-Disposition": "attachment"` with full trading day data

- **Route:** `GET /api/v1/trading-days/export/csv`
- **Query:** `?start_date=2024-01-01&end_date=2024-12-31`
- **Response:** `200 { "Content-Type": "text/csv" }`

**CSV Export Implementation:**
```python
@app.get("/api/v1/trading-days/export/csv")
async def export_trading_days_csv(
    start_date: date,
    end_date: date,
    current_user = Depends(get_current_user)
):
    trading_days = await get_trading_days(current_user.id, start_date, end_date)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        'Date', 'Total P&L', 'Win Count', 'Loss Count', 'Breakeven Count',
        'Win Rate', 'Discipline Sum', 'Agency Sum', 'Largest Win', 'Largest Loss'
    ])

    for day in trading_days:
        writer.writerow([
            day.date, day.total_pnl, day.win_count, day.loss_count,
            day.breakeven_count, calculate_win_rate(day), day.discipline_sum,
            day.agency_sum, day.largest_win, day.largest_loss
        ])

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=trading_days.csv"}
    )
```

---

### FR 14.0 Data Quality

The system SHALL validate incoming data to maintain data integrity.

- **FR 14.1** The system SHALL validate that P&L falls within reasonable bounds (|pnl| <= $100,000).

- **FR 14.2** The system SHALL compare extracted timestamps against server time and flag entries with >60 second drift.

- **FR 14.3** The system SHALL log score distribution and alert if >30% of entries receive 0 (ambiguous), indicating extraction may need tuning.

#### Technical Implementation

**Validation (backend/src/services/validation_service.py):**
```python
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

MAX_PNL = 100000
TIME_DRIFT_THRESHOLD = timedelta(seconds=60)
AMBIGUOUS_THRESHOLD = 0.30

async def validate_trade_data(trade_data: TradeExtraction, client_timestamp: datetime) -> ValidationResult:
    errors = []

    # P&L bounds check
    if abs(trade_data.pnl) > MAX_PNL:
        errors.append(f"P&L exceeds maximum of ${MAX_PNL}")

    # Time drift check
    server_time = datetime.utcnow()
    time_diff = abs(server_time - client_timestamp)
    if time_diff > TIME_DRIFT_THRESHOLD:
        logger.warning(f"Time drift detected: {time_diff} seconds")

    return ValidationResult(is_valid=len(errors) == 0, errors=errors)

async def log_score_distribution(user_id: str):
    """Log score distribution and alert if ambiguous threshold exceeded."""
    trades = await get_recent_trades(user_id, limit=100)

    total = len(trades)
    if total == 0:
        return

    ambiguous_count = sum(1 for t in trades if t.discipline_score == 0 and t.agency_score == 0)
    ambiguous_rate = ambiguous_count / total

    logger.info(f"Score distribution for {user_id}: ambiguous={ambiguous_rate:.1%}")

    if ambiguous_rate > AMBIGUOUS_THRESHOLD:
        logger.warning(
            f"Ambiguous score rate {ambiguous_rate:.1%} exceeds threshold. "
            "Consider tuning extraction prompt."
        )
```

---

### FR 15.0 Database Schema

The system SHALL implement a well-defined database schema.

- **FR 15.1** The system SHALL create a `trades` table with the following schema:
  - `id`: UUID PRIMARY KEY
  - `trading_day_id`: UUID FOREIGN KEY
  - `timestamp`: TIMESTAMPTZ NOT NULL
  - `direction`: VARCHAR(5) NOT NULL
  - `outcome`: VARCHAR(10) NOT NULL
  - `pnl`: DECIMAL(12,2) NOT NULL
  - `setup_description`: TEXT
  - `discipline_score`: INTEGER NOT NULL
  - `agency_score`: INTEGER NOT NULL
  - `confidence_score`: DECIMAL(3,2)
  - `is_estimated_pnl`: BOOLEAN DEFAULT FALSE
  - `insight_text`: TEXT (stored for idempotency)

- **FR 15.2** The system SHALL create a `trading_days` table with the following schema:
  - `id`: UUID PRIMARY KEY
  - `date`: DATE NOT NULL UNIQUE
  - `total_pnl`: DECIMAL(14,2)
  - `win_count`: INTEGER DEFAULT 0
  - `loss_count`: INTEGER DEFAULT 0
  - `breakeven_count`: INTEGER DEFAULT 0
  - `discipline_sum`: INTEGER DEFAULT 0
  - `agency_sum`: INTEGER DEFAULT 0
  - `peak_pnl`: DECIMAL(14,2)
  - `trough_pnl`: DECIMAL(14,2)
  - `largest_win`: DECIMAL(12,2)
  - `largest_loss`: DECIMAL(12,2)
  - `consecutive_wins`: INTEGER DEFAULT 0
  - `consecutive_losses`: INTEGER DEFAULT 0

- **FR 15.3** The system SHALL configure `trades` as a TimescaleDB hypertable with time-based partitioning on `timestamp`.

- **FR 15.4** The system SHALL create a continuous aggregate `trades_hourly_agg` for hourly rollups after 90 days.

#### Technical Implementation

The database schema is fully specified in FR 4.0 Technical Implementation section. Key points:

1. **Drizzle ORM Schema:** `frontend/src/db/schema/trading.ts` - Type-safe schema for frontend
2. **Raw SQL:** For TimescaleDB-specific features (hypertable, continuous aggregates)
3. **Indexes:** Composite indexes on (trading_day_id, timestamp) for time-series queries

---

## Non-Functional Requirements

### NFR 1.0 Performance

The system SHALL meet strict latency requirements for real-time trading workflows.

- **NFR 1.1** Trade entry to confirmed database write SHALL complete in under 3 seconds under normal conditions.

- **NFR 1.2** The extraction LLM call SHALL timeout at 2.5 seconds with graceful fallback to user-facing error.

- **NFR 1.3** WebSocket updates SHALL deliver with <50ms latency.

- **NFR 1.4** Chart re-renders SHALL use requestAnimationFrame to sync with browser paint cycle.

- **NFR 1.5** Chart updates SHALL debounce at 100ms after last WebSocket message before re-rendering.

- **NFR 1.6** Insights generation prompt SHALL not exceed 2500 tokens including context.

#### Technical Implementation

**Timeout Configuration (backend/src/agents/extraction/client.py):**
```python
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    model="gpt-4o-mini",
    temperature=0,
    max_tokens=500,
    request_timeout=2.5,  # NFR 1.2
    timeout=2.5
)

# Or using LangChain's timeout
response = await llm.ainvoke(
    prompt,
    config={"timeout": 2500}
)
```

**Token Budget Tracking:**
```python
def estimate_tokens(text: str) -> int:
    """Rough token estimation: ~4 chars per token."""
    return len(text) // 4

# Check budget before sending
if estimate_tokens(full_prompt) > 2500:
    # Truncate context
    context = truncate_context(context, max_tokens=2000)
```

**Frontend Debouncing:**
- Implemented in `useDebouncedUpdate` hook (see FR 6.0)
- 100ms debounce delay
- Uses requestAnimationFrame for paint sync

---

### NFR 2.0 Reliability

The system SHALL handle errors gracefully without data loss.

- **NFR 2.1** The extraction pipeline SHALL retry up to 2 times on validation failure, using a refined prompt with additional context on the second attempt, before surfacing an error.

- **NFR 2.2** Failed extractions SHALL be logged for analysis and prompt refinement.

- **NFR 2.3** Extraction logs SHALL include prompt version identifier for analysis and iteration.

- **NFR 2.4** The system SHALL handle WebSocket disconnection gracefully with fallback to 2-second polling.

- **NFR 2.5** Partial success states SHALL be handled: if trade saves but insights fail, user SHALL see "Trade saved but insights unavailable. Try refreshing."

#### Technical Implementation

**Retry Logic:**
```python
async def extract_trade_with_retry(description: str, retry_count: int = 0) -> ExtractionResult:
    try:
        result = await extract_trade(description)

        if not result.success and retry_count < 2:
            # Refine prompt with additional context
            refined_description = f"{description}\n\nContext: Previous extraction failed. Please provide all required fields."
            return await extract_trade_with_retry(refined_description, retry_count + 1)

        # Log for analysis
        logger.info({
            "event": "extraction_attempt",
            "success": result.success,
            "retry_count": retry_count,
            "prompt_version": PROMPT_VERSION,
            "error": result.error
        })

        return result

    except Exception as e:
        logger.error({"event": "extraction_error", "error": str(e)})
        raise
```

**WebSocket Fallback:**
```typescript
// frontend/src/hooks/use-realtime-dashboard.ts
useEffect(() => {
  let pollInterval: NodeJS.Timeout

  if (status === 'disconnected') {
    pollInterval = setInterval(() => {
      fetchDashboardData()
    }, 2000)
  }

  return () => clearInterval(pollInterval)
}, [status])
```

**Partial Success Handling:**
```typescript
try {
  const trade = await createTrade(description)

  // Try insights (non-blocking)
  try {
    const insights = await generateInsights(trade.id)
    return { trade, insights }
  } catch {
    // Trade saved but insights failed
    return {
      trade,
      insights: null,
      message: "Trade saved but insights unavailable. Try refreshing."
    }
  }
} catch (error) {
  // Full failure
  throw error
}
```

---

### NFR 3.0 Usability

The system SHALL provide a frictionless user experience optimized for busy traders.

- **NFR 3.1** Insights SHALL be displayable in under 2 seconds of glancing at the dashboard.

- **NFR 3.2** The system SHALL minimize cognitive load by using visual indicators (color coding, arrows) alongside text.

- **NFR 3.3** The system SHALL use neutral, action-oriented framing for warnings and positive reinforcement for good patterns (neither loss-framing nor gain-framing).

- **NFR 3.4** The system SHALL use observational tone in insights ("Discipline score declining" vs. "You're being undisciplined").

- **NFR 3.5** The system SHALL never make the trader feel judged or ashamed through shame-inducing language.

- **NFR 3.6** The dashboard SHALL support dark theme to reduce eye strain during extended sessions.

#### Technical Implementation

**Tone Guidelines (in prompts):**
```python
# Do use:
- "Discipline score declining" (observational)
- "Consider taking a break" (action-oriented)
- "Your patience paid off" (positive reinforcement)

# Don't use:
- "You blew up your account" (shame-inducing)
- "You should have known better" (judgmental)
- "Bad trade" (loss-framing)
```

**Dark Theme:**
- Tailwind CSS dark mode via `next-themes`
- Theme toggle in settings
- Dark colors: background `#0a0a0a`, foreground `#ededed`

---

### NFR 4.0 Scalability

The system SHALL handle reasonable trading volumes efficiently.

- **NFR 4.1** The database SHALL use composite indexes on (trading_day_id, timestamp) for time-series queries.

- **NFR 4.2** The database SHALL use indexes for "most recent trade" lookup with (trading_day_id DESC, timestamp DESC).

- **NFR 4.3** Dashboard queries SHALL use denormalized session metrics for O(1) access to aggregate data.

#### Technical Implementation

Indexes are specified in FR 4.0 SQL schema:
- `idx_trades_trading_day_timestamp`: Composite on (trading_day_id, timestamp)
- Denormalized aggregates in `trading_days` table for O(1) access

---

### NFR 5.0 Data Retention

The system SHALL implement appropriate data retention policies.

- **NFR 5.1** Raw trade data SHALL be retained in hot storage for 90 days.

- **NFR 5.2** Raw trade data SHALL be moved to cold storage after 90 days, retained for 365 days total.

- **NFR 5.3** Daily aggregate summaries SHALL be retained for 2 years.

- **NFR 5.4** Monthly aggregate summaries SHALL be retained indefinitely.

#### Technical Implementation

**TimescaleDB Retention Policy:**
```sql
-- Add retention policy for 365 days
SELECT add_retention_policy('trades', INTERVAL '365 days');

-- Create monthly aggregates (retained indefinitely)
CREATE MATERIALIZED VIEW trades_monthly_agg AS
SELECT
    time_bucket('1 month', timestamp) AS bucket,
    user_id,
    COUNT(*) AS trade_count,
    SUM(pnl) AS total_pnl,
    AVG(discipline_score) AS avg_discipline,
    AVG(agency_score) AS avg_agency
FROM trades
GROUP BY bucket, user_id;

-- Keep monthly aggregates indefinitely (no retention policy)
```

---

### NFR 6.0 Privacy

The system SHALL protect user data and enable user control.

- **NFR 6.1** Insights personalization SHALL be session-only, with no cross-session behavioral profiles stored.

- **NFR 6.2** All LLM inference SHALL happen without storing conversation context.

- **NFR 6.3** The system SHALL provide users the ability to delete their data.

- **NFR 6.4** The system SHALL NOT share or sell behavioral data.

#### Technical Implementation

**No Cross-Session Storage:**
- `insight_text` stored only for idempotency (same trade, not across sessions)
- No user profile table with behavioral data
- Session summary generated fresh each time

**LLM Privacy:**
```python
# No conversation history stored
llm = ChatOpenAI(model="gpt-4o-mini")
# Each request is independent - no chat history maintained
```

**Data Deletion API:**
- **Route:** `DELETE /api/v1/user/data`
- **Response:** `204 No Content`
- Implements cascading delete: trades → trading_days → user

---

## Appendix: Architecture Overview

### Tech Stack Summary

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend Framework | Next.js | 16.x |
| Language | TypeScript | 5.x |
| UI Components | Shadcn/ui | latest |
| Styling | Tailwind CSS | 4.x |
| State Management | React useState/useQuery | - |
| Auth | Better Auth | latest |
| ORM | Drizzle ORM | latest |
| Charts | Recharts | latest |
| AI Chat | CopilotKit | 1.52.x |
| Backend Framework | FastAPI | 0.115.x |
| AI Orchestration | LangGraph | 1.0.x |
| AI Framework | LangChain | 1.2.x |
| LLM | OpenAI GPT-4o-mini | - |
| Database | TimescaleDB (PostgreSQL 16) | latest |
| Package Manager | pnpm (frontend), uv (backend) | - |

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                    │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐             │
│  │ TradeEntry   │    │  Dashboard   │    │  WebSocket   │             │
│  │   Input      │───▶│    Charts    │◀───│   Client     │             │
│  └──────┬───────┘    └──────────────┘    └──────────────┘             │
│         │                                                                │
│         ▼                                                                │
│  ┌──────────────────────────────────────────────────┐                  │
│  │              Next.js API Route                   │                  │
│  │              POST /api/v1/trades                 │                  │
│  └──────────────────────┬───────────────────────────┘                  │
└────────────────────────┼───────────────────────────────────────────────┘
                         │ HTTP
                         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              BACKEND                                    │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      FastAPI Application                         │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │  │
│  │  │   Trade      │  │   Insights   │  │   Session    │            │  │
│  │  │  Controller  │  │  Controller  │  │  Controller  │            │  │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘            │  │
│  └─────────┼─────────────────┼─────────────────┼─────────────────────┘  │
│            │                 │                 │                       │
│            ▼                 ▼                 ▼                       │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    LangGraph Pipeline                             │  │
│  │  ┌────────────┐    ┌────────────┐    ┌────────────┐             │  │
│  │  │  Extract   │───▶│  Validate  │───▶│  Insights  │             │  │
│  │  │   Agent    │    │    Node    │    │   Agent    │             │  │
│  │  └────────────┘    └────────────┘    └────────────┘             │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│            │                                                         │
│            ▼                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │              Database (TimescaleDB)                              │  │
│  │  ┌────────────┐    ┌────────────┐                                │  │
│  │  │   trades  │    │trading_days│                                │  │
│  │  │ (hypertable)   │ (aggregates)│                                │  │
│  │  └────────────┘    └────────────┘                                │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
           │                                              ▲
           │ WebSocket                                     │
           └──────────────────────────────────────────────┘
```

### Component Tree

```
frontend/src/
├── app/
│   ├── dashboard/
│   │   ├── layout.tsx          # Dashboard layout with providers
│   │   ├── page.tsx            # Main dashboard view
│   │   └── history/
│   │       └── page.tsx        # Historical sessions view
│   └── api/
│       └── v1/
│           ├── trades/
│           │   ├── route.ts    # Trade CRUD endpoints
│           │   └── extract/
│           │       └── route.ts # AI extraction endpoint
│           └── insights/
│               └── route.ts     # Insights generation
├── components/
│   ├── dashboard/
│   │   ├── TradeEntryInput.tsx # Natural language input
│   │   ├── PnlChart.tsx        # Cumulative P&L chart
│   │   ├── DisciplineChart.tsx # Discipline score chart
│   │   ├── AgencyChart.tsx     # Agency score chart
│   │   ├── InsightsPanel.tsx  # AI insights display
│   │   ├── SessionSummary.tsx  # Header stats bar
│   │   └── DashboardContainer.tsx
│   ├── history/
│   │   └── TradeHistoryList.tsx
│   └── ui/                     # Shadcn components
├── hooks/
│   ├── use-realtime-dashboard.ts
│   ├── use-warning-detection.ts
│   └── use-debounced-update.ts
├── lib/
│   ├── schemas/
│   │   └── trade.ts            # Zod validation schemas
│   ├── db.ts                   # Drizzle client
│   └── websocket.ts            # WebSocket client
└── db/
    └── schema/
        ├── auth.ts             # Better Auth tables
        └── trading.ts          # Trades & trading_days

backend/src/
├── main.py                     # FastAPI app entry
├── routers/
│   ├── trades.py               # Trade endpoints
│   ├── insights.py             # Insights endpoints
│   └── sessions.py             # Session endpoints
├── agents/
│   ├── extraction/
│   │   ├── graph.py            # LangGraph extraction
│   │   ├── prompts.py          # Extraction prompts
│   │   └── client.py           # LLM client
│   └── insights/
│       ├── prompts.py          # Insights prompts
│       └── service.py         # Insights logic
├── schemas/
│   ├── trade.py                # Pydantic models
│   └── insights.py            # Insights models
├── services/
│   ├── trading_day_service.py  # Aggregate updates
│   ├── validation_service.py  # Data validation
│   └── session_service.py     # Session management
├── websockets/
│   └── dashboard.py            # Real-time updates
└── db/
    └── connection.py           # Database connection
```

### Environment Variables

**Frontend (.env):**
```
DATABASE_URL=postgresql://user:pass@host:5432/db
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=http://localhost:3000
BACKEND_URL=http://localhost:8000
```

**Backend (.env):**
```
DATABASE_URL=postgresql://user:pass@host:5432/db
OPENAI_API_KEY=sk-...
FRONTEND_URL=http://localhost:3000
```

### Security Considerations

1. **Authentication:** Better Auth with session-based auth
2. **Input Validation:** Zod (frontend) + Pydantic (backend)
3. **SQL Injection:** Drizzle ORM with parameterized queries
4. **Rate Limiting:** 10 trades/minute per user on API
5. **Secrets:** Environment variables only, no hardcoded values
6. **CORS:** Configured for frontend origin only

---

*Technical specification enriched from Phase 5 requirements.*
*Tech stack: Next.js 16, TypeScript, Shadcn/ui, Tailwind CSS, Better Auth, Drizzle ORM, CopilotKit, FastAPI, LangGraph, LangChain, OpenAI, TimescaleDB, Docker Compose*
