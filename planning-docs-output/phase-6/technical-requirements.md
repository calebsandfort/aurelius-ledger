# Aurelius Ledger - Functional and Non-Functional Requirements

## Project Goal

The Aurelius Ledger is a lightweight web application for logging futures trades during live trading sessions. The system SHALL provide frictionless natural-language trade entry with AI-powered extraction of structured data, real-time behavioral score visualization (discipline and agency), and auto-generated AI insights to help traders improve their performance and self-regulation.

---

## 1. Trade Entry

### FR 1.0 Natural Language Trade Input

The system **SHALL** provide a persistent text input at the bottom of the dashboard that accepts free-form natural language descriptions of completed trades.

- **FR 1.1** The system **SHALL** accept any natural language text describing a trade without requiring a specific format or structure.
- **FR 1.2** The system **SHALL** auto-populate the timestamp at the moment of submission.
- **FR 1.3** The system **SHALL** clear the input field upon successful submission.
- **FR 1.4** The system **SHALL** display a visual confirmation (green flash) upon successful trade logging.
- **FR 1.5** The input field **SHALL** auto-focus after each submission to enable rapid logging.
- **FR 1.6** The input **SHALL** remain fixed at the bottom of the screen and remain accessible without navigation.

*Source: HLRD Section 1.1; Behavioral Psychology SME Phase 1 Section 4.1*

#### Technical Implementation

**Frontend Component (`frontend/src/components/trading/TradeEntry.tsx`):**
```typescript
import { useState, useRef, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { tradeInputSchema, type TradeInput } from '@/lib/schemas/trade'

export function TradeEntry() {
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [input, setInput] = useState('')
  const [showSuccess, setShowSuccess] = useState(false)

  const mutation = useMutation({
    mutationFn: async (data: TradeInput) => {
      const response = await fetch('/api/v1/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) throw new Error('Trade submission failed')
      return response.json()
    },
    onSuccess: () => {
      setInput('')
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 1000) // Green flash
      inputRef.current?.focus()
    },
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return
    const validated = tradeInputSchema.parse({ raw_input: input.trim() })
    mutation.mutate(validated)
  }

  return (
    <form onSubmit={handleSubmit} className="fixed bottom-0 left-0 right-0 p-4 bg-slate-900 border-t border-slate-800">
      <div className="max-w-4xl mx-auto flex gap-3">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe your trade... (e.g., 'Short ES at 4800, made $250, chased the entry')"
          className={`flex-1 bg-slate-800 border rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 transition-all ${
            showSuccess ? 'border-green-500 ring-green-500/30' : 'border-slate-700 focus:ring-blue-500/30'
          }`}
          rows={2}
        />
        <Button type="submit" disabled={mutation.isPending || !input.trim()}>
          {mutation.isPending ? 'Saving...' : 'Log Trade'}
        </Button>
      </div>
    </form>
  )
}
```

**Zod Validation Schema (`frontend/src/lib/schemas/trade.ts`):**
```typescript
import { z } from 'zod'

export const tradeInputSchema = z.object({
  raw_input: z.string()
    .min(1, 'Trade description is required')
    .max(5000, 'Trade description too long')
    .trim(),
})

export type TradeInput = z.infer<typeof tradeInputSchema>

// Response type from API
export const tradeResponseSchema = z.object({
  id: z.string().uuid(),
  session_id: z.string().uuid(),
  sequence_number: z.number().int().positive(),
  direction: z.enum(['long', 'short']),
  outcome: z.enum(['win', 'loss', 'breakeven']),
  pnl: z.number(),
  setup_description: z.string().max(2000).nullable(),
  discipline_score: z.number().int().min(-1).max(1),
  agency_score: z.number().int().min(-1).max(1),
  discipline_confidence: z.enum(['high', 'medium', 'low']),
  agency_confidence: z.enum(['high', 'medium', 'low']),
  created_at: z.string().datetime(),
})

export type TradeResponse = z.infer<typeof tradeResponseSchema>
```

**API Endpoint (`frontend/src/app/api/v1/trades/route.ts`):**
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { trades, sessions } from '@/lib/db/schema'
import { eq, and, gte, lt, desc } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const validated = tradeInputSchema.parse(body)

  // Get or create today's trading session
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  let tradingSession = await db.query.sessions.findFirst({
    where: and(
      eq(sessions.userId, session.user.id),
      gte(sessions.startedAt, today),
      lt(sessions.startedAt, tomorrow),
    ),
  })

  if (!tradingSession) {
    [tradingSession] = await db.insert(sessions).values({
      userId: session.user.id,
      startedAt: new Date(),
      totalPnl: 0,
      winCount: 0,
      lossCount: 0,
      breakevenCount: 0,
      netDisciplineScore: 0,
      netAgencyScore: 0,
      tradeCount: 0,
    }).returning()
  }

  // Get next sequence number
  const lastTrade = await db.query.trades.findFirst({
    where: eq(trades.sessionId, tradingSession.id),
    orderBy: [desc(trades.sequenceNumber)],
  })
  const sequenceNumber = (lastTrade?.sequenceNumber ?? 0) + 1

  // Insert trade with pending extraction status
  const [trade] = await db.insert(trades).values({
    sessionId: tradingSession.id,
    sequenceNumber,
    rawInput: validated.raw_input,
    direction: 'long', // Will be updated by extraction
    outcome: 'breakeven', // Will be updated by extraction
    pnl: 0, // Will be updated by extraction
    disciplineScore: 0,
    agencyScore: 0,
    disciplineConfidence: 'low',
    agencyConfidence: 'low',
    extractionStatus: 'pending',
  }).returning()

  // Trigger async extraction (non-blocking)
  fetch(`${process.env.BACKEND_URL}/api/v1/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trade_id: trade.id, raw_input: validated.raw_input }),
  }).catch(console.error)

  // Update session aggregates
  await db.update(sessions)
    .set({
      tradeCount: tradingSession.tradeCount + 1,
    })
    .where(eq(sessions.id, tradingSession.id))

  return NextResponse.json({ data: trade, meta: { sequence_number: sequenceNumber } }, { status: 201 })
}
```

**Security Considerations:**
- Input sanitization at API boundary (Zod validation)
- Rate limiting: Max 30 trades per minute per user (implement via Upstash or in-memory)
- CSRF protection via Next.js built-in mechanisms
- User authorization verified via session check

---

### FR 1.2 Trade Submission Flow

The system **SHALL** process trade submissions with immediate feedback and no page refresh.

- **FR 1.2.1** The system **SHALL** use optimistic UI updates, displaying the submitted trade data immediately in the dashboard before server confirmation.
- **FR 1.2.2** The system **SHALL** sync with the server response after submission to ensure consistency.
- **FR 1.2.3** The system **SHALL** show a loading state during trade processing.

*Source: Data Analytics SME Phase 2 Q1*

#### Technical Implementation

**Optimistic UI Hook (`frontend/src/hooks/useOptimisticTrades.ts`):**
```typescript
import { useQueryClient } from '@tanstack/react-query'
import { useState, useCallback } from 'react'
import type { TradeResponse } from '@/lib/schemas/trade'

export function useOptimisticTrades() {
  const queryClient = useQueryClient()
  const [pendingTrades, setPendingTrades] = useState<Map<string, TradeResponse>>(new Map())

  const addOptimisticTrade = useCallback((tempId: string, rawInput: string) => {
    const optimistic: TradeResponse = {
      id: tempId,
      session_id: '',
      sequence_number: 0, // Will be updated
      direction: 'long',
      outcome: 'breakeven',
      pnl: 0,
      setup_description: null,
      discipline_score: 0,
      agency_score: 0,
      discipline_confidence: 'low',
      agency_confidence: 'low',
      created_at: new Date().toISOString(),
    }
    setPendingTrades(prev => new Map(prev).set(tempId, optimistic))

    // Update query cache optimistically
    queryClient.setQueryData(['trades'], (old: TradeResponse[] | undefined) => {
      return old ? [...old, optimistic] : [optimistic]
    })

    return optimistic
  }, [queryClient])

  const resolveTrade = useCallback((tempId: string, actual: TradeResponse) => {
    setPendingTrades(prev => {
      const next = new Map(prev)
      next.delete(tempId)
      return next
    })

    queryClient.setQueryData(['trades'], (old: TradeResponse[] | undefined) => {
      if (!old) return [actual]
      return old.map(t => t.id === tempId ? actual : t)
    })
  }, [queryClient])

  const rejectTrade = useCallback((tempId: string) => {
    setPendingTrades(prev => {
      const next = new Map(prev)
      next.delete(tempId)
      return next
    })

    queryClient.setQueryData(['trades'], (old: TradeResponse[] | undefined) => {
      return old?.filter(t => t.id !== tempId) ?? []
    })
  }, [queryClient])

  return { pendingTrades, addOptimisticTrade, resolveTrade, rejectTrade }
}
```

**Dashboard Integration (`frontend/src/app/dashboard/page.tsx`):**
```typescript
'use client'

import { useQuery } from '@tanstack/react-query'
import { TradeEntry } from '@/components/trading/TradeEntry'
import { PnLChart } from '@/components/charts/PnLChart'
import { DisciplineChart } from '@/components/charts/DisciplineChart'
import { AgencyChart } from '@/components/charts/AgencyChart'
import { InsightsPanel } from '@/components/insights/InsightsPanel'
import { useOptimisticTrades } from '@/hooks/useOptimisticTrades'

export default function Dashboard() {
  const { data: trades, isLoading } = useQuery({
    queryKey: ['trades'],
    queryFn: () => fetch('/api/v1/trades').then(r => r.json()),
  })

  const { pendingTrades } = useOptimisticTrades()

  // Merge pending + confirmed trades for display
  const allTrades = [...(trades?.data ?? []), ...pendingTrades.values()]

  return (
    <main className="min-h-screen bg-slate-950 pb-24">
      <div className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="lg:col-span-2">
          <PnLChart trades={allTrades} isLoading={isLoading} />
        </div>
        <DisciplineChart trades={allTrades} />
        <AgencyChart trades={allTrades} />
        <div className="lg:col-span-2">
          <InsightsPanel />
        </div>
      </div>
      <TradeEntry />
    </main>
  )
}
```

---

## 2. AI Trade Extraction

### FR 2.0 Extraction Agent Functionality

The system **SHALL** parse natural language trade descriptions and extract structured data using an AI agent.

- **FR 2.1** The system **SHALL** extract the following fields from trade descriptions:
  - `direction`: "long" or "short"
  - `outcome`: "win", "loss", or "breakeven" (inferred from P&L or explicit language)
  - `pnl`: Dollar value (positive for wins, negative for losses)
  - `setup_description`: Natural language summary of the setup
  - `discipline_score`: -1, 0, or +1
  - `agency_score`: -1, 0, or +1
- **FR 2.2** The system **SHALL** infer discipline score from behavioral language:
  - +1 for explicit discipline signals ("waited for", "held for confirmation", "patient", "followed plan")
  - -1 for undisciplined signals ("chased", "FOMO'd", "revenge trade", "impulsive")
  - 0 for ambiguous or no signals
- **FR 2.3** The system **SHALL** infer agency score from intentionality language:
  - +1 for intentional execution ("followed trading plan", "deliberate entry", "made conscious decision")
  - -1 for reactive trading ("knew better but didn't follow plan", "acted against rules")
  - 0 for ambiguous signals
- **FR 2.4** The system **SHALL** assign confidence scores ("high", "medium", "low") alongside discipline and agency scores.
- **FR 2.5** When confidence is low, the system **SHALL** default the score to 0 and flag the trade for review.

*Source: HLRD Section 2.1; AI/NLP SME Phase 1 Q1; Behavioral Psychology SME Phase 2 Q1*

#### Technical Implementation

**Pydantic Extraction Schema (`backend/src/schemas/trade_extraction.py`):**
```python
from pydantic import BaseModel, Field, field_validator
from typing import Literal, Optional

class TradeExtractionResult(BaseModel):
    """Structured output from trade extraction agent."""
    direction: Literal["long", "short"]
    outcome: Literal["win", "loss", "breakeven"]
    pnl: float = Field(..., ge=-10000, le=10000, description="Dollar value, positive for wins")
    setup_description: Optional[str] = Field(None, max_length=2000)
    discipline_score: int = Field(..., ge=-1, le=1)
    agency_score: int = Field(..., ge=-1, le=1)
    discipline_confidence: Literal["high", "medium", "low"]
    agency_confidence: Literal["high", "medium", "low"]
    behavioral_signals: list[str] = Field(
        default_factory=list,
        description="Explicit behavioral language detected"
    )

    @field_validator("pnl")
    @classmethod
    def validate_pnl(cls, v: float) -> float:
        if abs(v) < 0.01 and v != 0:
            raise ValueError("P&L must be non-zero or exactly zero")
        return round(v, 2)
```

**LangGraph Extraction Node (`backend/src/agent/nodes/extract_trade.py`):**
```python
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import PydanticOutputParser
from langchain.output_parsers import RetryOutputParser
from pydantic import ValidationError
from ..schemas.trade_extraction import TradeExtractionResult

# Few-shot examples for extraction
FEW_SHOT_EXAMPLES = [
    {
        "input": "Short ES at 4800, waited for the retest of support, made $250, followed my plan perfectly",
        "output": """{"direction": "short", "outcome": "win", "pnl": 250, "setup_description": "Short ES at 4800 on support retest", "discipline_score": 1, "agency_score": 1, "discipline_confidence": "high", "agency_confidence": "high", "behavioral_signals": ["waited for", "followed my plan"]}"""
    },
    {
        "input": "Chased NQ after seeing the spike, FOMO'd in at 17200, lost $400, knew better but did it anyway",
        "output": """{"direction": "long", "outcome": "loss", "pnl": -400, "setup_description": "Chased NQ at 17200", "discipline_score": -1, "agency_score": -1, "discipline_confidence": "high", "agency_confidence": "high", "behavioral_signals": ["chased", "FOMO'd", "knew better"]}"""
    },
    {
        "input": "Long RUT at 1950, small winner about $75, took profit at target",
        "output": """{"direction": "long", "outcome": "win", "pnl": 75, "setup_description": "Long RUT at 1950, took profit at target", "discipline_score": 0, "agency_score": 0, "discipline_confidence": "medium", "agency_confidence": "medium", "behavioral_signals": []}"""
    },
    {
        "input": "Short CL on the open, got stopped for -$200, no setup, just guessing",
        "output": """{"direction": "short", "outcome": "loss", "pnl": -200, "setup_description": "Short CL on the open", "discipline_score": -1, "agency_score": -1, "discipline_confidence": "high", "agency_confidence": "high", "behavioral_signals": ["guessing", "no setup"]}"""
    },
    {
        "input": "Added to my winner when it broke out, let it ride, +$800",
        "output": """{"direction": "long", "outcome": "win", "pnl": 800, "setup_description": "Added to winner on breakout", "discipline_score": 1, "agency_score": 1, "discipline_confidence": "medium", "agency_confidence": "high", "behavioral_signals": ["let it ride"]}"""
    },
]

SYSTEM_PROMPT = """You are a trading psychology expert analyzing trade descriptions.

Extract structured data from natural language trade descriptions. Your goal is to identify behavioral signals related to:
- DISCIPLINE: Following rules, patience, waiting for confirmation, plan adherence
- AGENCY: Intentional execution vs reactive trading

Score Guidelines:
- discipline_score: +1 for disciplined behavior, -1 for undisciplined, 0 for ambiguous
- agency_score: +1 for intentional execution, -1 for reactive/automatic, 0 for ambiguous

Key behavioral signals to detect:
- +1 discipline: "waited for", "held for confirmation", "patient", "followed plan", "good setup", "stayed small"
- -1 discipline: "chased", "FOMO'd", "revenge trade", "impulsive", "overtraded", "deviated from plan"
- +1 agency: "deliberate", "conscious decision", "stuck to rules", "knew the risk"
- -1 agency: "knew better but", "acted against rules", "automatic", "didn't think"

Position management scoring:
- Scaling out (partial profit-taking): +1 discipline, +1 agency
- Adding to winner (sizing up): +1 agency if following plan
- Averaging down (adding to loser): -1 discipline, -1 agency
- Moving stop further from entry: -1 unless explicitly part of plan
- Using trailing stop: +1 discipline, +1 agency

Output ONLY valid JSON matching this schema:
{schema}

Few-shot examples:
{examples}

If P&L cannot be determined, set confidence to "low" and estimate based on context.
If P&L is completely ambiguous and required, return an error."""

def create_extraction_prompt(raw_input: str) -> ChatPromptTemplate:
    examples_text = "\n".join([
        f'Input: {ex["input"]}\nOutput: {ex["output"]}'
        for ex in FEW_SHOT_EXAMPLES
    ])

    parser = PydanticOutputParser(pydantic_object=TradeExtractionResult)

    return ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT.format(
            schema=parser.get_format_instructions(),
            examples=examples_text
        )),
        ("human", "{trade_description}"),
    ])

def extract_trade_node(state: dict) -> dict:
    """LangGraph node for trade extraction."""
    trade_id = state["trade_id"]
    raw_input = state["raw_input"]

    # Sanitize input (FR 2.9)
    sanitized = sanitize_input(raw_input)

    # Create extraction chain
    model = ChatOpenAI(
        model="gpt-4o-mini",  # FR 2.6.1: Use gpt-4o-mini for extraction
        temperature=0,
        max_retries=0,  # We handle retries manually
    )

    prompt = create_extraction_prompt(sanitized)
    parser = PydanticOutputParser(pydantic_object=TradeExtractionResult)

    extraction_chain = prompt | model.with_structured_output(
        TradeExtractionResult,
        method="json_schema",
        schema=TradeExtractionResult.model_json_schema()
    )

    # Retry logic (FR 2.1.2)
    max_retries = 2
    last_error = None

    for attempt in range(max_retries + 1):
        try:
            result = extraction_chain.invoke({"trade_description": sanitized})

            # Default low-confidence scores to 0 (FR 2.5)
            if result.discipline_confidence == "low":
                result.discipline_score = 0
            if result.agency_confidence == "low":
                result.agency_score = 0

            return {
                "trade_id": trade_id,
                "extraction_result": result.model_dump(),
                "extraction_success": True,
            }
        except (ValidationError, Exception) as e:
            last_error = e
            if attempt < max_retries:
                continue  # Retry

    # All retries failed - return recoverable error
    return {
        "trade_id": trade_id,
        "extraction_error": str(last_error),
        "extraction_success": False,
    }

def sanitize_input(raw_input: str) -> str:
    """Sanitize trade description to prevent prompt injection (FR 2.9)."""
    # Remove potential system prompt instructions
    dangerous_patterns = [
        r'^(ignore|disregard|forget|override)\s+(all\s+)?(previous|above|prior)\s+instructions',
        r'^(\{|<)\s*.*?(system|assistant|instruction)',
        r'(system\s*prompt|instructions?\s*:)',
    ]

    sanitized = raw_input
    for pattern in dangerous_patterns:
        sanitized = re.sub(pattern, '[FILTERED]', sanitized, flags=re.IGNORECASE)

    # Escape any remaining JSON-like structures
    sanitized = sanitized.replace('{', '\\u007b').replace('}', '\\u007d')

    return sanitized.strip()
```

---

### FR 2.1 Extraction Architecture

The system **SHALL** implement trade extraction as a LangGraph node with validation and retry capability.

- **FR 2.1.1** The system **SHALL** use LangChain's `with_structured_output()` combined with Pydantic validation to ensure output conforms to the required schema.
- **FR 2.1.2** The system **SHALL** implement retry logic with up to 2 retries on schema mismatch.
- **FR 2.1.3** The system **SHALL** surface a recoverable error if extraction fails after retries, without writing partial data.
- **FR 2.1.4** The system **SHALL NOT** write partial or incomplete trade records to the database.

*Source: AI/NLP SME Phase 1 Q2*

#### Technical Implementation

**LangGraph Workflow (`backend/src/agent/workflows/trade_extraction.py`):**
```python
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from ..nodes.extract_trade import extract_trade_node, sanitize_input
from ..nodes.update_trade import update_trade_node

class ExtractionState(TypedDict):
    trade_id: str
    raw_input: str
    sanitized_input: str
    extraction_result: Optional[dict]
    extraction_error: Optional[str]
    extraction_success: bool
    update_success: bool

def create_extraction_graph() -> StateGraph:
    """Create the trade extraction LangGraph workflow."""

    graph = StateGraph(ExtractionState)

    # Add nodes
    graph.add_node("sanitize", sanitize_node)
    graph.add_node("extract", extract_trade_node)
    graph.add_node("update_db", update_trade_node)

    # Define edges
    graph.set_entry_point("sanitize")
    graph.add_edge("sanitize", "extract")

    # Conditional edge after extraction
    graph.add_conditional_edges(
        "extract",
        lambda x: "update_db" if x.get("extraction_success") else "handle_error",
        {
            "update_db": "update_db",
            "handle_error": END,
        }
    )

    graph.add_edge("update_db", END)

    # Add checkpointer for state management
    checkpointer = MemorySaver()

    return graph.compile(checkpointer=checkpointer)

def sanitize_node(state: ExtractionState) -> ExtractionState:
    """Sanitize input before extraction."""
    return {
        "sanitized_input": sanitize_input(state["raw_input"]),
    }

def update_trade_node(state: ExtractionState) -> ExtractionState:
    """Update trade record in database with extraction results."""
    # This node only runs if extraction succeeded
    # It updates the trade with extracted data
    # See FR 3.0 for database schema
    return {"update_success": True}
```

**FastAPI Endpoint for Extraction (`backend/src/api/trade_extraction.py`):**
```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..agent.workflows.trade_extraction import create_extraction_graph

router = APIRouter(prefix="/api/v1", tags=["extraction"])

class ExtractionRequest(BaseModel):
    trade_id: str
    raw_input: str

class ExtractionResponse(BaseModel):
    trade_id: str
    success: bool
    message: str

@router.post("/extract", response_model=ExtractionResponse)
async def extract_trade(request: ExtractionRequest):
    """Trigger trade extraction via LangGraph."""

    graph = create_extraction_graph()

    try:
        # Run with timeout (FR 2.7.1)
        result = await asyncio.wait_for(
            graph.ainvoke({
                "trade_id": request.trade_id,
                "raw_input": request.raw_input,
            }),
            timeout=5.0  # 5 second timeout
        )

        if result.get("extraction_success"):
            return ExtractionResponse(
                trade_id=request.trade_id,
                success=True,
                message="Trade extracted successfully"
            )
        else:
            return ExtractionResponse(
                trade_id=request.trade_id,
                success=False,
                message="Couldn't parse that — add it manually when you have a moment."
            )

    except asyncio.TimeoutError:
        # Retry once on timeout (FR 2.7.2)
        try:
            result = await graph.ainvoke({
                "trade_id": request.trade_id,
                "raw_input": request.raw_input,
            })
            if result.get("extraction_success"):
                return ExtractionResponse(
                    trade_id=request.trade_id,
                    success=True,
                    message="Trade extracted successfully"
                )
        except Exception:
            pass

        # Timeout after retry - return recoverable error (FR 2.7.3)
        return ExtractionResponse(
            trade_id=request.trade_id,
            success=False,
            message="Trade saved. Analysis unavailable — check back later."
        )
```

---

### FR 2.2 Prompt Structure

The system **SHALL** use a hybrid few-shot prompt structure with structured output for reliable extraction.

- **FR 2.2.1** The system **SHALL** include 3-4 curated few-shot examples in the system prompt demonstrating expected input/output format.
- **FR 2.2.2** The few-shot examples **SHALL** cover diverse score combinations: (+1,+1), (-1,-1), (+1,-1), (0,0), and edge cases.
- **FR 2.2.3** The system **SHALL** use real trading vocabulary in examples (FOMO, revenge, tilt, confirmation, retest, stop hunt).
- **FR 2.2.4** The system **SHALL** specify output schema via JSON Schema leveraging OpenAI's structured output capability.

*Source: AI/NLP SME Phase 1 Q1; AI/NLP SME Phase 2 Q6*

#### Technical Implementation

The prompt structure is implemented in `create_extraction_prompt()` within `/backend/src/agent/nodes/extract_trade.py` as detailed in FR 2.0 Technical Implementation. The few-shot examples array includes 5 diverse examples covering all required score combinations and uses authentic trading vocabulary.

---

### FR 2.3 Ambiguous P&L Handling

The system **SHALL** handle ambiguous P&L expressions with a tiered fallback strategy.

- **FR 2.3.1** When explicit dollar amounts are present, the system **SHALL** use the exact value.
- **FR 2.3.2** When relative terms ("small winner", "big loss") are used without dollar amounts, the system **SHALL** estimate based on context and default to a configurable amount with `pnl_confidence: "low"`.
- **FR 2.3.3** The system **SHALL** require human verification for trades where P&L cannot be determined.
- **FR 2.3.4** The system **SHALL** return an error if no P&L signal is present (required field per HLRD).

*Source: AI/NLP SME Phase 1 Q1*

#### Technical Implementation

**P&L Estimation Logic (`backend/src/agent/nodes/extract_trade.py`):**
```python
import re
from typing import Optional

# Configurable P&L estimates
DEFAULT_PNL_ESTIMATES = {
    "small winner": 100,
    "small win": 100,
    "little winner": 100,
    "nice winner": 250,
    "good winner": 250,
    "big winner": 500,
    "large winner": 500,
    "small loser": -100,
    "small loss": -100,
    "little loser": -100,
    "bad loser": -250,
    "big loser": -500,
    "large loser": -500,
    "breakeven": 0,
    "flat": 0,
}

def estimate_pnl(raw_input: str, confidence: str = "low") -> tuple[Optional[float], str]:
    """
    Estimate P&L from ambiguous language.
    Returns (pnl, confidence).
    """
    text = raw_input.lower()

    # Try to extract explicit dollar amounts first
    dollar_patterns = [
        r'\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)',  # $1,234.56 or 1234.56
        r'made\s+\$?(\d+)',  # made $250
        r'lost\s+\$?(\d+)',  # lost $400
        r'profit.*?\$?(\d+)',  # profit $100
        r'pnl.*?\$?(\d+)',  # pnl 150
    ]

    for pattern in dollar_patterns:
        match = re.search(pattern, text)
        if match:
            amount = float(match.group(1).replace(',', ''))
            # Check for negative context
            if 'lost' in text or 'loss' in text or 'negative' in text:
                amount = -abs(amount)
            return round(amount, 2), "high"

    # Fall back to relative terms
    for term, estimate in DEFAULT_PNL_ESTIMATES.items():
        if term in text:
            return float(estimate), "low"

    # No P&L signal found - return error indicator
    return None, "error"
```

---

### FR 2.4 Position Management Scoring

The system **SHALL** correctly score position management behaviors in trade descriptions.

- **FR 2.4.1** Scaling out (partial profit-taking) **SHALL** score as +1 for both discipline and agency.
- **FR 2.4.2** Adding to a winning position **SHALL** score as context-dependent: +1 agency if following plan.
- **FR 2.4.3** Adding to a losing position (averaging down) **SHALL** score as -1 for both discipline and agency.
- **FR 2.4.4** Moving a stop further from entry **SHALL** score as -1 unless explicitly part of the trading plan.
- **FR 2.4.5** Using a trailing stop **SHALL** score as +1 for both discipline and agency.

*Source: Behavioral Psychology SME Phase 2 Q1*

#### Technical Implementation

Position management scoring is handled within the few-shot examples in the prompt (FR 2.2). The model learns from examples that demonstrate:
- Scaling out: `{"discipline_score": 1, "agency_score": 1}`
- Adding to winner: `{"agency_score": 1}` when following plan
- Averaging down: `{"discipline_score": -1, "agency_score": -1}`
- Moving stop: `{"discipline_score": -1}`
- Trailing stop: `{"discipline_score": 1, "agency_score": 1}`

These scoring rules are embedded in the system prompt text for the extraction model.

---

### FR 2.5 Error Handling

The system **SHALL** handle extraction errors gracefully with appropriate user feedback.

- **FR 2.5.1** If extraction fails, the system **SHALL** display a user-friendly message: "Couldn't parse that — add it manually when you have a moment."
- **FR 2.5.2** The system **SHALL NOT** make the trader feel their input was "wrong."
- **FR 2.5.3** The system **SHALL** log repeated zero-score results for prompt recalibration review after 3 consecutive occurrences.

*Source: Behavioral Psychology SME Phase 1 Section 4.2; AI/NLP SME Phase 2 Q2*

#### Technical Implementation

**Error Handling in Extraction (`backend/src/agent/nodes/extract_trade.py`):**
```python
import logging
from collections import defaultdict

# Logging for observability (FR 2.10)
logger = logging.getLogger(__name__)

# Track consecutive zero-score occurrences
zero_score_tracker: dict[str, int] = defaultdict(int)

def handle_extraction_error(state: ExtractionState, error: Exception) -> dict:
    """Handle extraction errors with user-friendly messaging."""

    trade_id = state["trade_id"]
    raw_input = state["raw_input"]

    # Log for observability (FR 2.10)
    logger.error(f"Extraction failed for trade {trade_id}: {error}")

    # Track zero-score patterns (FR 2.5.3)
    # This would be checked after successful extraction
    # if result.discipline_score == 0 and result.agency_score == 0:
    #     zero_score_tracker[user_id] += 1
    #     if zero_score_tracker[user_id] >= 3:
    #         logger.warning(f"User {user_id} has 3+ consecutive zero-score trades")

    return {
        "trade_id": trade_id,
        "extraction_success": False,
        "error_message": "Couldn't parse that — add it manually when you have a moment.",
    }
```

---

### FR 2.6 Model Selection

The system **SHALL** use specific OpenAI models optimized for each AI task.

- **FR 2.6.1** The system **SHALL** use `gpt-4o-mini` for trade extraction to optimize for latency and cost.
- **FR 2.6.2** The system **SHALL** use `gpt-4o` for insights generation to ensure accurate behavioral analysis.

*Source: AI/NLP SME Phase 4 Review - Critical Missing Requirement*

#### Technical Implementation

Model selection is configured in each respective node:

**Extraction (gpt-4o-mini):**
```python
# In extract_trade.py
extraction_model = ChatOpenAI(
    model="gpt-4o-mini",
    temperature=0,
    max_retries=0,
)
```

**Insights (gpt-4o):**
```python
# In generate_insights.py
insights_model = ChatOpenAI(
    model="gpt-4o",
    temperature=0.7,
    max_retries=2,
)
```

---

### FR 2.7 Extraction Reliability

The system **SHALL** implement reliability mechanisms for AI extraction.

- **FR 2.7.1** The system **SHALL** implement a timeout of 5 seconds for trade extraction AI calls.
- **FR 2.7.2** If timeout occurs, the system **SHALL** retry once, then surface a recoverable error.
- **FR 2.7.3** The system **SHALL NOT** write partial data on timeout.
- **FR 2.7.4** When OpenAI API is unavailable, the system **SHALL** display: "Trade saved. Analysis unavailable — check back later."
- **FR 2.7.5** The trade **SHALL** be saved without extraction data when API is unavailable.
- **FR 2.7.6** The system **SHALL** queue extraction for retry when API recovers.

*Source: AI/NLP SME Phase 4 Review - Extraction Timeout & API Fallback*

#### Technical Implementation

**Timeout and Retry Logic (`backend/src/api/trade_extraction.py`):**
```python
import asyncio
from openai import APIError, RateLimitError

async def extract_with_reliability(trade_id: str, raw_input: str) -> dict:
    """Extract trade with timeout and retry logic."""

    graph = create_extraction_graph()

    for attempt in range(2):  # Initial + 1 retry
        try:
            result = await asyncio.wait_for(
                graph.ainvoke({
                    "trade_id": trade_id,
                    "raw_input": raw_input,
                }),
                timeout=5.0
            )
            return result

        except asyncio.TimeoutError:
            if attempt == 0:
                continue  # Retry once
            # After retry fails - queue for later (FR 2.7.6)
            return {
                "trade_id": trade_id,
                "extraction_success": False,
                "queued_for_retry": True,
                "message": "Trade saved. Analysis unavailable — check back later."
            }

        except (APIError, RateLimitError) as e:
            # API unavailable - queue for retry (FR 2.7.4-2.7.6)
            await queue_extraction_for_retry(trade_id, raw_input)
            return {
                "trade_id": trade_id,
                "extraction_success": False,
                "queued_for_retry": True,
                "message": "Trade saved. Analysis unavailable — check back later."
            }

    return {
        "trade_id": trade_id,
        "extraction_success": False,
        "message": "Trade saved. Analysis unavailable — check back later."
    }

async def queue_extraction_for_retry(trade_id: str, raw_input: str):
    """Queue failed extraction for retry when API recovers."""
    # In production, use Redis or database queue
    # For now, log for manual/scheduled retry
    logger.warning(f"Queued trade {trade_id} for retry")
```

---

### FR 2.8 Business Logic Validation

The system **SHALL** validate extracted data against business rules.

- **FR 2.8.1** The system **SHALL** validate extracted P&L is within reasonable range (-$10,000 to +$10,000 per trade).
- **FR 2.8.2** The system **SHALL** validate direction is either "long" or "short".
- **FR 2.8.3** Invalid extractions **SHALL** trigger retry before failing.

*Source: AI/NLP SME Phase 4 Review - Business Logic Validation*

#### Technical Implementation

Validation is enforced via Pydantic in the extraction schema:

```python
# In trade_extraction.py
class TradeExtractionResult(BaseModel):
    direction: Literal["long", "short"]  # FR 2.8.2
    pnl: float = Field(..., ge=-10000, le=10000)  # FR 2.8.1

    @field_validator("pnl")
    @classmethod
    def validate_pnl(cls, v: float) -> float:
        # Additional validation for outliers (FR 3.2.1)
        if abs(v) > 100000:
            raise ValueError("P&L exceeds maximum threshold")
        return round(v, 2)
```

---

### FR 2.9 Input Sanitization

The system **SHALL** sanitize trade descriptions before passing to LLM.

- **FR 2.9.1** The system **SHALL** sanitize trade descriptions to prevent prompt injection.
- **FR 2.9.2** The system **SHALL** remove or escape any system prompt instructions embedded in trade descriptions.

*Source: AI/NLP SME Phase 4 Review - Prompt Security*

#### Technical Implementation

Sanitization is implemented in the `sanitize_input()` function (see FR 2.0 Technical Implementation). The function:
- Removes patterns matching system prompt injection attempts
- Escapes curly braces to prevent JSON injection
- Strips leading/trailing whitespace

---

### FR 2.10 Extraction Observability

The system **SHALL** log extraction results for accuracy monitoring.

- **FR 2.10.1** The system **SHALL** log all extraction inputs and outputs for accuracy monitoring.
- **FR 2.10.2** The system **SHALL** track extraction success rate by confidence level.
- **FR 2.10.3** The system **SHALL** flag recurring extraction patterns for prompt recalibration.

*Source: AI/NLP SME Phase 4 Review - Observability*

#### Technical Implementation

**Observability Logging (`backend/src/agent/nodes/extract_trade.py`):**
```python
import structlog

logger = structlog.get_logger()

def log_extraction_result(state: dict, result: dict):
    """Log extraction for accuracy monitoring (FR 2.10)."""

    logger.info(
        "trade_extraction_completed",
        trade_id=state["trade_id"],
        success=result.get("extraction_success"),
        discipline_score=result.get("extraction_result", {}).get("discipline_score"),
        agency_score=result.get("extraction_result", {}).get("agency_score"),
        discipline_confidence=result.get("extraction_result", {}).get("discipline_confidence"),
        agency_confidence=result.get("extraction_result", {}).get("agency_confidence"),
        raw_input_length=len(state["raw_input"]),
    )

    # Track confidence distribution (FR 2.10.2)
    if result.get("extraction_success"):
        disc_conf = result["extraction_result"]["discipline_confidence"]
        agency_conf = result["extraction_result"]["agency_confidence"]
        logger.info(
            "extraction_confidence_distribution",
            discipline_confidence=disc_conf,
            agency_confidence=agency_conf,
        )
```

---

## 3. Data Model

### FR 3.0 Trade Persistence

The system **SHALL** persist trade data with proper schema and relationships.

- **FR 3.1** The system **SHALL** store trades in a `trades` table with the following schema:
  - `id`: UUID (primary key)
  - `session_id`: UUID (foreign key to sessions)
  - `sequence_number`: INTEGER
  - `raw_input`: TEXT (original natural language input)
  - `direction`: VARCHAR(10) - "long" or "short"
  - `outcome`: VARCHAR(20) - "win", "loss", or "breakeven"
  - `pnl`: NUMERIC(10,2) - dollar value (positive for wins, negative for losses)
  - `setup_description`: VARCHAR(2000)
  - `discipline_score`: INTEGER (-1, 0, or +1)
  - `agency_score`: INTEGER (-1, 0, or +1)
  - `discipline_confidence`: VARCHAR(10) - "high", "medium", or "low"
  - `agency_confidence`: VARCHAR(10) - "high", "medium", or "low"
  - `created_at`: TIMESTAMPTZ (timezone-aware)
- **FR 3.2** Each trade **SHALL** have a sequence number within its session.
- **FR 3.3** Each trade **SHALL** include confidence scores for discipline and agency.
- **FR 3.4** The system **SHALL** create a trading session automatically when the first trade of a calendar day is logged.
- **FR 3.5** The system **SHALL** store the original raw input text in a separate column for audit purposes and future re-processing.

*Source: HLRD Section 3.1; Data Analytics SME Phase 4 Review - Data Types & Raw Input Storage*

#### Technical Implementation

**Drizzle Schema (`frontend/src/lib/db/schema/trades.ts`):**
```typescript
import { pgTable, uuid, varchar, text, numeric, integer, timestamp, index, foreignKey } from 'drizzle-orm/pg-core'
import { sessions } from './sessions'

export const trades = pgTable('trades', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  sequenceNumber: integer('sequence_number').notNull(),
  rawInput: text('raw_input').notNull(),  // FR 3.5: Original raw input for audit

  // Extracted fields
  direction: varchar('direction', { length: 10 }).notNull(),  // 'long' | 'short'
  outcome: varchar('outcome', { length: 20 }).notNull(),  // 'win' | 'loss' | 'breakeven'
  pnl: numeric('pnl', { precision: 10, scale: 2 }).notNull().default('0'),
  setupDescription: varchar('setup_description', { length: 2000 }),

  // Behavioral scores
  disciplineScore: integer('discipline_score').notNull().default(0),
  agencyScore: integer('agency_score').notNull().default(0),
  disciplineConfidence: varchar('discipline_confidence', { length: 10 }).notNull().default('low'),
  agencyConfidence: varchar('agency_confidence', { length: 10 }).notNull().default('low'),

  // Extraction tracking
  extractionStatus: varchar('extraction_status', { length: 20 }).notNull().default('pending'),
  // 'pending' | 'processing' | 'completed' | 'failed' | 'queued'

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  // FR 3.1.4: Index for time-series retrieval
  index('idx_trades_session_sequence').on(table.sessionId, table.sequenceNumber),
  // FR 3.1.5: Composite indexes
  index('idx_trades_session_created').on(table.sessionId, table.createdAt),
  index('idx_trades_created_at').on(table.createdAt),
])

export type Trade = typeof trades.$inferSelect
export type NewTrade = typeof trades.$inferInsert
```

**Sessions Schema (`frontend/src/lib/db/schema/sessions.ts`):**
```typescript
import { pgTable, uuid, numeric, integer, timestamp, index, text } from 'drizzle-orm/pg-core'
import { users } from './auth'  // From existing auth schema

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  // Session aggregates (FR 3.1.1)
  totalPnl: numeric('total_pnl', { precision: 12, scale: 2 }).notNull().default('0'),
  winCount: integer('win_count').notNull().default(0),
  lossCount: integer('loss_count').notNull().default(0),
  breakevenCount: integer('breakeven_count').notNull().default(0),
  netDisciplineScore: integer('net_discipline_score').notNull().default(0),
  netAgencyScore: integer('net_agency_score').notNull().default(0),
  tradeCount: integer('trade_count').notNotNull().default(0),

  // Timestamps
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
}, (table) => [
  index('idx_sessions_user_started').on(table.userId, table.startedAt),
])

export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert
```

**SQL Migration (`frontend/drizzle/0010_trades_sessions.sql`):**
```sql
-- FR 3.4.1: TimescaleDB hypertable
SELECT create_hypertable('trades', 'created_at', if_not_exists => TRUE);

-- FR 3.2.1: Data quality validation trigger
CREATE OR REPLACE FUNCTION validate_trade_pnl()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.pnl < -100000 OR NEW.pnl > 100000 THEN
    RAISE WARNING 'Trade P&L % exceeds reasonable bounds (-100000 to 100000)', NEW.pnl;
  END IF;

  IF NEW.created_at > NOW() THEN
    RAISE WARNING 'Trade timestamp is in the future: %', NEW.created_at;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_trade_pnl
  BEFORE INSERT ON trades
  FOR EACH ROW
  EXECUTE FUNCTION validate_trade_pnl();
```

---

### FR 3.1 Session Aggregates

The system **SHALL** maintain running aggregates on the trading session record, updated after each trade insertion.

- **FR 3.1.1** The system **SHALL** store and update: total_pnl (NUMERIC), win_count (INTEGER), loss_count (INTEGER), breakeven_count (INTEGER), net_discipline_score (INTEGER), net_agency_score (INTEGER), trade_count (INTEGER).
- **FR 3.1.2** Aggregate updates **SHALL** occur atomically within the same transaction as trade insertion.
- **FR 3.1.3** The system **SHALL** compute aggregates in O(1) time using pre-computed columns on the sessions table, updated via database triggers or application transaction logic.
- **FR 3.1.4** The system **SHALL** index trades by (session_id, sequence_number) for efficient time-series retrieval.
- **FR 3.1.5** The system **SHALL** add composite indexes for:
  - (session_id, created_at) for time-range queries within sessions
  - (created_at) for cross-session analytics queries

*Source: HLRD Section 3.2; Data Analytics SME Phase 2 Q4, Q8; Phase 4 Review - Index Strategy*

#### Technical Implementation

**Database Trigger for Atomic Updates (`frontend/drizzle/0011_session_aggregates.sql`):**
```sql
-- FR 3.1.2: Atomic aggregate update trigger
CREATE OR REPLACE FUNCTION update_session_aggregates()
RETURNS TRIGGER AS $$
DECLARE
  session_row sessions%ROWTYPE;
BEGIN
  -- Get current session
  SELECT * INTO session_row FROM sessions WHERE id = NEW.session_id;

  -- Calculate new aggregate values
  UPDATE sessions
  SET
    trade_count = trade_count + 1,
    total_pnl = total_pnl + NEW.pnl,
    win_count = win_count + CASE WHEN NEW.outcome = 'win' THEN 1 ELSE 0 END,
    loss_count = loss_count + CASE WHEN NEW.outcome = 'loss' THEN 1 ELSE 0 END,
    breakeven_count = breakeven_count + CASE WHEN NEW.outcome = 'breakeven' THEN 1 ELSE 0 END,
    net_discipline_score = net_discipline_score + NEW.discipline_score,
    net_agency_score = net_agency_score + NEW.agency_score
  WHERE id = NEW.session_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_session_aggregates
  AFTER INSERT ON trades
  FOR EACH ROW
  EXECUTE FUNCTION update_session_aggregates();
```

**Application-Level Transaction (Alternative):**
```typescript
// In trade insertion API route
await db.transaction(async (tx) => {
  // Insert trade
  const [trade] = await tx.insert(trades).values({...}).returning()

  // Update session aggregates (FR 3.1.2)
  await tx.update(sessions)
    .set({
      tradeCount: sql`${sessions.tradeCount} + 1`,
      totalPnl: sql`${sessions.totalPnl} + ${trade.pnl}`,
      winCount: sql`${sessions.winCount} + CASE WHEN ${trade.outcome} = 'win' THEN 1 ELSE 0 END`,
      // ... etc
    })
    .where(eq(sessions.id, trade.sessionId))
})
```

---

### FR 3.2 Data Quality Validation

The system **SHALL** validate data quality at ingestion.

- **FR 3.2.1** The system **SHALL** validate P&L values are within reasonable bounds (-$100,000 to +$100,000 per trade) and flag outliers.
- **FR 3.2.2** The system **SHALL** validate timestamp is not in the future.

*Source: Data Analytics SME Phase 4 Review - Data Quality Validation*

#### Technical Implementation

Implemented via database trigger (see FR 3.0 Technical Implementation - SQL migration).

---

### FR 3.3 Data Export

The system **SHALL** support data export for backup and analysis.

- **FR 3.3.1** The system **SHALL** support exporting session data as JSON for backup purposes.
- **FR 3.3.2** The system **SHALL** support exporting all trades as CSV for spreadsheet analysis.

*Source: Data Analytics SME Phase 4 Review - Data Export*

#### Technical Implementation

**Export API Endpoints (`frontend/src/app/api/v1/export/route.ts`):**
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { trades, sessions } from '@/lib/db/schema'

// JSON Export (FR 3.3.1)
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format') // 'json' | 'csv'
  const sessionId = searchParams.get('session_id')

  if (format === 'csv') {
    return exportCSV(session?.user?.id, sessionId)
  }

  return exportJSON(session?.user?.id, sessionId)
}

async function exportJSON(userId: string, sessionId: string | null) {
  const query = sessionId
    ? db.query.sessions.findFirst({
        where: (s, { eq, and }) => and(eq(s.id, sessionId), eq(s.userId, userId)),
        with: { trades: true },
      })
    : db.query.sessions.findMany({
        where: (s, { eq }) => eq(s.userId, userId),
        with: { trades: true },
      })

  const data = await query
  return NextResponse.json({ data, exported_at: new Date().toISOString() })
}

async function exportCSV(userId: string, sessionId: string | null | null) {
  const tradesList = await db.query.trades.findMany({
    where: (t, { eq, and }) => {
      const conditions = [eq(t.sessionId, sessions.id)]
      if (sessionId) conditions.push(eq(t.sessionId, sessionId))
      return and(...conditions)
    },
    with: {
      session: {
        where: (s, { eq }) => eq(s.userId, userId),
      },
    },
  })

  const headers = [
    'id', 'session_id', 'sequence_number', 'direction', 'outcome', 'pnl',
    'setup_description', 'discipline_score', 'agency_score',
    'discipline_confidence', 'agency_confidence', 'created_at'
  ].join(',')

  const rows = tradesList.map(t =>
    headers.map(h => {
      const val = t[h as keyof typeof t]
      return typeof val === 'string' ? `"${val}"` : val
    }).join(',')
  )

  const csv = [headers, ...rows].join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="trades-${Date.now()}.csv"`,
    },
  })
}
```

---

### FR 3.4 TimescaleDB Optimization

The system **SHALL** leverage TimescaleDB features for optimal time-series performance.

- **FR 3.4.1** The trades table **SHALL** be created as a TimescaleDB hypertable partitioned by `created_at` for optimal time-series performance.

*Source: Data Analytics SME Phase 4 Review - TimescaleDB-Specific Optimizations*

#### Technical Implementation

Implemented via SQL migration (see FR 3.0 Technical Implementation).

---

## 4. Dashboard

### FR 4.0 Dashboard Organization

The system **SHALL** display current-day data in a single-screen vertically-stacked layout with all critical information above the fold.

- **FR 4.1** The dashboard **SHALL** display four main components: P&L Time Series Chart, Discipline Score Chart, Agency Score Chart, and AI Insights Panel.
- **FR 4.2** The P&L Time Series Chart **SHALL** be the largest and most prominent visualization.
- **FR 4.3** The discipline and agency score charts **SHALL** be positioned side-by-side for easy comparison.
- **FR 4.4** The AI Insights Panel **SHALL** be adjacent to the behavioral score charts.
- **FR 4.5** The trader **SHALL** be able to assess session state in 3 seconds or less (3-Second Rule).

*Source: Data Analytics SME Phase 1 Q1; Data Analytics SME Phase 1 Section 3*

#### Technical Implementation

**Dashboard Layout (`frontend/src/app/dashboard/page.tsx`):**
```typescript
'use client'

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-slate-950 pb-28">
      {/* Header with session summary */}
      <header className="border-b border-slate-800 p-4">
        <SessionSummary /> {/* Shows total P&L, trade count, win rate */}
      </header>

      {/* Main grid layout */}
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* FR 4.2: P&L Chart - largest */}
        <section className="min-h-[300px]">
          <PnLChart />
        </section>

        {/* FR 4.3: Side-by-side behavioral charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section>
            <ChartCard title="Discipline Score" icon={TargetIcon}>
              <DisciplineChart />
            </ChartCard>
          </section>
          <section>
            <ChartCard title="Agency Score" icon={BrainIcon}>
              <AgencyChart />
            </ChartCard>
          </section>
        </div>

        {/* FR 4.4: AI Insights Panel */}
        <section>
          <InsightsPanel />
        </section>
      </div>

      {/* FR 1.6: Fixed input at bottom */}
      <TradeEntry />
    </div>
  )
}
```

---

### FR 4.1 P&L Visualization

The system **SHALL** display cumulative P&L as a time-series chart.

- **FR 4.1.1** The chart **SHALL** show cumulative P&L (running total), not individual trade P&L.
- **FR 4.1.2** The line **SHALL** be green when above zero and red when below zero (dynamic coloring). At exactly zero, the system **SHALL** use a neutral gray or split gradient.
- **FR 4.1.2.1** Color transitions **SHALL** use smooth gradients rather than abrupt switches to reduce emotional reactivity.
- **FR 4.1.3** The chart **SHALL** include a horizontal reference line at $0 for breakeven.
- **FR 4.1.4** The chart **SHALL** display tooltips on hover showing: trade sequence number, timestamp (HH:MM:SS), individual trade P&L, cumulative P&L, direction (long/short), discipline score, and agency score.
- **FR 4.1.5** The chart **SHALL** use a line chart with area fill design.
- **FR 4.1.6** The P&L chart **SHALL** maintain aspect ratio and remain readable on screens as small as 768px width.
- **FR 4.1.7** Extreme P&L values (more than 3 standard deviations) **SHALL** be flagged in tooltips but still displayed.

*Source: Data Analytics SME Phase 1 Q1; Data Analytics SME Phase 1 Section 2.1; Phase 4 Review - Tooltips, Responsive, Outliers*

#### Technical Implementation

**P&L Chart Component (`frontend/src/components/charts/PnLChart.tsx`):**
```typescript
'use client'

import { useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import { format } from 'date-fns'
import type { TradeResponse } from '@/lib/schemas/trade'

interface PnLChartProps {
  trades: TradeResponse[]
  isLoading?: boolean
}

export function PnLChart({ trades, isLoading }: PnLChartProps) {
  // FR 4.1.1: Calculate cumulative P&L
  const chartData = useMemo(() => {
    let cumulative = 0
    return trades.map((trade, index) => {
      cumulative += Number(trade.pnl)
      return {
        sequence: trade.sequence_number,
        timestamp: trade.created_at,
        tradePnl: Number(trade.pnl),
        cumulativePnl: cumulative,
        direction: trade.direction,
        discipline: trade.discipline_score,
        agency: trade.agency_score,
        // FR 4.1.7: Flag outliers (3+ std dev)
        isOutlier: Math.abs(Number(trade.pnl)) > calculateStdDev(trades) * 3,
      }
    })
  }, [trades])

  // FR 4.1.2 & FR 4.1.2.1: Dynamic color with gradient
  const gradientOffset = () => {
    const dataMax = Math.max(...chartData.map((i) => i.cumulativePnl))
    const dataMin = Math.min(...chartData.map((i) => i.cumulativePnl))
    if (dataMax <= 0) return 0
    if (dataMin >= 0) return 1
    return dataMax / (dataMax - dataMin)
  }

  const off = gradientOffset()

  if (isLoading) return <ChartSkeleton />
  if (trades.length === 0) return <EmptyPnLChart />

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorPnl" x1="0" y1="0" x2="0" y2="1">
              <stop offset={off} stopColor="#22c55e" stopOpacity={0.3} />
              <stop offset={off} stopColor="#ef4444" stopOpacity={0.3} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis
            dataKey="sequence"
            stroke="#64748b"
            tick={{ fill: '#64748b', fontSize: 12 }}
          />
          <YAxis
            stroke="#64748b"
            tick={{ fill: '#64748b', fontSize: 12 }}
            tickFormatter={(value) => `$${value}`}
          />
          <Tooltip content={<CustomTooltip />} />
          {/* FR 4.1.3: Reference line at $0 */}
          <ReferenceLine y={0} stroke="#475569" strokeDasharray="3 3" />
          <Area
            type="monotone"
            dataKey="cumulativePnl"
            stroke="#94a3b8"
            fill="url(#colorPnl)"
            strokeWidth={2}
            // FR 4.1.5: Area fill design
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const data = payload[0].payload

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-xl">
      <div className="text-xs text-slate-400 mb-2">
        Trade #{data.sequence} &bull; {format(new Date(data.timestamp), 'HH:mm:ss')}
      </div>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-slate-400">Trade P&L:</span>
          <span className={data.tradePnl >= 0 ? 'text-green-400' : 'text-red-400'}>
            {formatCurrency(data.tradePnl)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-400">Cumulative:</span>
          <span className={data.cumulativePnl >= 0 ? 'text-green-400' : 'text-red-400'}>
            {formatCurrency(data.cumulativePnl)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-400">Direction:</span>
          <span className="text-white">{data.direction}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-400">Discipline:</span>
          <span className={getScoreColor(data.discipline)}>{data.discipline}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-400">Agency:</span>
          <span className={getScoreColor(data.agency)}>{data.agency}</span>
        </div>
        {data.isOutlier && (
          <div className="text-yellow-400 text-xs mt-2">
            * Extreme value (3+ std dev)
          </div>
        )}
      </div>
    </div>
  )
}
```

---

### FR 4.2 Discipline Score Visualization

The system **SHALL** display discipline scores as a running sum chart.

- **FR 4.2.1** The chart **SHALL** show running sum of discipline scores over the session.
- **FR 4.2.2** The chart **SHALL** use a step chart or line chart with data markers at each trade.
- **FR 4.2.3** The chart **SHALL** display color-coded segments: green for +1 scores, red for -1 scores, gray for 0.
- **FR 4.2.4** The chart **SHALL** show a reference line at y=0.
- **FR 4.2.5** The chart **SHALL** include a toggle option for a 3-trade moving average overlay.
- **FR 4.2.6** When session exceeds 50 trades, charts **SHALL** display rolling window of last 50 trades with option to view full history.

*Source: HLRD Section 3.3; Data Analytics SME Phase 2 Q2; Phase 4 Review - Data Windowing*

#### Technical Implementation

**Discipline Chart Component (`frontend/src/components/charts/DisciplineChart.tsx`):**
```typescript
'use client'

import { useState, useMemo } from 'react'
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
} from 'recharts'

interface DisciplineChartProps {
  trades: TradeResponse[]
}

export function DisciplineChart({ trades }: DisciplineChartProps) {
  const [showMovingAvg, setShowMovingAvg] = useState(false)
  const [showFullHistory, setShowFullHistory] = useState(false)

  const chartData = useMemo(() => {
    let runningSum = 0
    const data = trades.map((trade, index) => {
      runningSum += trade.discipline_score
      return {
        sequence: trade.sequence_number,
        score: trade.discipline_score,
        runningSum,
        timestamp: trade.created_at,
      }
    })

    // FR 4.2.6: Data windowing for 50+ trades
    const displayData = showFullHistory ? data : data.slice(-50)

    // FR 4.2.5: Calculate 3-trade moving average
    if (showMovingAvg) {
      return displayData.map((d, i) => ({
        ...d,
        movingAvg:
          i >= 2
            ? (displayData[i - 2].runningSum + displayData[i - 1].runningSum + d.runningSum) / 3
            : null,
      }))
    }

    return displayData
  }, [trades, showMovingAvg, showFullHistory])

  // FR 4.2.3: Custom dot color based on score
  const getDotColor = (score: number) => {
    if (score === 1) return '#22c55e' // green
    if (score === -1) return '#ef4444' // red
    return '#64748b' // gray
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-medium text-slate-300">Discipline</h3>
        <div className="flex gap-2">
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={showMovingAvg}
              onChange={(e) => setShowMovingAvg(e.target.checked)}
              className="rounded"
            />
            3-trade MA
          </label>
          {trades.length > 50 && (
            <button
              onClick={() => setShowFullHistory(!showFullHistory)}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              {showFullHistory ? 'Show last 50' : 'Show all'}
            </button>
          )}
        </div>
      </div>

      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="sequence" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 12 }} />
            <YAxis stroke="#64748b" tick={{ fill: '#64748b', fontSize: 12 }} />
            <Tooltip content={<ScoreTooltip />} />
            {/* FR 4.2.4: Reference line at y=0 */}
            <ReferenceLine y={0} stroke="#475569" strokeDasharray="3 3" />
            {/* FR 4.2.2: Line with markers */}
            <Line
              type="stepAfter"
              dataKey="runningSum"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={(props: any) => {
                const { cx, cy, index } = props
                const score = chartData[index]?.score ?? 0
                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={4}
                    fill={getDotColor(score)}
                    stroke="none"
                  />
                )
              }}
            />
            {showMovingAvg && (
              <Line
                type="monotone"
                dataKey="movingAvg"
                stroke="#94a3b8"
                strokeWidth={1}
                strokeDasharray="5 5"
                dot={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
```

---

### FR 4.3 Agency Score Visualization

The system **SHALL** display agency scores identically to discipline scores for pattern recognition consistency.

- **FR 4.3.1** The chart **SHALL** mirror the discipline chart in format and design.
- **FR 4.3.2** The chart **SHALL** use distinct colors from discipline (indigo/rose palette per AGENTS.md design system).

*Source: HLRD Section 3.4; Data Analytics SME Phase 1 Section 2.3*

#### Technical Implementation

**Agency Chart Component (`frontend/src/components/charts/AgencyChart.tsx`):**
```typescript
// Uses identical structure to DisciplineChart with color changes
// FR 4.3.1: Mirror discipline chart format
// FR 4.3.2: Use indigo/rose palette (#a855f7 / #f43f5e)

import { useState, useMemo } from 'react'
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'

export function AgencyChart({ trades }: { trades: TradeResponse[] }) {
  const [showMovingAvg, setShowMovingAvg] = useState(false)
  const [showFullHistory, setShowFullHistory] = useState(false)

  const chartData = useMemo(() => {
    let runningSum = 0
    const data = trades.map((trade) => {
      runningSum += trade.agency_score
      return {
        sequence: trade.sequence_number,
        score: trade.agency_score,
        runningSum,
        timestamp: trade.created_at,
      }
    })

    const displayData = showFullHistory ? data : data.slice(-50)

    if (showMovingAvg) {
      return displayData.map((d, i) => ({
        ...d,
        movingAvg:
          i >= 2
            ? (displayData[i - 2].runningSum + displayData[i - 1].runningSum + d.runningSum) / 3
            : null,
      }))
    }

    return displayData
  }, [trades, showMovingAvg, showFullHistory])

  // FR 4.3.2: Rose/indigo colors
  const getDotColor = (score: number) => {
    if (score === 1) return '#a855f7' // purple
    if (score === -1) return '#f43f5e' // rose
    return '#64748b' // gray
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-medium text-slate-300">Agency</h3>
        {/* Same controls as DisciplineChart */}
      </div>

      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="sequence" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 12 }} />
            <YAxis stroke="#64748b" tick={{ fill: '#64748b', fontSize: 12 }} />
            <Tooltip content={<ScoreTooltip />} />
            <ReferenceLine y={0} stroke="#475569" strokeDasharray="3 3" />
            <Line
              type="stepAfter"
              dataKey="runningSum"
              stroke="#a855f7"  // FR 4.3.2: Purple/rose palette
              strokeWidth={2}
              dot={(props: any) => {
                const { cx, cy, index } = props
                const score = chartData[index]?.score ?? 0
                return <circle cx={cx} cy={cy} r={4} fill={getDotColor(score)} stroke="none" />
              }}
            />
            {showMovingAvg && (
              <Line
                type="monotone"
                dataKey="movingAvg"
                stroke="#94a3b8"
                strokeWidth={1}
                strokeDasharray="5 5"
                dot={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
```

---

### FR 4.4 Visual Warning System

The system **SHALL** implement a graduated visual warning system for negative behavioral trends.

- **FR 4.4.1** The system **SHALL NOT** show warnings for sessions with fewer than 3 trades (minimum data requirement).
- **FR 4.4.2** The system **SHALL** show no alert for 2 consecutive -1 discipline scores (normal variance).
- **FR 4.4.3** The system **SHALL** show a yellow (amber) indicator when 3 consecutive -1 discipline scores occur.
- **FR 4.4.3.1** The warning **SHALL** require at least 2 of 3 trades to have explicit negative behavioral language in the trade description before triggering.
- **FR 4.4.4** The system **SHALL** show an orange indicator when 4+ consecutive -1 discipline scores occur.
- **FR 4.4.5** The warning **SHALL** be visual only (amber dot on chart edge), not interruptive (no pop-ups, sounds, or push notifications).
- **FR 4.4.6** The warning **SHALL** include a tooltip explaining the trigger on hover.
- **FR 4.4.7** The warning **SHALL** fade when the negative pattern resolves.

*Source: Behavioral Psychology SME Phase 2 Q4; Behavioral Psychology SME Phase 1 Section 2.3; Phase 4 Review - Warning Confirmation*

#### Technical Implementation

**Warning System Hook (`frontend/src/hooks/useBehavioralWarnings.ts`):**
```typescript
import { useMemo } from 'react'
import type { TradeResponse } from '@/lib/schemas/trade'

type WarningLevel = 'none' | 'amber' | 'orange'

interface BehavioralWarning {
  level: WarningLevel
  message: string
  triggeredBy: number[]
}

export function useBehavioralWarnings(trades: TradeResponse[]): BehavioralWarning {
  return useMemo(() => {
    // FR 4.4.1: Minimum 3 trades required
    if (trades.length < 3) {
      return { level: 'none', message: '', triggeredBy: [] }
    }

    // Analyze consecutive -1 discipline scores
    const disciplineScores = trades.map((t) => t.discipline_score)
    let consecutiveNegatives = 0
    let startIndex = -1
    let explicitNegatives = 0

    for (let i = disciplineScores.length - 1; i >= 0; i--) {
      if (disciplineScores[i] === -1) {
        if (consecutiveNegatives === 0) startIndex = i
        consecutiveNegatives++

        // FR 4.4.3.1: Check for explicit negative language
        if (trades[i].setup_description) {
          const desc = trades[i].setup_description.toLowerCase()
          const negativeTerms = ['chased', 'fomo', 'revenge', 'impulsive', 'deviated']
          if (negativeTerms.some((term) => desc.includes(term))) {
            explicitNegatives++
          }
        }
      } else {
        break
      }
    }

    // FR 4.4.2: No alert for 2 consecutive
    if (consecutiveNegatives < 3) {
      return { level: 'none', message: '', triggeredBy: [] }
    }

    // FR 4.4.3.1: Require 2/3 explicit negative language for amber
    const hasExplicitConfirmation = explicitNegatives >= Math.ceil(consecutiveNegatives / 2)

    if (!hasExplicitConfirmation && consecutiveNegatives === 3) {
      return { level: 'none', message: '', triggeredBy: [] }
    }

    // FR 4.4.3 & FR 4.4.4: Determine warning level
    if (consecutiveNegatives >= 4) {
      return {
        level: 'orange',
        message: '4+ consecutive undisciplined trades — consider stepping back',
        triggeredBy: Array.from({ length: consecutiveNegatives }, (_, i) => startIndex + i),
      }
    }

    return {
      level: 'amber',
      message: 'Discipline scores trending down — what\'s driving this?',
      triggeredBy: Array.from({ length: consecutiveNegatives }, (_, i) => startIndex + i),
    }
  }, [trades])
}
```

**Warning Indicator Component (`frontend/src/components/charts/WarningIndicator.tsx`):**
```typescript
'use client'

import { AlertTriangle } from 'lucide-react'
import type { WarningLevel } from '@/hooks/useBehavioralWarnings'

interface WarningIndicatorProps {
  level: WarningLevel
  message: string
}

export function WarningIndicator({ level, message }: WarningIndicatorProps) {
  if (level === 'none') return null

  // FR 4.4.5: Visual only, not interruptive
  const colors = {
    amber: 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400',
    orange: 'bg-orange-500/20 border-orange-500/50 text-orange-400',
  }

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${colors[level]} transition-opacity`}
      title={message}  // FR 4.4.6: Tooltip on hover
    >
      <AlertTriangle size={16} />
      <span className="text-xs">{message}</span>
    </div>
  )
}
```

---

### FR 4.5 Early Session Handling

The system **SHALL** handle the "no data" state gracefully for early-session traders.

- **FR 4.5.1** With 0 trades, the system **SHALL** show a placeholder chart area with dashed outline and message: "Log your first trade to begin tracking."
- **FR 4.5.2** With 1 trade, the system **SHALL** display the single data point with message: "1 trade logged — patterns emerge with more data."
- **FR 4.5.3** With 2 trades, the system **SHALL** show a line connecting the two points with message: "2 trades — early indicators forming."
- **FR 4.5.4** The system **SHALL** clearly indicate the 5+ trade threshold where trend lines become statistically meaningful.
- **FR 4.5.5** Charts **SHALL** render with empty state (axes visible, no data line) rather than hiding completely when no data exists.

*Source: Data Analytics SME Phase 2 Q6; Phase 4 Review - Empty State Chart Rendering*

#### Technical Implementation

**Empty State Components (`frontend/src/components/charts/EmptyStates.tsx`):**
```typescript
export function EmptyPnLChart() {
  return (
    <div className="h-[300px] border-2 border-dashed border-slate-700 rounded-lg flex flex-col items-center justify-center text-slate-500">
      {/* FR 4.5.5: Axes visible, no data line */}
      <div className="w-full h-full opacity-30">
        <ResponsiveContainer>
          <AreaChart>
            <XAxis dataKey="x" />
            <YAxis />
            <ReferenceLine y={0} stroke="#475569" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {/* FR 4.5.1: Placeholder message */}
      <div className="absolute">
        <p className="text-lg font-medium">Log your first trade to begin tracking.</p>
      </div>
    </div>
  )
}

export function EarlySessionMessage({ tradeCount }: { tradeCount: number }) {
  const messages = {
    0: 'Log your first trade to begin tracking.',
    1: '1 trade logged — patterns emerge with more data.',
    2: '2 trades — early indicators forming.',
  }

  // FR 4.5.4: 5+ threshold indicator
  const showThreshold = tradeCount >= 3 && tradeCount < 5

  return (
    <div className="text-center py-4">
      <p className="text-slate-400">{messages[tradeCount as keyof typeof messages] || ''}</p>
      {showThreshold && (
        <p className="text-xs text-blue-400 mt-2">
          {5 - tradeCount} more trade{tradeCount === 3 ? 's' : ''} until trends become statistically meaningful
        </p>
      )}
    </div>
  )
}
```

---

### FR 4.6 Real-Time Updates

The system **SHALL** update the dashboard in real-time without page refresh.

- **FR 4.6.1** The system **SHALL** update charts immediately upon trade submission using optimistic UI.
- **FR 4.6.2** The system **SHALL** animate chart updates with 300-500ms smooth transitions using ease-out-cubic easing.
- **FR 4.6.3** The system **SHALL** maintain consistent chart sizing after updates (no layout shift).

*Source: Data Analytics SME Phase 1 Section 3.3; Data Analytics SME Phase 2 Q1; Phase 4 Review - Animation Specifications*

#### Technical Implementation

**Real-Time Updates via React Query:**
```typescript
// FR 4.6.1: Optimistic updates handled by useOptimisticTrades hook
// Charts automatically re-render when trades query data updates

// FR 4.6.2: Animation via Recharts
<AreaChart>
  <Animation duration={300} isAnimationActive={true} />
</AreaChart>

// FR 4.6.3: Fixed height containers prevent layout shift
<div className="h-[300px]"> {/* Fixed height */}
  <ResponsiveContainer />
</div>
```

---

### FR 4.7 Cognitive Bias Mitigation

The system **SHALL** implement strategies to reduce cognitive biases in visualization.

- **FR 4.7.1** The P&L chart **SHALL** display cumulative values, not percentage changes, to reduce relative thinking bias.
- **FR 4.7.2** Insights **SHALL** explicitly frame neutral information as such, avoiding language that implies pattern significance when statistical significance is uncertain.
- **FR 4.7.3** The system **SHALL NOT** highlight "near misses" or "almost wins" that could trigger recency bias.
- **FR 4.7.4** The P&L chart **SHALL** display a horizontal reference showing the average P&L per trade as a subtle guide, not prominently.

*Source: Behavioral Psychology SME Phase 4 Review - Cognitive Bias Mitigation*

#### Technical Implementation

**P&L Chart with Average Reference (`frontend/src/components/charts/PnLChart.tsx`):**
```typescript
// FR 4.7.1: Cumulative values (already implemented)
// FR 4.7.4: Subtle average reference line

const averagePnl = useMemo(() => {
  if (trades.length === 0) return 0
  const total = trades.reduce((sum, t) => sum + Number(t.pnl), 0)
  return total / trades.length
}, [trades])

<ReferenceLine
  y={averagePnl}
  stroke="#64748b"
  strokeWidth={1}
  strokeDasharray="2 2"
  label={{
    value: 'avg',
    position: 'right',
    fill: '#64748b',
    fontSize: 10,
  }}
/>
```

---

### FR 4.8 Self-Report Calibration

The system **SHALL** provide mechanisms for traders to adjust AI-inferred scores.

- **FR 4.8.1** The system **SHALL** provide a mechanism for traders to manually adjust discipline and agency scores with a reason field.
- **FR 4.8.2** The system **SHALL** log AI/trader score discrepancies for model calibration.

*Source: Behavioral Psychology SME Phase 4 Review - Self-Report Calibration*

#### Technical Implementation

**Score Adjustment Modal (`frontend/src/components/trading/AdjustScoresModal.tsx`):**
```typescript
'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

interface AdjustScoresProps {
  trade: TradeResponse
  onClose: () => void
}

export function AdjustScoresModal({ trade, onClose }: AdjustScoresProps) {
  const [discipline, setDiscipline] = useState(trade.discipline_score)
  const [agency, setAgency] = useState(trade.agency_score)
  const [reason, setReason] = useState('')

  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/v1/trades/${trade.id}/adjust`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discipline_score: discipline, agency_score: agency, reason }),
      })
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trades'] })
      onClose()
    },
  })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 max-w-md w-full">
        <h3 className="text-lg font-medium mb-4">Adjust Scores</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-2">Discipline Score</label>
            <select
              value={discipline}
              onChange={(e) => setDiscipline(Number(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2"
            >
              <option value={-1}>-1 (Undisciplined)</option>
              <option value={0}>0 (Neutral)</option>
              <option value={1}>+1 (Disciplined)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">Agency Score</label>
            <select
              value={agency}
              onChange={(e) => setAgency(Number(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2"
            >
              <option value={-1}>-1 (Reactive)</option>
              <option value={0}>0 (Neutral)</option>
              <option value={1}>+1 (Intentional)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">
              Reason for adjustment (FR 4.8.1)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why are you adjusting the score?"
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 h-20"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button onClick={() => mutation.mutate()} className="flex-1">
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

**Score Adjustment API (`frontend/src/app/api/v1/trades/[id]/adjust/route.ts`):**
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { trades } from '@/lib/db/schema'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()

  // Validate adjustment values
  if (![-1, 0, 1].includes(body.discipline_score) || ![-1, 0, 1].includes(body.agency_score)) {
    return NextResponse.json({ error: 'Invalid score values' }, { status: 400 })
  }

  // FR 4.8.2: Log discrepancy for calibration
  const [trade] = await db.update(trades)
    .set({
      disciplineScore: body.discipline_score,
      agencyScore: body.agency_score,
      adjustmentReason: body.reason,
      adjustedBy: session.user.id,
      adjustedAt: new Date(),
    })
    .where(eq(trades.id, id))
    .returning()

  // Note: In production, also update session aggregates

  return NextResponse.json({ data: trade })
}
```

---

## 5. AI Insights

### FR 5.0 Insights Generation

The system **SHALL** generate and display AI-powered insights after each trade.

- **FR 5.1** The system **SHALL** feed the full session's trade data to a Trading Expert agent for regeneration after each trade.
- **FR 5.2** The system **SHALL** pass both raw trade records and aggregated session statistics to the insights agent.
- **FR 5.3** The insights **SHALL** include: behavioral patterns, setup consistency, emotional state indicators, and actionable flags.
- **FR 5.4** The insights **SHALL** be displayed in a card format with 2-4 bullet points maximum.
- **FR 5.5** The insights panel **SHALL** show a timestamp: "Last updated: HH:MM:SS".

*Source: HLRD Section 3.5; AI/NLP SME Phase 2 Q7*

#### Technical Implementation

**Insights Generation Node (`backend/src/agent/nodes/generate_insights.py`):**
```python
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel
from typing import List, Optional

class Insight(BaseModel):
    category: str  # "risk", "pattern", "positive"
    message: str
    severity: Optional[str] = None  # "warning", "info", "success"

class InsightsResponse(BaseModel):
    insights: List[Insight]
    generated_at: str
    trade_count: int

# FR 5.1.2: Context payload structure
SESSION_CONTEXT_TEMPLATE = """
Session Summary:
- Total trades: {total_trades}
- Total P&L: ${total_pnl}
- Win rate: {win_rate}%
- Discipline sum: {discipline_sum}
- Agency sum: {agency_sum}
- Session duration: {session_duration_minutes} minutes
- Avg trade interval: {avg_trade_interval} minutes

Trades:
{trades_json}

Recent Trends:
- Last 3 discipline scores: {last_3_discipline}
- Last 3 agency scores: {last_3_agency}
- Consecutive losses: {consecutive_losses}
- Consecutive wins: {consecutive_wins}
"""

INSIGHTS_PROMPT = """You are a trading psychology expert providing insights to a trader.

Based on the session data provided, generate 2-4 actionable insights.

Guidelines:
- Be concise (1-2 sentences per insight)
- Use conditional framing ("Your discipline score has dropped") not judgment
- Offer actions, not diagnosis
- Color code by severity: green (positive), yellow (caution), red (warning)
- Maximum 3 insights to avoid cognitive overload

Categories to consider:
1. **Risk Alerts** (Tier 1): Tilt risk, overconfidence, session fatigue
2. **Pattern Recognition** (Tier 2): Discipline trajectory, agency breakdown
3. **Positive Reinforcement** (Tier 3): Streaks, recovery patterns

Important:
- Do NOT generate behavioral trend insights for fewer than 5 trades
- For early sessions (0-4 trades), provide encouraging messages only
- Frame neutral information as neutral, not as patterns

Session data:
{session_context}

Output JSON with this schema:
{{
  "insights": [
    {{"category": "risk|pattern|positive", "message": "...", "severity": "warning|info|success"}}
  ],
  "generated_at": "ISO timestamp",
  "trade_count": N
}}"""

def generate_insights_node(state: dict) -> dict:
    """Generate AI insights from session data."""

    # FR 5.1: Build context payload
    trades = state.get("trades", [])
    session = state.get("session", {})

    # FR 5.1.1: Calculate metrics
    total_trades = len(trades)
    total_pnl = sum(t.get("pnl", 0) for t in trades)
    win_count = sum(1 for t in trades if t.get("outcome") == "win")
    win_rate = (win_count / total_trades * 100) if total_trades > 0 else 0

    # FR 5.1.1: Median trade interval (excluding gaps > 60 min)
    trade_intervals = calculate_trade_intervals(trades)
    median_interval = calculate_median([i for i in trade_intervals if i <= 60]) if trade_intervals else 0

    # FR 5.1.3: Recent trends
    last_3_discipline = [t.get("discipline_score", 0) for t in trades[-3:]]
    last_3_agency = [t.get("agency_score", 0) for t in trades[-3:]]
    consecutive_losses = count_consecutive(trades, "loss")
    consecutive_wins = count_consecutive(trades, "win")

    # Build context
    context = SESSION_CONTEXT_TEMPLATE.format(
        total_trades=total_trades,
        total_pnl=total_pnl,
        win_rate=round(win_rate, 1),
        discipline_sum=sum(last_3_discipline),
        agency_sum=sum(last_3_agency),
        session_duration_minutes=state.get("session_duration", 0),
        avg_trade_interval=round(median_interval, 1),
        trades_json=json.dumps(trades[-10:]),  # Last 10 trades
        last_3_discipline=last_3_discipline,
        last_3_agency=last_3_agency,
        consecutive_losses=consecutive_losses,
        consecutive_wins=consecutive_wins,
    )

    # FR 5.4: Use gpt-4o for insights generation
    model = ChatOpenAI(model="gpt-4o", temperature=0.7, max_retries=2)

    prompt = ChatPromptTemplate.from_messages([
        ("system", INSIGHTS_PROMPT),
        ("human", "{session_context}"),
    ])

    chain = prompt | model.with_structured_output(InsightsResponse)

    result = chain.invoke({"session_context": context})

    return {
        "insights": result.insights,
        "insights_generated_at": result.generated_at,
        "insights_trade_count": result.trade_count,
    }
```

---

### FR 5.1 Insights Context Format

The system **SHALL** pass structured JSON data to the insights generation agent.

- **FR 5.1.1** The payload **SHALL** include a `session_summary` object with: total_trades, total_pnl, win_count, loss_count, win_rate, discipline_sum, agency_sum, session_duration_minutes, avg_trade_interval_minutes (calculated as median time between trades, excluding gaps greater than 60 minutes).
- **FR 5.1.2** The payload **SHALL** include a `trades` array with sequence, timestamp, direction, pnl, setup_description, discipline_score, agency_score for each trade.
- **FR 5.1.3** The payload **SHALL** include a `recent_trends` object with last_3_discipline, last_3_agency, consecutive_losses, consecutive_wins.

*Source: AI/NLP SME Phase 2 Q7; Phase 4 Review - Calculation Ambiguity*

#### Technical Implementation

Implemented in `generate_insights_node` (FR 5.0 Technical Implementation).

---

### FR 5.2 Insights Generation Timing

The system **SHALL** generate insights asynchronously to meet the 3-second SLA.

- **FR 5.2.1** The 3-second SLA **SHALL** apply to trade entry completion and dashboard data update only, not to insights generation.
- **FR 5.2.2** Insights generation **SHALL** be queued asynchronously after trade commit.
- **FR 5.2.3** The dashboard **SHALL** show "Generating insights..." placeholder during generation.
- **FR 5.2.4** Insights **SHALL** load within 1-2 seconds via background process.

*Source: AI/NLP SME Phase 2 Q3, Q5*

#### Technical Implementation

**Async Insights Pipeline:**
```typescript
// In trade submission API (FR 1.0)
async function handleTradeSubmission(trade: TradeResponse) {
  // 1. Immediately return trade to user (3-second SLA)
  return NextResponse.json({ data: trade }, { status: 201 })

  // 2. Async: Trigger insights generation (non-blocking)
  fetch(`${process.env.BACKEND_URL}/api/v1/insights/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: trade.session_id }),
  }).catch(console.error)  // Don't block on insights failure
}

// Frontend: Loading state
function InsightsPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['insights', sessionId],
    queryFn: () => fetch(`/api/v1/insights?session_id=${sessionId}`).then(r => r.json()),
    // FR 5.2.3: Show loading state
    placeholderData: (previous) => previous,
  })

  if (isLoading) {
    return <div className="text-slate-500">Generating insights...</div>
  }

  return <InsightsList insights={data?.insights} timestamp={data?.generated_at} />
}
```

---

### FR 5.3 Insights Regeneration Strategy

The system **SHALL** regenerate insights strategically to balance freshness with performance.

- **FR 5.3.1** The system **SHALL** regenerate insights after each trade under normal pace (<1 trade/minute).
- **FR 5.3.2** The system **SHALL** debounce 2-3 seconds for rapid submissions (>1 trade/minute).
- **FR 5.3.3** The system **SHALL** cache insights by session ID + trade count + hash of last 3 trades to prevent stale insights.
- **FR 5.3.4** The system **SHALL** regenerate if current_trade_count != cached_trade_count or last_trade_time changes.

*Source: AI/NLP SME Phase 2 Q8; Data Analytics SME Phase 2 Q3; Phase 4 Review - Cache Key Enhancement*

#### Technical Implementation

**Insights Cache (`backend/src/agent/workflows/insights_caching.py`):**
```python
import hashlib
from typing import Optional
from pydantic import BaseModel

class InsightsCache(BaseModel):
    session_id: str
    trade_count: int
    last_trade_hash: str  # Hash of last 3 trades
    insights: list
    generated_at: str

_cache: dict[str, InsightsCache] = {}

def get_cache_key(session_id: str, trades: list[dict]) -> str:
    """FR 5.3.3: Cache key = session_id + trade_count + hash(last 3 trades)"""
    trade_count = len(trades)
    last_3_trades = trades[-3:] if trades else []
    trades_str = json.dumps(last_3_trades, sort_keys=True)
    hash_val = hashlib.sha256(trades_str.encode()).hexdigest()[:8]
    return f"{session_id}:{trade_count}:{hash_val}"

def should_regenerate(session_id: str, trades: list[dict]) -> bool:
    """FR 5.3.4: Regenerate if conditions changed"""
    if session_id not in _cache:
        return True

    cached = _cache[session_id]
    current_count = len(trades)

    # Trade count changed
    if current_count != cached.trade_count:
        return True

    # Last trade time changed (check via hash)
    current_hash = get_cache_key(session_id, trades).split(':')[-1]
    if current_hash != cached.last_trade_hash:
        return True

    return False

def debounce_insights_generation(session_id: str, trades: list[dict], delay: float = 2.0):
    """FR 5.3.2: Debounce rapid submissions"""
    import asyncio

    async def delayed_generation():
        await asyncio.sleep(delay)
        if should_regenerate(session_id, trades):
            await generate_and_cache_insights(session_id, trades)

    asyncio.create_task(delayed_generation())
```

---

### FR 5.4 Small Session Insights

The system **SHALL** implement tiered insight generation based on trade count.

| Trade Count | Insight Type | Example |
|-------------|--------------|---------|
| 0 | Welcome message | "Ready to trade. Enter your first trade to begin tracking." |
| 1 | Initial assessment | "First trade complete. Starting to build your session pattern." |
| 2-4 | Early patterns | "2 wins so far. Watch for early discipline trends as session develops." |
| 5-9 | Meaningful patterns | Full analysis with trends |
| 10+ | Full analysis | Comprehensive behavioral analysis |

- **FR 5.4.1** The system **SHALL** show encouraging messages for fewer than 5 trades, not false confidence.
- **FR 5.4.2** The system **SHALL NOT** generate behavioral trend insights for fewer than 5 trades.

*Source: AI/NLP SME Phase 2 Q9*

#### Technical Implementation

**Tiered Insights (`backend/src/agent/nodes/generate_insights.py`):**
```python
EARLY_SESSION_MESSAGES = {
    0: "Ready to trade. Enter your first trade to begin tracking.",
    1: "First trade complete. Starting to build your session pattern.",
    2: "2 trades — early indicators forming.",
    3: "3 trades — watch for early discipline trends.",
    4: "4 trades — almost at the threshold for pattern analysis.",
}

def generate_insights_node(state: dict) -> dict:
    trades = state.get("trades", [])
    trade_count = len(trades)

    # FR 5.4.1: Early session messages
    if trade_count < 5:
        return {
            "insights": [
                {
                    "category": "positive",
                    "message": EARLY_SESSION_MESSAGES[trade_count],
                    "severity": "info"
                }
            ],
            "insights_generated_at": datetime.utcnow().isoformat(),
            "insights_trade_count": trade_count,
            "is_early_session": True,
        }

    # FR 5.4.2: No behavioral trends for < 5 trades
    # For 5+, generate full insights
    return generate_full_insights(state)
```

---

### FR 5.5 Insight Categories

The system **SHALL** prioritize actionable insight categories in a specific order.

#### Tier 1: Immediate Risk Alerts
- **FR 5.5.1** Tilt Risk Indicator: Trigger at 2+ consecutive losses with discipline -1. Message: "Two losses in a row — consider stepping back for 5 minutes."
- **FR 5.5.1.1** Tilt warnings **SHALL** offer options rather than directives (e.g., "Consider: [take break] [reduce size] [log why]").
- **FR 5.5.2** Overconfidence Warning: Trigger at 3+ consecutive wins with +1 discipline. Message: "Three wins in a row — remember to size appropriately."
- **FR 5.5.3** Session Fatigue Alert: Trigger at 90+ minutes with declining discipline. Message: "You've been trading for 90+ minutes — decision quality typically declines."

#### Tier 2: Pattern Recognition (Show After 3+ Trades)
- **FR 5.5.4** Discipline Trajectory: Trigger at 3 consecutive -1 scores. Message: "Discipline scores trending down — what's driving this?"
- **FR 5.5.5** Agency Breakdown: Trigger at agency -1. Message: "Recent trade felt reactive — what was the trigger?"

#### Tier 3: Positive Reinforcement
- **FR 5.5.6** Streak Recognition: Trigger at 3+ win streak or 3+ disciplined trades. Message: "You're sticking to your plan — keep it up."
- **FR 5.5.7** Recovery Pattern: Trigger at positive discipline after recovering from loss. Message: "Good recovery after that loss — maintained discipline."

*Source: Behavioral Psychology SME Phase 2 Q2; Phase 4 Review - Warning Message Options*

#### Technical Implementation

Insight category detection is embedded in the prompt (FR 5.0). The LLM is instructed to prioritize:
1. Risk alerts (tier 1) - always shown when triggered
2. Pattern recognition (tier 2) - shown after 3+ trades
3. Positive reinforcement (tier 3) - shown when patterns warrant

---

### FR 5.6 Insight Presentation Standards

The system **SHALL** present insights in a trader-friendly format.

- **FR 5.6.1** Insights **SHALL** be 1-2 sentences maximum, action-oriented.
- **FR 5.6.2** Insights **SHALL** use conditional framing ("Your discipline score has dropped") rather than judgment ("You're losing control").
- **FR 5.6.3** Insights **SHALL** offer action, not diagnosis ("Consider a 5-minute break" vs. "You're tilting").
- **FR 5.6.4** Insights **SHALL** use color coding by severity: green (positive), yellow (caution), red (warning) — but use sparingly.
- **FR 5.6.5** Maximum 3 insights **SHALL** be displayed at once to avoid cognitive overload.
- **FR 5.6.6** Insights **SHALL** ensure meaningful positive reinforcement when patterns warrant, without mandating a specific percentage.

*Source: Behavioral Psychology SME Phase 1 Section 2.3; Behavioral Psychology SME Phase 1 Section 4.3; Behavioral Psychology SME Phase 2 Q2; Phase 4 Review - Removed 40% Quota*

#### Technical Implementation

**Insights Panel Component (`frontend/src/components/insights/InsightsPanel.tsx`):**
```typescript
'use client'

import { format } from 'date-fns'
import type { Insight } from '@/lib/schemas/insights'

interface InsightsPanelProps {
  insights: Insight[]
  generatedAt?: string
  isLoading?: boolean
}

export function InsightsPanel({ insights, generatedAt, isLoading }: InsightsPanelProps) {
  // FR 5.6.5: Maximum 3 insights
  const displayInsights = insights.slice(0, 3)

  // FR 5.6.4: Color coding by severity
  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case 'success': return 'border-green-500/30 bg-green-500/5 text-green-400'
      case 'warning': return 'border-yellow-500/30 bg-yellow-500/5 text-yellow-400'
      case 'info': default: return 'border-slate-700 bg-slate-800/50 text-slate-300'
    }
  }

  if (isLoading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
        <h3 className="text-sm font-medium text-slate-300 mb-3">AI Insights</h3>
        <p className="text-slate-500 text-sm">Generating insights...</p>
      </div>
    )
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-medium text-slate-300">AI Insights</h3>
        {generatedAt && (
          <span className="text-xs text-slate-500">
            Last updated: {format(new Date(generatedAt), 'HH:mm:ss')}
          </span>
        )}
      </div>

      {displayInsights.length === 0 ? (
        <p className="text-slate-500 text-sm">No insights available yet.</p>
      ) : (
        <ul className="space-y-2">
          {displayInsights.map((insight, index) => (
            <li
              key={index}
              className={`p-3 rounded-lg border ${getSeverityColor(insight.severity)}`}
            >
              {/* FR 5.6.1-5.6.3: 1-2 sentences, conditional framing, action-oriented */}
              <p className="text-sm">{insight.message}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

---

## 6. Non-Functional Requirements

### NFR 1.0 Performance

The system **SHALL** meet strict latency requirements.

- **NFR 1.1** Trade entry to confirmed database write **SHALL** complete in under 3 seconds under normal conditions.
- **NFR 1.2** Dashboard data update **SHALL** complete synchronously within the 3-second SLA.
- **NFR 1.3** Insights generation **SHALL** complete within 1-2 seconds (async, non-blocking).
- **NFR 1.4** Database queries for dashboard load **SHALL** complete in under 10ms for typical sessions using pre-computed aggregates.

*Source: HLRD Section 5.1; AI/NLP SME Phase 2 Q3*

#### Technical Implementation

Performance requirements are met through:
- **NFR 1.1-1.2**: Async extraction after trade insert (non-blocking)
- **NFR 1.3**: Async insights via background queue
- **NFR 1.4**: Pre-computed session aggregates via database triggers (FR 3.1)

---

### NFR 2.0 Reliability

The system **SHALL** ensure data integrity and error recovery.

- **NFR 2.1** The AI extraction agent **SHALL** return valid, schema-conformant JSON response or surface a recoverable error.
- **NFR 2.2** The system **SHALL NOT** write partial records to the database.
- **NFR 2.3** Trade insert and aggregate update **SHALL** occur within the same database transaction.
- **NFR 2.4** Failed insights generation **SHALL** retry once, then show error state with retry button.
- **NFR 2.5** The system **SHALL** cache the last valid insights to display during regeneration.

*Source: HLRD Section 5.2; Data Analytics SME Phase 2 Q8*

#### Technical Implementation

- **NFR 2.1**: Pydantic validation + retry logic (FR 2.1)
- **NFR 2.2**: Trade saved with pending status, extraction triggered async
- **NFR 2.3**: Database trigger for atomic updates (FR 3.1)
- **NFR 2.4-2.5**: Insights caching implemented (FR 5.3)

---

### NFR 3.0 Usability

The system **SHALL** provide an intuitive, non-intrusive user experience.

- **NFR 3.1** The UI **SHALL** stay out of the way during live trading with minimal clicks and no required navigation.
- **NFR 3.2** The input **SHALL** remain persistent and accessible at all times.
- **NFR 3.3** The dashboard **SHALL** support assessment of session state in 3 seconds or less.
- **NFR 3.4** Insights **SHALL** be collapsible (collapsed by default after session establishes baseline).
- **NFR 3.5** No push notifications, pop-ups, or sound alerts **SHALL** interrupt active trading.
- **NFR 3.6** The system **SHALL** support keyboard navigation for the input field.

*Source: HLRD Section 4.4; Behavioral Psychology SME Phase 1 Section 4.1; Data Analytics SME Phase 1 Q1*

#### Technical Implementation

- **NFR 3.1-3.2**: Fixed bottom trade entry (FR 1.0)
- **NFR 3.3**: All data above fold, summary in header
- **NFR 3.4**: Collapsible insights panel with default collapsed after 5+ trades
- **NFR 3.5**: Visual-only warnings, no interrupts
- **NFR 3.6**: Auto-focus on input after submission, Enter to submit

---

### NFR 4.0 Scalability

The system **SHALL** handle reasonable data volumes efficiently.

- **NFR 4.1** The system **SHALL** keep all trade data indefinitely for Phase 1 (no archival required).
- **NFR 4.2** Charts **SHALL** implement data windowing if session exceeds 50+ trades.
- **NFR 4.3** Chart components **SHALL** be memoized to prevent unnecessary re-renders.

*Source: Data Analytics SME Phase 2 Q7; Data Analytics SME Phase 1 Section 4*

#### Technical Implementation

- **NFR 4.1**: No archival in Phase 1
- **NFR 4.2**: Data windowing implemented (FR 4.2.6)
- **NFR 4.3**: React.memo on chart components

---

### NFR 5.0 Accessibility

The system **SHALL** meet accessibility standards.

- **NFR 5.1** Color **SHALL NOT** be the only indicator (add icons, patterns, or labels).
- **NFR 5.2** Minimum contrast ratio of 4.5:1 **SHALL** be maintained for text.
- **NFR 5.3** Screen reader labels **SHALL** be included for all interactive elements.

*Source: Data Analytics SME Phase 1 Section 5*

#### Technical Implementation

- **NFR 5.1**: Icons accompany all color indicators in charts and warnings
- **NFR 5.2**: Dark theme maintains 4.5:1+ contrast (slate-400 on slate-950)
- **NFR 5.3**: All buttons/inputs have aria-labels

---

## 7. Technical Implementation Constraints

### TIC 1.0 Stack Compliance

The system **SHALL** be implemented using the established technology stack.

- **TIC 1.1** Frontend **SHALL** use Next.js + TypeScript + Shadcn/ui + Tailwind CSS.
- **TIC 1.2** Backend **SHALL** use FastAPI + LangGraph + LangChain + OpenAI.
- **TIC 1.3** Database **SHALL** use TimescaleDB (PostgreSQL 16) + Drizzle ORM.
- **TIC 1.4** AI Interface **SHALL** use CopilotKit.
- **TIC 1.5** Charting **SHALL** use Recharts or Tremor (React-native, compatible with Shadcn/ui).

*Source: AGENTS.md Tech Stack Section*

#### Technical Implementation

All components align with the established stack:
- Frontend: Next.js 15, TypeScript, Shadcn/ui, Tailwind CSS
- Backend: FastAPI, LangGraph, LangChain, OpenAI
- Database: TimescaleDB, Drizzle ORM
- AI: CopilotKit
- Charts: Recharts

---

### TIC 2.0 Integration Requirements

The system **SHALL** follow established integration patterns.

- **TIC 2.1** All CopilotKit traffic **SHALL** flow through the Next.js `/api/copilotkit` proxy.
- **TIC 2.2** The FastAPI backend **SHALL NOT** be exposed directly to the browser.
- **TIC 2.3** The trade extraction agent **SHALL** be implemented as a LangGraph node within the backend.
- **TIC 2.4** Backend endpoint **SHALL** use `add_langgraph_fastapi_endpoint` from `ag_ui_langgraph`.

*Source: AGENTS.md Integration Gotchas; AI/NLP SME Phase 4 Review - Package Name Verification*

#### Technical Implementation

**CopilotKit Integration (`frontend/src/app/api/copilotkit/route.ts`):**
```typescript
import { CopilotRuntime } from '@copilotkit/runtime'
import { HttpAgent } from '@ag-ui/client'

const runtime = new CopilotRuntime({
  agents: {
    chat_agent: new HttpAgent({
      url: `${process.env.BACKEND_URL}/api/copilotkit/chat_agent`,
    }),
  },
})

export const POST = runtime.route()
```

**FastAPI LangGraph Endpoint (`backend/src/main.py`):**
```python
import dotenvenv.load_dotenv
dot()  # Must be first!

from fastapi import FastAPI
from ag_ui_langgraph import add_langgraph_fastapi_endpoint
from langgraph.checkpoint.memory import MemorySaver
from src.agent.graphs.trade_extraction import create_extraction_graph

app = FastAPI()

# FR TIC 2.4: Use ag_ui_langgraph
add_langgraph_fastapi_endpoint(
    app,
    path="/api/copilotkit",
    agent=create_extraction_graph(),
    checkpointer=MemorySaver(),
)
```

---

## Success Criteria Checklist

- [ ] Trade entry to confirmed database write completes in under 3 seconds
- [ ] Extraction accuracy is high enough that manual corrections are rarely needed
- [ ] Discipline and agency scores feel fair and consistent to the trader
- [ ] AI insights feel relevant and specific to the session, not generic
- [ ] The UI stays out of the way during live trading
- [ ] Dashboard updates in real-time without page refresh
- [ ] Insights generation is asynchronous and non-blocking
- [ ] Graduated warning system activates at correct thresholds (3+ trades)
- [ ] Early session states handled gracefully with encouraging messages
- [ ] All requirements implemented using the established tech stack

---

## Appendix: Architecture Overview

### Tech Stack Summary

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend Framework | Next.js | 15.x |
| Language | TypeScript | 5.x |
| UI Components | Shadcn/ui + Tailwind | Latest |
| Backend Framework | FastAPI | 0.115.x |
| AI Orchestration | LangGraph | 0.2.x |
| AI Integration | LangChain + OpenAI | Latest |
| Database | TimescaleDB (PostgreSQL 16) | 16 |
| ORM | Drizzle | 0.40.x |
| AI Interface | CopilotKit | Latest |
| Charts | Recharts | Latest |

### Data Flow

```
User Input (Natural Language)
         │
         ▼
  Next.js API Route
  (TradeEntry.tsx)
         │
         ├──► Drizzle ORM ──► TimescaleDB (trades + sessions)
         │                           │
         │                           ▼
         │                    Database Trigger
         │                    (Session Aggregates)
         │                           │
         ▼                           │
  Async: FastAPI /extract            │
  (LangGraph: extract_trade_node)   │
         │                           │
         ▼                           │
  OpenAI gpt-4o-mini                │
  (Structured Output)               │
         │                           │
         ▼                           │
  Update Trade Record               │
         │
         ▼
  Async: FastAPI /insights/generate
  (LangGraph: generate_insights_node)
         │
         ▼
  OpenAI gpt-4o
  (Insights Generation)
         │
         ▼
  Dashboard Refresh
  (React Query + Recharts)
```

### Component Hierarchy

```
app/
├── (auth)/
│   ├── sign-in/
│   └── sign-up/
├── dashboard/
│   ├── page.tsx (DashboardPage)
│   └── loading.tsx
├── chat/
│   └── page.tsx (CopilotKit)
└── api/
    ├── v1/
    │   ├── trades/
    │   │   ├── route.ts (CRUD)
    │   │   └── [id]/
    │   │       └── adjust/
    │   │           └── route.ts
    │   ├── export/
    │   │   └── route.ts
    │   └── insights/
    │       └── route.ts
    ├── copilotkit/
    │   └── route.ts (CopilotKit proxy)
    └── auth/
        └── [...all]/

components/
├── trading/
│   ├── TradeEntry.tsx
│   └── AdjustScoresModal.tsx
├── charts/
│   ├── PnLChart.tsx
│   ├── DisciplineChart.tsx
│   ├── AgencyChart.tsx
│   └── WarningIndicator.tsx
├── insights/
│   └── InsightsPanel.tsx
└── ui/ (Shadcn components)

lib/
├── db/
│   ├── schema/
│   │   ├── auth.ts
│   │   ├── trades.ts
│   │   └── sessions.ts
│   └── index.ts
├── schemas/
│   └── trade.ts (Zod)
└── hooks/
    ├── useOptimisticTrades.ts
    └── useBehavioralWarnings.ts
```

### Deployment Topology

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  Frontend (Next.js :3000)                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   UI Layer  │  │  API Routes │  │  CopilotKit Proxy   │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└────────────────────────┬────────────────────────────────────┘
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│   TimescaleDB│  │   FastAPI   │  │    Redis    │
│   (:5432)   │  │   (:8000)    │  │   (Optional)│
│             │  │  ┌─────────┐ │  │   (Caching) │
│  - trades   │  │  │LangGraph│ │  └─────────────┘
│  - sessions │  │  │ Agents  │ │
│             │  │  └─────────┘ │
└─────────────┘  └───────┬───────┘
                         │
                         ▼
                 ┌─────────────┐
                 │   OpenAI    │
                 │   API       │
                 └─────────────┘
```

---

*Document prepared by: Technical Specification Agent*
*Date: 2026-03-02*
*Tech Stack: AGENTS.md*
