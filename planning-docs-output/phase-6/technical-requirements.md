# Aurelius Ledger - Functional and Non-Functional Requirements

## Project Goal

The Aurelius Ledger is a lightweight web application for logging futures trades during live trading sessions. The system shall enable frictionless natural-language trade entry with AI-powered extraction, real-time behavioral scoring, and session-level insights, all within a 3-second end-to-end SLA.

---

## 1. Trade Entry Workflow

### FR 1.0 Natural Language Trade Entry

The system **SHALL** provide a persistent text input field at the bottom of the dashboard that accepts free-form natural language descriptions of completed trades.

- **FR 1.1** The system **SHALL** accept natural language input without requiring a specific format or structure.

  #### Technical Implementation
  - **Component:** `src/components/trade-entry/TradeInput.tsx`
  - Uses uncontrolled input with `useRef` for minimal re-renders
  - Debounced submission (150ms) to prevent accidental double-submits
  - **API:** `POST /api/trades` - Accepts raw text, returns extracted trade
  - **Validation:** Raw string input, max 1000 characters
  - **Security:** Input sanitization against prompt injection (see NFR 8.1)

- **FR 1.2** The system **SHALL** auto-populate the timestamp submission.

  #### at the moment of Technical Implementation
  - Server-side timestamp generation using `NOW()` at database level
  - Fallback: Client-side `new Date().toISOString()` if server time unavailable
  - Timezone: UTC stored, displayed in local timezone via `Intl.DateTimeFormat`

- **FR 1.3** The system **SHALL** clear the input field upon successful submission.

  #### Technical Implementation
  - React state update: `setInputValue('')`
  - Reset form ref after successful submission callback
  - Focus management: Return focus to input after animation completes

- **FR 1.4** The system **SHALL** display a loading state during AI extraction processing.

  #### Technical Implementation
  - **Component:** `src/components/trade-entry/TradeInput.tsx` - Loading skeleton
  - Optimistic UI: Show "Processing..." spinner (lucide-react `Loader2` with spin)
  - Button state: `disabled` with `cursor-not-allowed` during processing
  - Timeout: Show retry option if extraction exceeds 5 seconds

- **FR 1.5** The system **SHALL** display an error message if extraction fails after maximum retries.

  #### Technical Implementation
  - **Error Message:** "Could not extract trade details. Please provide more detail (e.g., 'Long AAPL, +$250, waited for pullback')."
  - **Component:** Inline error banner with `sonner` toast notification
  - **Log:** Failed extraction attempts logged to console with input text, error type, retry count

### FR 2.0 Trade Data Extraction

The system **SHALL** parse natural language trade descriptions using an AI extraction agent and extract the following structured fields:

| Field | Type | Description |
|-------|------|-------------|
| `direction` | `long` \| `short` | Trade direction (required) |
| `outcome` | `win` \| `loss` \| `breakeven` | Trade outcome (required) |
| `pnl` | Decimal | Dollar P&L (required, nullable for ambiguous cases) |
| `timestamp` | Timestamp | Auto-populated at submission |
| `setup_description` | String | Natural language summary of the setup |
| `discipline_score` | `-1` \| `0` \| `1` | Discipline indicator |
| `agency_score` | `-1` \| `0` \| `1` | Agency indicator |

- **FR 2.1** The extraction prompt **SHALL** include a structured system prompt with role definition, output schema, extraction rules, and few-shot examples.

  #### Technical Implementation
  - **File:** `src/lib/ai/prompts/trade-extraction.ts`
  - **System Prompt Structure:**
    ```typescript
    const SYSTEM_PROMPT = `You are a trading trade extractor. Analyze natural language trade descriptions and extract structured data.

    OUTPUT SCHEMA:
    {
      direction: "long" | "short",
      outcome: "win" | "loss" | "breakeven",
      pnl: number | null,
      setup_description: string,
      discipline_score: -1 | 0 | 1,
      agency_score: -1 | 0 | 1,
      confidence: { direction: number, outcome: number, pnl: number, discipline: number, agency: number }
    }

    EXTRACTION RULES:
    [See FR 2.3-2.4 for synonym clusters and tiered inference]

    FEW-SHOT EXAMPLES:
    [See FR 2.2]`
    ```

- **FR 2.2** The system **SHALL** include 4 few-shot examples covering: (1) explicit dollar P&L, (2) ambiguous P&L ("small winner"), (3) clear discipline indicators, (4) reactive/impulsive language.

  #### Technical Implementation
  - **File:** `src/lib/ai/prompts/few-shot-examples.ts`
  - **Example 1 (Explicit P&L):**
    ```
    Input: "Long NQ, +$450, waited for retest of overnight high before entering"
    Output: { direction: "long", outcome: "win", pnl: 450, discipline_score: 1, agency_score: 1, confidence: { direction: 1.0, outcome: 1.0, pnl: 1.0, discipline: 0.9, agency: 0.9 } }
    ```
  - **Example 2 (Ambiguous P&L):**
    ```
    Input: "Short ES, small winner, followed my plan on the fade"
    Output: { direction: "short", outcome: "win", pnl: null, discipline_score: 1, agency_score: 1, confidence: { direction: 0.95, outcome: 0.8, pnl: 0.2, discipline: 0.9, agency: 0.9 } }
    ```
  - **Example 3 (Discipline):**
    ```
    Input: "Long CL, held through the pullback, respected my stop at $72.50"
    Output: { direction: "long", outcome: "loss", pnl: -150, discipline_score: 1, agency_score: 1, confidence: { direction: 1.0, outcome: 1.0, pnl0, discipline:: 1. 0.95, agency: 0.85 } }
    ```
  - **Example 4 (Reactive):**
    ```
    Input: "Chased ES higher, fomo'd in, got stopped out quickly"
    Output: { direction: "long", outcome: "loss", pnl: -200, discipline_score: -1, agency_score: -1, confidence: { direction: 0.9, outcome: 1.0, pnl: 0.95, discipline: 0.95, agency: 0.9 } }
    ```

- **FR 2.3** The system **SHALL** use synonym clusters in the prompt to map equivalent expressions (e.g., "chased," "fomo'd in," "got greedy") to canonical keywords for consistent scoring.

  #### Technical Implementation
  - **File:** `src/lib/ai/prompts/synonym-clusters.ts`
  - **Discipline Positive Cluster:**
    ```
    patience: ["waited for", "waited until", "patient", "took my time"]
    confirmation: ["held for confirmation", "waited for confirmation", "confirmed"]
    plan: ["followed my plan", "stuck to my plan", "as planned"]
    stop_respect: ["respected my stop", "honored my stop", "stop held"]
    scaling: ["scaled in", "added on pullback", "pyramided"]
    ```
  - **Discipline Negative Cluster:**
    ```
    chasing: ["chased", "chasing", "chased in", "ran after"]
    fomo: ["fomo'd", "fomo", "fear of missing out", "couldn't resist"]
    revenge: ["revenge trade", "revenge", "got back at it", "had to make it back"]
    doubling: ["doubled up", "doubled", "increased size", "bigger position"]
    jumping: ["jumped in", "jumped", "quick entry", "rushed in"]
    ```
  - **Agency Positive Cluster:**
    ```
    proactive: ["decided to", "chose to", "my decision", "per my plan", "intentionally"]
    ```
  - **Agency Negative Cluster:**
    ```
    blame: ["market made me", "couldn't help it", "happened to be", "unfair", "market stopped me out"]
    ```

- **FR 2.4** The system **SHALL** implement tiered inference for ambiguous P&L:
  - Tier 1 (explicit): Extract exact dollar amount
  - Tier 2 (relative): Set `pnl: null`, infer outcome if possible
  - Tier 3 (implied): Set `pnl: null`, infer outcome from context
  - Tier 4 (complete ambiguity): Return error requiring clarification

  #### Technical Implementation
  - **File:** `src/lib/ai/extraction/tiered-inference.ts`
  - **Regex Patterns for Tier Detection:**
    ```typescript
    const TIER_PATTERNS = {
      tier1: /\$[\d,]+(?:\.\d{2})?/g,  // Explicit: $450, $1,234.56
      tier2: /\b(small|small|large|big|medium|moderate)\s*(winner|loser|profit|loss)\b/i,
      tier3: /\b(won|lost|won profit|took loss|made|made money|lost money)\b/i,
      tier4: /\b(some|amount|trade)\b/i
    }
    ```
  - **Response includes tier_used field for debugging**

- **FR 2.5** The system **SHALL** implement a two-phase extraction pipeline with validation: (1) extraction phase, (2) validation phase with schema checking and retry logic. This pattern **SHALL** be implemented using a node similar-based validation architecture to LangGraph, with explicit validation nodes rather than using the LangGraph library directly.

  #### Technical Implementation
  - **File:** `src/lib/ai/extraction/pipeline.ts`
  - **Pipeline Architecture:**
    ```typescript
    // Node-based validation architecture (LangGraph-style, no LangGraph dependency)
    interface PipelineNode {
      name: string
      execute(input: PipelineInput): Promise<PipelineOutput>
      validate(output: PipelineOutput): ValidationResult
    }

    const extractionPipeline: PipelineNode[] = [
      { name: 'extract', execute: extractTrade, validate: () => ({ valid: true }) },
      { name: 'validate_schema', execute: identity, validate: validateSchema },
      { name: 'validate_semantic', execute: validateSemantic, validate: () => ({ valid: true }) }
    ]

    async function runPipeline(input: string): Promise<ExtractedTrade> {
      let result: ExtractedTrade
      for (const node of extractionPipeline) {
        result = await node.execute(input)
        const validation = node.validate(result)
        if (!validation.valid) {
          throw new ValidationError(validation.errors)
        }
      }
      return result
    }
    ```

- **FR 2.6** The system **SHALL** validate extracted JSON against the schema before database write.

  #### Technical Implementation
  - **File:** `src/lib/schemas/trade.ts`
  - **Zod Schema:**
    ```typescript
    import { z } from 'zod'

    export const ExtractedTradeSchema = z.object({
      direction: z.enum(['long', 'short']),
      outcome: z.enum(['win', 'loss', 'breakeven']),
      pnl: z.number().nullable(),
      setup_description: z.string().optional(),
      discipline_score: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
      agency_score: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
      confidence: z.object({
        direction: z.number().min(0).max(1),
        outcome: z.number().min(0).max(1),
        pnl: z.number().min(0).max(1),
        discipline: z.number().min(0).max(1),
        agency: z.number().min(0).max(1)
      }).optional()
    })

    export type ExtractedTrade = z.infer<typeof ExtractedTradeSchema>
    ```

- **FR 2.7** The system **SHALL** retry extraction up to 2 times (3 total attempts) on schema validation failure.

  #### Technical Implementation
  - **File:** `src/lib/ai/extraction/retry-handler.ts`
  - **Retry Logic:**
    ```typescript
    const MAX_RETRIES = 2
    const RETRY_DELAY_MS = 500

    async function extractWithRetry(input: string): Promise<ExtractedTrade> {
      let lastError: Error | null = null

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const result = await runExtractionPipeline(input)
          validateSchema(result) // Throws if invalid
          return result
        } catch (error) {
          lastError = error as Error
          if (attempt < MAX_RETRIES) {
            await delay(RETRY_DELAY_MS * (attempt + 1)) // Exponential backoff
          }
        }
      }

      throw new ExtractionError(`Failed after ${MAX_RETRIES + 1} attempts`, lastError)
    }
    ```

- **FR 2.8** After exhausted retries, the system **SHALL** display a user-friendly error with example format: "Could not extract trade details. Please provide more detail (e.g., 'Long AAPL, +$250, waited for pullback')."

  #### Technical Implementation
  - **Error Display:** `sonner.error()` with action button "Clear & Retry"
  - **Component:** `src/components/trade-entry/ExtractionError.tsx`
  - **Fallback:** User can manually enter trade via fallback form

- **FR 2.9** The system **SHALL** return a confidence score with extraction results. The confidence score **SHALL** be calculated as a weighted average of per-field confidence values, where each field receives a confidence value between 0.0 and 1.0 based on:
  - Field presence (1.0 if present, 0.0 if null/undefined)
  - LLM self-assessed confidence for the field extraction
  - Explicit signal strength in the input text (strong keywords = higher confidence)

  #### Technical Implementation
  - **Confidence Calculation:**
    ```typescript
    function calculateOverallConfidence(confidence: PerFieldConfidence): number {
      const weights = { direction: 0.2, outcome: 0.2, pnl: 0.2, discipline: 0.2, agency: 0.2 }

      const weightedSum =
        confidence.direction * weights.direction +
        confidence.outcome * weights.outcome +
        confidence.pnl * weights.pnl +
        confidence.discipline * weights.discipline +
        confidence.agency * weights.agency

      return Math.round(weightedSum * 100) / 100
    }

    // Signal strength boosting (see FR 2.3 synonym clusters)
    function boostConfidenceFromSignals(text: string, field: string): number {
      const signalStrength = detectStrongSignals(text, field) // Returns 0-0.2 boost
      return Math.min(1.0, baseConfidence + signalStrength)
    }
    ```

- **FR 2.10** When overall confidence is below 70%, or any individual field confidence is below 50%, the system **SHALL** display the trade with a "Review scores" option allowing manual correction.

  #### Technical Implementation
  - **Component:** `src/components/trade-entry/TradeReview.tsx`
  - **Review Threshold:** `overallConfidence < 0.70 || anyFieldConfidence < 0.50`
  - **UI:** Modal with editable fields, pre-filled with extracted values
  - **API:** `PATCH /api/trades/:id` for corrections

- **FR 2.11** The system **SHALL** implement LLM API fallback: when the primary model (Haiku) fails due to API unavailability, the system **SHALL** automatically retry with Sonnet model. If both fail, the system **SHALL** queue the trade for later extraction and display: "Trade saved. AI analysis will complete shortly. You can manually edit scores if needed."

  #### Technical Implementation
  - **File:** `src/lib/ai/extraction/model-fallback.ts`
  - **Fallback Chain:**
    ```typescript
    const MODELS = ['haiku-4.5-2025-01-20', 'sonnet-4.5-2025-01-20'] as const

    async function extractWithFallback(input: string): Promise<ExtractedTrade> {
      let lastError: Error | null = null

      for (const model of MODELS) {
        try {
          return await extractWithModel(input, model)
        } catch (error) {
          lastError = error as Error
          if (!isApiError(error)) throw error // Non-retryable error
          // Continue to next model
        }
      }

      // Both failed - queue for later
      await queueTradeForExtraction(input)
      throw new QueuedExtractionError()
    }
    ```
  - **Queue:** Store raw input in `pending_extractions` table for retry job

---

## 2. Behavioral Scoring

### FR 3.0 Discipline Score Assignment

The system **SHALL** assign discipline scores based on language patterns indicating adherence to or deviation from the trading plan.

- **FR 3.1** The system **SHALL** assign `discipline_score: 1` for language indicating patience and intentional execution (e.g., "waited for," "held for confirmation," "followed my plan," "respected stop", "scaled in").

  #### Technical Implementation
  - **Synonym Cluster:** See FR 2.3 Technical Implementation
  - **Scoring Logic:** `src/lib/ai/scoring/discipline-scorer.ts`
  - **Pattern Matching:**
    ```typescript
    const DISCIPLINE_POSITIVE_PATTERNS = [
      /\b(waited for|waited until|patient|taken my time)\b/i,
      /\b(held for confirmation|waited for confirmation|confirmed entry)\b/i,
      /\b(followed my plan|stuck to my plan|as planned)\b/i,
      /\b(respected my stop|honored my stop|stop held)\b/i,
      /\b(scaled in|added on pullback|pyramided)\b/i
    ]
    ```

- **FR 3.2** The system **SHALL** assign `discipline_score: -1` for language indicating reactive or impulsive execution (e.g., "chased," "fomo'd in," "revenge trade," "doubled up," "jumped in").

  #### Technical Implementation
  - **Synonym Cluster:** See FR 2.3 Technical Implementation
  - **Pattern Matching:**
    ```typescript
    const DISCIPLINE_NEGATIVE_PATTERNS = [
      /\b(chased|chasing|chased in|ran after)\b/i,
      /\b(fomo'd|fomo|fear of missing out|couldn't resist)\b/i,
      /\b(revenge trade|revenge|got back at it|had to make it back)\b/i,
      /\b(doubled up|doubled|increased size|bigger position)\b/i,
      /\b(jumped in|jumped|quick entry|rushed in)\b/i
    ]
    ```

- **FR 3.3** The system **SHALL** assign `discipline_score: 0` when signals are absent, ambiguous, or neutral.

  #### Technical Implementation
  - Default score when neither positive nor negative patterns match
  - Confidence set to 0.3 (low) when defaulting to 0

### FR 4.0 Agency Score Assignment

The system **SHALL** assign agency scores based on language patterns indicating intentional versus reactive decision-making.

- **FR 4.1** The system **SHALL** assign `agency_score: 1` for language indicating proactive decision-making (e.g., "decided to," "chose to," "my decision," "per my plan").

  #### Technical Implementation
  - **Pattern Matching:**
    ```typescript
    const AGENCY_POSITIVE_PATTERNS = [
      /\b(decide[dt] to|chose to|my decision|per my plan|intentionally)\b/i
    ]
    ```

- **FR 4.2** The system **SHALL** assign `agency_score: -1** for language indicating external blame or passive framing (e.g., "market made me," "couldn't help it," "happened to be"). The phrase "got stopped" **SHALL NOT** trigger a negative agency score in isolation, as stopping out is a normal mechanical aspect of trading. Only "got stopped" accompanied by blame language (e.g., "got stopped unfairly," "market stopped me out") **SHALL** trigger a negative score.

  #### Technical Implementation
  - **Special Handling:**
    ```typescript
    const AGENCY_NEGATIVE_PATTERNS = [
      /\b(market made me|couldn't help it|happened to be)\b/i,
      /\b(got stopped\s+(unfairly|out|by market))\b/i  // Only with blame context
    ]
    // "got stopped" alone does NOT trigger negative score
    ```

- **FR 4.3** The system **SHALL** assign `agency_score: 0` when signals are absent, ambiguous, or neutral.

  #### Technical Implementation
  - Default score when neither positive nor negative patterns match
  - Confidence set to 0.3 (low) when defaulting to 0

### FR 5.0 Composite Score Calculation

The system **SHALL** calculate composite scores for behavioral threshold detection.

- **FR 5.1** The system **SHALL** calculate a rolling 5-trade composite score: `Sum(discipline_scores[-5:]) + Sum(agency_scores[-5:])`. When fewer than 5 trades exist, the system **SHALL** compute the composite using all available trades (e.g., 3 trades = sum of 3 discipline + 3 agency scores).

  #### Technical Implementation
  - **Database Function:** `src/lib/db/composite-scores.ts`
  - **SQL:**
    ```sql
    SELECT
      COALESCE(
        SUM(discipline_score) FILTER (ORDER BY timestamp DESC LIMIT 5),
        0
      ) + COALESCE(
        SUM(agency_score) FILTER (ORDER BY timestamp DESC LIMIT 5),
        0
      ) AS composite_score
    FROM trades
    WHERE trading_day_id = $1
    ```
  - **Pre-computed:** Stored in `trading_days.last_5_discipline_sum` and `trading_days.last_5_agency_sum`

- **FR 5.2** The system **SHALL** calculate trend direction by comparing the last 3 trades' average to the previous 3 trades' average with a threshold of 0.5. When fewer than 6 trades exist, the system **SHALL** display "Insufficient data" for trend direction.

  #### Technical Implementation
  - **Algorithm:**
    ```typescript
    function calculateTrend(scores: number[]): 'improving' | 'declining' | 'stable' | 'insufficient' {
      if (scores.length < 6) return 'insufficient'

      const recentAvg = average(scores.slice(0, 3))
      const previousAvg = average(scores.slice(3, 6))
      const diff = recentAvg - previousAvg

      if (diff > 0.5) return 'improving'
      if (diff < -0.5) return 'declining'
      return 'stable'
    }
    ```

- **FR 5.3** The system **SHALL** classify trend as "improving" when short-term avg exceeds medium-term avg by more than 0.5, "declining" when the reverse is true, and "stable" otherwise.

  #### Technical Implementation
  - See FR 5.2 algorithm
  - **UI Indicators:** Arrow icons (lucide-react `TrendingUp`, `TrendingDown`, `Minus`)

---

## 3. Data Model

### FR 6.0 Trades Table

The system **SHALL** store trade records in a `trades` table with the following schema:

```sql
CREATE TABLE trades (
  id TEXT PRIMARY KEY,
  direction TEXT NOT NULL CHECK (direction IN ('long', 'short')),
  outcome TEXT NOT NULL CHECK (outcome IN ('win', 'loss', 'breakeven')),
  pnl DECIMAL(12,2),  -- Nullable for ambiguous P&L
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  setup_description TEXT,
  discipline_score INTEGER NOT NULL CHECK (discipline_score IN (-1, 0, 1)),
  agency_score INTEGER NOT NULL CHECK (agency_score IN (-1, 0, 1)),
  trading_day_id TEXT NOT NULL REFERENCES trading_days(id),
  confidence_discipline TEXT NOT NULL CHECK (confidence_discipline IN ('high', 'medium', 'low')),
  confidence_agency TEXT NOT NULL CHECK (confidence_agency IN ('high', 'medium', 'low')),
  is_outlier BOOLEAN NOT NULL DEFAULT FALSE,
  cumulative_pnl DECIMAL(14,2),  -- Pre-computed cumulative P&L at insert time
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

- **FR 6.1** The system **SHALL** create a composite index on `(trading_day_id, timestamp)` for efficient time-series queries.

  #### Technical Implementation
  - **Drizzle Index:** `src/db/schema/trades.ts`
  ```typescript
  export const trades = pgTable('trades', {
    // ... columns
  })

  export const tradesTradingDayIdTimestampIdx = index('trades_trading_day_id_timestamp_idx')
    .on(trades.tradingDayId, trades.timestamp)
  ```

- **FR 6.2** The system **SHALL** also create single-column indexes on `timestamp`, `discipline_score`, and `agency_score` for query flexibility.

  #### Technical Implementation
  ```typescript
  export const tradesTimestampIdx = index('trades_timestamp_idx').on(trades.timestamp)
  export const tradesDisciplineScoreIdx = index('trades_discipline_score_idx').on(trades.disciplineScore)
  export const tradesAgencyScoreIdx = index('trades_agency_score_idx').on(trades.agencyScore)
  ```

- **FR 6.3** The system **SHALL** compute `is_outlier` at insert time based on standard deviation from session average P&L. A trade is flagged as an outlier if its absolute P&L deviates more than 2 standard deviations from the session mean.

  #### Technical Implementation
  - **SQL Function:**
    ```sql
    CREATE OR REPLACE FUNCTION calculate_is_outlier(
      p_pnl DECIMAL,
      p_trading_day_id TEXT
    ) RETURNS BOOLEAN AS $$
    DECLARE
      v_mean DECIMAL;
      v_stddev DECIMAL;
    BEGIN
      SELECT AVG(pnl), STDDEV(pnl)
      INTO v_mean, v_stddev
      FROM trades
      WHERE trading_day_id = p_trading_day_id AND pnl IS NOT NULL;

      IF v_stddev IS NULL OR v_stddev = 0 THEN
        RETURN FALSE;
      END IF;

      RETURN ABS(p_pnl - v_mean) > (2 * v_stddev);
    END;
    $$ LANGUAGE plpgsql;
    ```

- **FR 6.4** The system **SHALL** compute `cumulative_pnl` at insert time as: `previous cumulative_pnl + new trade pnl`, enabling O(1) dashboard loads.

  #### Technical Implementation
  - **SQL:**
    ```sql
    INSERT INTO trades (..., cumulative_pnl)
    SELECT
      ...,
      COALESCE(
        (SELECT cumulative_pnl FROM trades WHERE trading_day_id = $trading_day_id ORDER BY timestamp DESC LIMIT 1),
        0
      ) + $pnl
    RETURNING cumulative_pnl;
    ```

- **FR 6.5** The system **SHALL** map confidence scores to categorical levels: 0.0-0.4 = 'low', 0.41-0.7 = 'medium', 0.71-1.0 = 'high'.

  #### Technical Implementation
  - **Mapping Function:**
    ```typescript
    function mapConfidenceToLevel(score: number): 'low' | 'medium' | 'high' {
      if (score <= 0.4) return 'low'
      if (score <= 0.7) return 'medium'
      return 'high'
    }
    ```

- **Full Drizzle Schema (FR 6.0):**

  #### Technical Implementation
  - **File:** `src/db/schema/trades.ts`
  ```typescript
  import { pgTable, text, timestamp, decimal, boolean, integer, index } from 'drizzle-orm/pg-core'
  import { tradingDays } from './trading-days'

  export const trades = pgTable('trades', {
    id: text('id').primaryKey(),
    direction: text('direction').notNull(),
    outcome: text('outcome').notNull(),
    pnl: decimal('pnl', { precision: 12, scale: 2 }),
    timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
    setupDescription: text('setup_description'),
    disciplineScore: integer('discipline_score').notNull(),
    agencyScore: integer('agency_score').notNull(),
    tradingDayId: text('trading_day_id').notNull().references(() => tradingDays.id),
    confidenceDiscipline: text('confidence_discipline').notNull(),
    confidenceAgency: text('confidence_agency').notNull(),
    isOutlier: boolean('is_outlier').notNull().default(false),
    cumulativePnl: decimal('cumulative_pnl', { precision: 14, scale: 2 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  })

  // Indexes
  export const tradesTradingDayIdTimestampIdx = index('trades_trading_day_id_timestamp_idx')
    .on(trades.tradingDayId, trades.timestamp)
  export const tradesTimestampIdx = index('trades_timestamp_idx').on(trades.timestamp)
  export const tradesDisciplineScoreIdx = index('trades_discipline_score_idx').on(trades.disciplineScore)
  export const tradesAgencyScoreIdx = index('trades_agency_score_idx').on(trades.agencyScore)
  ```

### FR 7.0 Trading Days Table

The system **SHALL** maintain a `trading_days` table with pre-computed aggregates updated after each trade insertion:

```sql
CREATE TABLE trading_days (
  id TEXT PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  total_pnl DECIMAL(14,2) NOT NULL DEFAULT 0,
  win_count INTEGER NOT NULL DEFAULT 0,
  loss_count INTEGER NOT NULL DEFAULT 0,
  breakeven_count INTEGER NOT NULL DEFAULT 0,
  trade_count INTEGER NOT NULL DEFAULT 0,
  net_discipline_score INTEGER NOT NULL DEFAULT 0,
  net_agency_score INTEGER NOT NULL DEFAULT 0,
  last_5_discipline_sum INTEGER NOT NULL DEFAULT 0,
  last_5_agency_sum INTEGER NOT NULL DEFAULT 0,
  session_high_pnl DECIMAL(14,2) NOT NULL DEFAULT 0,
  session_low_pnl DECIMAL(14,2) NOT NULL DEFAULT 0,
  consecutive_wins INTEGER NOT NULL DEFAULT 0,
  consecutive_losses INTEGER NOT NULL DEFAULT 0,
  avg_win DECIMAL(14,2),
  avg_loss DECIMAL(14,2),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

- **FR 7.1** The system **SHALL** create a new `trading_days` record automatically when the first trade of a calendar day is logged.

  #### Technical Implementation
  - **SQL Function:**
    ```sql
    CREATE OR REPLACE FUNCTION ensure_trading_day()
    RETURNS TRIGGER AS $$
    BEGIN
      INSERT INTO trading_days (id, date)
      VALUES (gen_random_uuid()::TEXT, CURRENT_DATE)
      ON CONFLICT (date) DO NOTHING;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER trigger_ensure_trading_day
    BEFORE INSERT ON trades
    FOR EACH ROW
    EXECUTE FUNCTION ensure_trading_day();
    ```

- **FR 7.2** The system **SHALL** update all aggregates in the same database transaction as the trade insert.

  #### Technical Implementation
  - **Transaction:**
    ```typescript
    // src/lib/db/trade-operations.ts
    async function insertTradeWithAggregates(trade: InsertTrade): Promise<Trade> {
      return db.transaction(async (tx) => {
        // Get or create trading day
        const tradingDay = await tx
          .insert(tradingDays)
          .values({ date: new Date().toISOString().split('T')[0] })
          .onConflictDoNothing()
          .returning()

        // Insert trade
        const [newTrade] = await tx.insert(trades).values(trade).returning()

        // Update aggregates
        await updateTradingDayAggregates(tx, tradingDay.id)

        return newTrade
      })
    }
    ```

- **FR 7.3** The system **SHALL** update rolling window columns (last_5 discipline and agency sums) at trade insert time. The rolling window **SHALL** represent the last 5 trades of the current session (not day-level), aligned with FR 5.1 session-based computation.

  #### Technical Implementation
  - **SQL Update:**
    ```sql
    UPDATE trading_days td
    SET
      last_5_discipline_sum = (
        SELECT COALESCE(SUM(discipline_score), 0)
        FROM (
          SELECT discipline_score
          FROM trades
          WHERE trading_day_id = td.id
          ORDER BY timestamp DESC
          LIMIT 5
        ) recent
      ),
      last_5_agency_sum = (
        SELECT COALESCE(SUM(agency_score), 0)
        FROM (
          SELECT agency_score
          FROM trades
          WHERE trading_day_id = td.id
          ORDER BY timestamp DESC
          LIMIT 5
        ) recent
      )
    WHERE td.id = $tradingDayId;
    ```

- **Full Drizzle Schema (FR 7.0):**

  #### Technical Implementation
  - **File:** `src/db/schema/trading-days.ts`
  ```typescript
  import { pgTable, text, date, decimal, integer, timestamp, index } from 'drizzle-orm/pg-core'

  export const tradingDays = pgTable('trading_days', {
    id: text('id').primaryKey(),
    date: date('date').notNull().unique(),
    totalPnl: decimal('total_pnl', { precision: 14, scale: 2 }).notNull().default('0'),
    winCount: integer('win_count').notNull().default(0),
    lossCount: integer('loss_count').notNull().default(0),
    breakevenCount: integer('breakeven_count').notNull().default(0),
    tradeCount: integer('trade_count').notNull().default(0),
    netDisciplineScore: integer('net_discipline_score').notNull().default(0),
    netAgencyScore: integer('net_agency_score').notNull().default(0),
    last5DisciplineSum: integer('last_5_discipline_sum').notNull().default(0),
    last5AgencySum: integer('last_5_agency_sum').notNull().default(0),
    sessionHighPnl: decimal('session_high_pnl', { precision: 14, scale: 2 }).notNull().default('0'),
    sessionLowPnl: decimal('session_low_pnl', { precision: 14, scale: 2 }).notNull().default('0'),
    consecutiveWins: integer('consecutive_wins').notNull().default(0),
    consecutiveLosses: integer('consecutive_losses').notNull().default(0),
    avgWin: decimal('avg_win', { precision: 14, scale: 2 }),
    avgLoss: decimal('avg_loss', { precision: 14, scale: 2 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  })

  export const tradingDaysDateIdx = index('trading_days_date_idx').on(tradingDays.date)
  ```

---

## 4. Dashboard Components

### FR 8.0 Dashboard Layout

The system **SHALL** display the dashboard with the following visual hierarchy:

```
+------------------------------------------------------------------+
|  HEADER BAR: Session Time | Total P&L | Win Count | Net Discipline|
+------------------------------------------+-------------------------+
|                                          |                         |
|        P&L TIME SERIES CHART             |    AI INSIGHTS PANEL   |
|        (Area chart with gradient)        |    (Latest Analysis)   |
|                                          |                         |
+--------------------+---------------------+-------------------------+
|   DISCIPLINE       |     AGENCY          |                         |
|   SCORE CHART      |     SCORE CHART     |                         |
|   (Line + markers) |     (Line + markers)|                         |
+--------------------+---------------------+-------------------------+
|                    TRADE ENTRY INPUT                              |
|    [Natural language trade description input field]              |
+------------------------------------------------------------------+
```

- **FR 8.1** The header **SHALL** display: session duration, total P&L (green for positive, red for negative), win count (not ratio - see FR 13.8), and net discipline score with color coding.

  #### Technical Implementation
  - **Component:** `src/components/dashboard/HeaderBar.tsx`
  - **Data Source:** `trading_days` table (pre-computed aggregates)
  - **Color Logic:**
    ```typescript
    const pnlColor = totalPnl >= 0 ? 'text-green-500' : 'text-red-500'
    const disciplineColor = getDisciplineColor(netDisciplineScore) // See FR 15.x
    ```

- **FR 8.2** The P&L time series chart **SHALL** occupy the largest visual area as the primary success metric.

  #### Technical Implementation
  - **Component:** `src/components/charts/PnLChart.tsx`
  - **Library:** Recharts (area chart)
  - **Dimensions:** `flex-1` (grow to fill available space)

- **FR 8.3** The discipline and agency score charts **SHALL** be displayed side-by-side below the P&L chart.

  #### Technical Implementation
  - **Container:** `src/components/dashboard/MetricsGrid.tsx`
  - **Layout:** CSS Grid with 2 equal columns

- **FR 8.4** The AI insights panel **SHALL** be positioned to the right of the P&L chart.

  #### Technical Implementation
  - **Layout:** Flexbox with `flex-row`, P&L chart `flex-1`, insights panel fixed width (320px)

- **FR 8.5** The trade entry input **SHALL** remain persistently accessible at the bottom of the viewport.

  #### Technical Implementation
  - **Component:** `src/components/trade-entry/TradeInput.tsx`
  - **Position:** Fixed at bottom, `bottom-0`, `w-full`
  - **Z-Index:** Above charts but below modals

### FR 9.0 P&L Time Series Chart

The system **SHALL** display cumulative P&L over the trading session.

- **FR 9.1** The chart **SHALL** use an area chart with gradient fill.

  #### Technical Implementation
  - **Library:** Recharts `<AreaChart>`
  - **Gradient Definition:**
    ```jsx
    <defs>
      <linearGradient id="pnlGradientPositive" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
        <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
      </linearGradient>
      <linearGradient id="pnlGradientNegative" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
      </linearGradient>
    </defs>
    ```

- **FR 9.2** The chart **SHALL** display cumulative P&L (running total), not individual trade P&L.

  #### Technical Implementation
  - **Data:** `trades.cumulative_pnl` (pre-computed)
  - **Query:** `SELECT cumulative_pnl, timestamp FROM trades ORDER BY timestamp`

- **FR 9.3** The X-axis **SHALL** represent trade sequence number.

  #### Technical Implementation
  - **Recharts:** `<XAxis dataKey="sequence" />`
  - **Data Transform:** Add `sequence` field (1, 2, 3, ...)

- **FR 9.4** The Y-axis **SHALL** represent cumulative dollar P&L.

  #### Technical Implementation
  - **Recharts:** `<YAxis tickFormatter={(v) => `$${v}`} />`

- **FR 9.5** The chart **SHALL** display a prominent zero reference line (dashed, slate-400 at 50% opacity).

  #### Technical Implementation
  - **Reference Line:**
    ```jsx
    <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" strokeOpacity={0.5} />
    ```

- **FR 9.6** The chart **SHALL** use green gradient fill above zero and red gradient fill below zero.

  - **FR 9.7** Trade markers **SHALL** be color-coded: green dot for win, red dot for loss, gray for breakeven.

  #### Technical Implementation
  - **Custom Dot:**
    ```jsx
    <Area
      type="monotone"
      dataKey="cumulativePnl"
      strokeWidth={2}
      fill={(props: any) => {
        const { cy, payload } = props
        const color = payload.pnl >= 0 ? '#22c55e' : payload.pnl === 0 ? '#94a3b8' : '#ef4444'
        return <circle cx={props.cx} cy={cy} r={4} fill={color} />
      }}
    />
    ```

- **FR 9.8** Hover tooltips **SHALL** show individual trade P&L contribution.

  #### Technical Implementation
  - **Tooltip:**
    ```jsx
    <Tooltip
      formatter={(value, name, props) => [
        `Cumulative: $${value}`,
        `Trade P&L: $${props.payload.pnl} (${props.payload.outcome})`
      ]}
    />
    ```

- **FR 9.9** Chart animations **SHALL** complete within 300ms when new data points are added.

  #### Technical Implementation
  - **Animation:** `animationDuration={300}`
  - **Easing:** `animationEasing="ease-out"`

### FR 10.0 Discipline Score Chart

The system **SHALL** display the running sum of discipline scores over the session.

- **FR 10.1** The chart **SHALL** use a line chart with markers.

  #### Technical Implementation
  - **Component:** `src/components/charts/DisciplineChart.tsx`
  - **Library:** Recharts `<LineChart>`

- **FR 10.2** The X-axis **SHALL** match the P&L chart trade sequence.

  - **FR 10.3** The Y-axis **SHALL** display the running sum of discipline scores.

  - **FR 10.4** The line color **SHALL** be green (#10b981) for positive trajectory, amber (#f59e0b) for flat, and rose (#f43f5e) for negative trajectory.

  #### Technical Implementation
  - **Dynamic Color Calculation:**
    ```typescript
    const getLineColor = (scores: number[]) => {
      if (scores.length < 2) return '#10b981'
      const last = scores[scores.length - 1]
      const previous = scores[scores.length - 2]
      if (last > previous) return '#10b981'  // green
      if (last < previous) return '#f43f5e'  // rose
      return '#f59e0b'  // amber
    }
    ```

- **FR 10.5** A zero reference line **SHALL** be displayed as a subtle dashed line.

  - **FR 10.6** The chart **SHALL** display individual trade scores as markers with a connected line showing the cumulative trajectory. Bar overlays **MAY** be used to show discrete trade-level scores if desired.

  #### Technical Implementation
  - **Markers:** `<Line type="monotone" dataKey="cumulativeScore" dot={{ r: 4 }} />`
  - **Reference Line:** `<ReferenceLine y={0} stroke="#64748b" strokeDasharray="3 3" strokeOpacity={0.3} />`

### FR 11.0 Agency Score Chart

The system **SHALL** display the running sum of agency scores over the session, mirroring the discipline chart format.

- **FR 11.1** The agency score chart **SHALL** follow all specifications from FR 10.0 with agency-specific data.

  #### Technical Implementation
  - **Component:** `src/components/charts/AgencyChart.tsx`
  - Reuses discipline chart logic with agency data

- **FR 11.2** The chart **SHALL** be positioned adjacent to the discipline chart for correlation assessment.

  - See FR 8.3

---

## 5. AI Insights Panel

### FR 12.0 Insights Generation

The system **SHALL** generate behavioral insights after each trade is logged.

- **FR 12.1** The system **SHALL** feed the full session's trade data to a Trading Expert agent for insight generation.

  #### Technical Implementation
  - **File:** `src/lib/ai/insights/generator.ts`
  - **System Prompt:** `src/lib/ai/prompts/insights-system.md`

- **FR 12.2** The system **SHALL** pass both raw trade records (last 15 trades) AND aggregated session statistics to the insights agent as structured JSON data.

  #### Technical Implementation
  - **Input Data Structure:**
    ```typescript
    interface InsightsInput {
      trades: TradeRecord[]  // Last 15, sorted by timestamp desc
      aggregates: {
        totalPnl: number
        winCount: number
        lossCount: number
        netDisciplineScore: number
        netAgencyScore: number
        sessionDuration: number  // minutes
      }
      trends: {
        disciplineTrajectory: 'improving' | 'declining' | 'stable' | 'insufficient'
        agencyTrajectory: 'improving' | 'declining' | 'stable' | 'insufficient'
        pnlTrajectory: 'improving' | 'declining' | 'stable' | 'insufficient'
      }
    }
    ```

- **FR 12.3** The system **SHALL** pre-compute and pass trend flags (disciplineTrajectory, agencyTrajectory, pnlTrajectory) to the insights agent.

  - See FR 5.2 algorithm for trend calculation

- **FR 12.4** Insights **SHALL** be generated asynchronously in the background after trade confirmation.

  #### Technical Implementation
  - **Pattern:** Fire-and-forget with `void generateInsights()`
  - **Queue:** Background task queue (in-memory for single-user Phase 1)

- **FR 12.5** The insights panel **SHALL** display a loading state ("Analyzing...") while insights are being generated.

  - **FR 12.6** Insights **SHALL** be returned as a complete block (not streamed).

  #### Technical Implementation
  - **Component:** `src/components/insights/InsightsPanel.tsx`
  - **State:** `insights: string | null`, `isLoading: boolean`
  - **UI:** Skeleton loader during generation

- **FR 12.7** When session data exceeds model context limits, the system **SHALL** use a sliding window (most recent trades) with aggregate history summary.

  #### Technical Implementation
  - **Max Trades:** 15 (within context limits)
  - **Summary Generation:**
    ```typescript
    const historySummary = {
      totalTradesBeforeWindow: trades.length - 15,
      cumulativePnlBeforeWindow: calculateCumulativePnl(trades.slice(0, -15)),
      disciplineTrendBeforeWindow: calculateTrend(trades.slice(0, -15).map(t => t.disciplineScore))
    }
    ```

- **FR 12.8** The system **SHALL** cache insights for 30 seconds to avoid unnecessary regeneration for unchanged session state.

  #### Technical Implementation
  - **Cache:** In-memory Map with TTL
  - **Key:** `insights:${tradingDayId}:${tradeCount}`
  - **TTL:** 30000ms
  - **Invalidation:** On new trade insertion

### FR 13.0 Insight Categories

The system **SHALL** prioritize and generate insights in the following order:

**Tier 1 - Immediate Behavioral Intervention:**

- **FR 13.1** The system **SHALL** provide a tilt risk indicator when composite score drops below -3 or when 2+ consecutive trades have negative scores.

  #### Technical Implementation
  - **Detection Logic:**
    ```typescript
    const isTiltRisk = compositeScore < -3 ||
      consecutiveNegativeTrades >= 2
    ```

- **FR 13.2** The tilt risk insight **SHALL** include a specific, actionable recommendation (e.g., "Consider taking a 5-minute break before your next entry").

  - **FR 13.3** The system **SHALL** detect revenge trading patterns when ANY of the following conditions are met:
  - Immediate re-entry within 5 minutes after a loss
  - Trade in opposite direction immediately after a loss
  - Increased position size on the trade immediately following a loss (detected via explicit mention or "doubled up" language)

  #### Technical Implementation
  - **Detection Logic:**
    ```typescript
    const isRevengeTrading = (
      (timeSinceLastLoss < 5 && lastTrade.outcome === 'loss') ||
      (lastTrade.outcome === 'loss' && currentTrade.direction !== lastTrade.direction) ||
      /doubled|increased size|bigger position/i.test(currentTradeText)
    )
    ```

**Tier 2 - Trend Awareness:**

- **FR 13.4** The system **SHALL** display discipline and agency trend direction (improving/declining/stable) using non-numerical visual indicators (arrows).

  - **FR 13.5** The system **SHALL** detect decision fatigue when session exceeds 90 minutes with more than 8 trades.

  #### Technical Implementation
  - **Detection:**
    ```typescript
    const isDecisionFatigue = sessionDurationMinutes > 90 && tradeCount > 8
    ```

**Tier 3 - Pattern Recognition (requires 5+ trades):**

- **FR 13.6** The system **SHALL** surface setup-outcome correlations when 5+ trades with identifiable setups exist.

  - **FR 13.7** The system **SHALL** display win/loss language pattern differences.

  - **FR 13.8** The system **SHALL NOT** display win/loss ratio in the AI insights panel during the session (to avoid anchoring and loss aversion). Win/loss count **MAY** be displayed in the header bar per FR 8.1, but ratio calculation **SHALL NOT** be shown mid-session in the insights panel.

  - **FR 13.9** The system **SHALL NOT** display generic motivational statements.

  #### Technical Implementation
  - **Prompt Engineering:** System prompt explicitly prohibits generic statements
  - **Validation:** Post-process insights to filter motivational quotes

### FR 14.0 Insight Types

The system **SHALL** differentiate between observation and recommendation insights.

- **FR 14.1** For minor behavioral signals, the system **SHALL** provide information-only insights (observations without recommendations).

  - **FR 14.2** For critical behavioral signals (tilt risk, revenge trading, decision fatigue), the system **SHALL** provide both observation AND actionable recommendation.

  - **FR 14.3** The system **SHALL** present observations before recommendations to respect trader autonomy.

  #### Technical Implementation
  - **Response Structure:**
    ```typescript
    interface Insight {
      type: 'observation' | 'recommendation'
      category: 'tilt' | 'revenge' | 'fatigue' | 'pattern' | 'trend'
      severity: 'critical' | 'moderate' | 'info'
      message: string
      action?: string  // Only for recommendations
    }
    ```

- **FR 14.4** The system **SHALL** limit behavioral insights to a maximum of 2 per 5-minute window to prevent alarm fatigue. Tier 1 (critical) insights **SHALL** always be displayed regardless of rate limit. Non-critical insights **SHALL** be subject to the rate limit, showing the most recent observations.

  #### Technical Implementation
  - **Rate Limiter:** `src/lib/insights/rate-limiter.ts`
  - **Logic:**
    ```typescript
    const INSIGHT_RATE_LIMIT = 2
    const RATE_LIMIT_WINDOW = 5 * 60 * 1000  // 5 minutes

    function shouldDisplayInsight(insight: Insight, recentInsights: Insight[]): boolean {
      if (insight.severity === 'critical') return true

      const recentNonCritical = recentInsights.filter(
        i => i.severity !== 'critical' &&
        Date.now() - i.timestamp < RATE_LIMIT_WINDOW
      )

      return recentNonCritical.length < INSIGHT_RATE_LIMIT
    }
    ```

### FR 15.0 Dashboard Score Display

The system **SHALL** display behavioral scores using qualitative labels, not raw numbers.

- **FR 15.1** Score range +2 or higher **SHALL** display as "Strong" with green up arrow.

  #### Technical Implementation
  - **Label Mapping:**
    ```typescript
    function getScoreLabel(score: number): { label: string, icon: Icon } {
      if (score >= 2) return { label: 'Strong', icon: TrendingUp }
      if (score >= -1) return { label: 'Neutral', icon: Minus }
      if (score >= -3) return { label: 'At Risk', icon: AlertTriangle }
      return { label: 'Critical', icon: AlertCircle }
    }
    ```

- **FR 15.2** Score range +1 to -1 **SHALL** display as "Neutral" with horizontal line.

- **FR 15.3** Score -2 to -3 **SHALL** display as "At Risk" with amber down arrow. (Changed from "Declining" to align with FR 13.1 tilt threshold of -3)

- **FR 15.4** Score -4 or lower **SHALL** display as "Critical" with red warning indicator.

  - **Color Mapping:**
    ```typescript
    const getScoreColor = (score: number) => {
      if (score >= 2) return 'text-green-500'
      if (score >= -1) return 'text-amber-500'
      if (score >= -3) return 'text-amber-500'
      return 'text-red-500'
    }
    ```

---

## 6. Real-Time Updates

### FR 16.0 Dashboard Refresh

The system **SHALL** update the dashboard in real-time after each trade is logged.

- **FR 16.1** The dashboard **SHALL** reflect the newly logged trade without requiring a page refresh.

  #### Technical Implementation
  - **State Management:** React Query (TanStack Query) with `invalidateQueries()` on mutation
  - **Component:** `src/components/providers/QueryProvider.tsx`

- **FR 16.2** Charts **SHALL** animate smoothly when new data points are added.

  - **FR 16.3** The system **SHALL** use optimistic UI updates - showing the trade immediately while processing.

  #### Technical Implementation
  - **Optimistic Update:**
    ```typescript
    const mutation = useMutation({
      mutationFn: submitTrade,
      onMutate: async (newTrade) => {
        // Cancel outgoing refetches
        await queryClient.cancelQueries({ queryKey: ['trades'] })

        // Snapshot previous value
        const previousTrades = queryClient.getQueryData(['trades'])

        // Optimistically update
        queryClient.setQueryData(['trades'], (old) => [...old, { ...newTrade, optimistic: true }])

        return { previousTrades }
      },
      onError: (err, newTrade, context) => {
        queryClient.setQueryData(['trades'], context.previousTrades)
      }
    })
    ```

- **FR 16.4** When new insights are available, the system **SHALL** update the insights panel automatically via polling or WebSocket.

  #### Technical Implementation
  - **Polling Strategy:** `useQuery` with `refetchInterval: 5000` for insights
  - **Phase 1:** Polling (simpler, sufficient for single-user)
  - **Future:** WebSocket upgrade when multi-user support added

---

## 7. Non-Functional Requirements

### NFR 1.0 Performance - End-to-End Latency

The system **SHALL** complete the trade entry to confirmed database write in under 3 seconds under normal conditions.

- **NFR 1.1** Trade entry to extraction completion **SHALL** complete in under 1.2 seconds under normal conditions. The 95th percentile **SHALL** be under 1.5 seconds, and the 99th percentile **SHALL** be under 3 seconds.

  #### Technical Implementation
  - **Monitoring:** Add latency tracking to extraction pipeline
  - **Metrics:** Histogram with p50, p95, p99 buckets

- **NFR 1.2** Database write **SHALL** complete in under 100 milliseconds.

- **NFR 1.3** Insights generation **SHALL** complete in under 2 seconds (asynchronous, non-blocking).

- **NFR 1.4** The perceived latency after trade submission **SHALL** be under 1 second (UI optimistic update).

  #### Technical Implementation
  - **Optimistic UI:** Immediate feedback before server confirmation
  - **Skeleton/Loading State:** User sees progress indicator

**Latency Budget Allocation:**

| Component | Target | Notes |
|-----------|--------|-------|
| Network latency | 200ms | Assume OpenAI API overhead |
| Extraction (Haiku) | 600ms | Fast model, structured output |
| Validation | 50ms | Local JSON schema check |
| DB write | 100ms | SQLite local, fast |
| Insights generation (Sonnet) | 1500ms | Background, not blocking |
| UI update | 50ms | React state update |
| **Total (blocking)** | **~1.0s** | Under 1.2s target |
| **Total (with insights)** | **~2.5s** | Still under 3s |

### NFR 2.0 Performance - Model Selection

The system **SHALL** use appropriate LLM models for each task to balance cost and quality.

- **NFR 2.1** The extraction agent **SHALL** use Haiku 4.5 by default. The system **SHALL** automatically fallback to Sonnet 4.5 when Haiku fails twice consecutively or returns confidence below 40%.

  - See FR 2.11 Technical Implementation

- **NFR 2.2** The insights agent **SHALL** use Sonnet 4.5 for synthesis and pattern recognition.

  #### Technical Implementation
  - **Model Configuration:** `src/lib/ai/models.ts`
  ```typescript
  export const EXTRACTION_MODEL = 'haiku-4.5-2025-01-20'
  export const INSIGHTS_MODEL = 'sonnet-4.5-2025-01-20'
  ```

### NFR 3.0 Reliability - Schema Conformance

The system **SHALL** ensure all extracted data conforms to the defined schema before database insertion.

- **NFR 3.1** The extraction agent **SHALL** return valid, schema-conformant JSON or surface a recoverable error.

- **NFR 3.2** The system **SHALL** perform schema validation before database write.

  - See FR 2.6 Technical Implementation

- **NFR 3.3** The system **SHALL NOT** perform silent partial writes - incomplete or invalid data must be rejected.

- **NFR 3.4** Failed extraction attempts **SHALL** be logged with input text, error type, retry count, and final output for analysis and prompt improvement.

  #### Technical Implementation
  - **Logging:** `src/lib/ai/logging/extraction-logger.ts`
  - **Log Schema:**
    ```typescript
    interface ExtractionLog {
      timestamp: Date
      input: string
      attempts: number
      errorType: string
      finalOutput: ExtractedTrade | null
    }
    ```

### NFR 4.0 Reliability - Error Handling

The system **SHALL** handle errors gracefully with user-friendly messaging.

- **NFR 4.1** Extraction failure after max retries **SHALL** display: "Could not extract trade details. Please provide more detail (e.g., 'Long AAPL, +$250, waited for pullback')."

- **NFR 4.2** Database write failure **SHALL** display a retry option with error details.

  #### Technical Implementation
  - **Component:** `src/components/error/RetryButton.tsx`
  - **UI:** sonner error toast with "Retry" action

- **NFR 4.3** Network failures **SHALL** display a connection error with retry option.

### NFR 5.0 Usability - Frictionless Workflow

The system **SHALL** minimize friction in the trade entry workflow.

- **NFR 5.1** The trader **SHALL** require no navigation or page changes to enter a trade.

- **NFR 5.2** The trader **SHALL** require no more than 2 seconds of attention to assess current session state from the dashboard.

- **NFR 5.3** The trader **SHALL** require no more than one click to enter a trade (type + submit).

- **NFR 5.4** The input field **SHALL** remain accessible at all viewport sizes.

  #### Technical Implementation
  - **Responsive Design:** Fixed bottom bar works on all screen sizes
  - **Mobile:** Full-width input with large touch target

### NFR 6.0 Usability - Visual Design

The system **SHALL** use a dark theme to reduce eye strain during long trading sessions.

- **NFR 6.1** The dashboard **SHALL** use a dark background (slate-950: #020617).

- **NFR 6.2** Positive values **SHALL** display in green (#22c55e).

- **NFR 6.3** Negative values **SHALL** display in red (#ef4444).

- **NFR 6.4** Neutral values **SHALL** display in amber (#f59e0b).

- **NFR 6.5** Primary text **SHALL** use high contrast (slate-50: #f8fafc).

- **NFR 6.6** Secondary text **SHALL** use subtle labels (slate-400: #94a3b8).

  #### Technical Implementation
  - **Tailwind Config:** `tailwind.config.ts`
  ```typescript
  colors: {
    background: '#020617',  // slate-950
    foreground: '#f8fafc',  // slate-50
    positive: '#22c55e',
    negative: '#ef4444',
    neutral: '#f59e0b',
    muted: '#94a3b8'        // slate-400
  }
  ```

### NFR 7.0 Usability - Empty States

The system **SHALL** provide appropriate empty state handling.

- **NFR 7.1** Empty charts **SHALL** display placeholder with "No trades yet" message.

  #### Technical Implementation
  - **Component:** `src/components/charts/EmptyChart.tsx`
  - **Message:** "No trades yet. Enter your first trade below."

- **NFR 7.2** Empty state **SHALL** display the input field prominently for first trade entry.

### NFR 8.0 Reliability - Prompt Security

The system **SHALL** protect against prompt injection attacks.

- **NFR 8.1** The system **SHALL** sanitize user input to remove or escape potential prompt injection attempts before passing to the LLM.

  #### Technical Implementation
  - **Sanitization:** `src/lib/ai/security/input-sanitizer.ts`
  ```typescript
  const INJECTION_PATTERNS = [
    /system:.*/i,
    /ignore.*previous.*instructions/i,
    /you are now/i,
    /\[SYSTEM\]/i,
    /```system/i
  ]

  function sanitizeInput(input: string): string {
    let sanitized = input
    for (const pattern of INJECTION_PATTERNS) {
      sanitized = sanitized.replace(pattern, '[REDACTED]')
    }
    return sanitized
  }
  ```

- **NFR 8.2** The system **SHALL** implement prompt versioning to track changes and enable A/B testing of extraction accuracy.

  #### Technical Implementation
  - **Version Tracking:** `src/lib/ai/prompts/versions.ts`
  ```typescript
  const PROMPT_VERSION = '1.0.0'
  const PROMPT_LAST_UPDATED = '2026-02-25'
  ```

### NFR 9.0 Autonomy Preservation

The system **SHALL** frame behavioral interventions as recommendations, not mandates.

- **NFR 9.1** All behavioral insights **SHALL** be framed as suggestions rather than mandates.

- **NFR 9.2** Traders **SHALL** have the ability to dismiss or snooze behavioral recommendations.

  #### Technical Implementation
  - **Component:** `src/components/insights/InsightCard.tsx`
  - **Actions:** "Dismiss" and "Snooze (15min)" buttons

- **NFR 9.3** The system **SHALL** preserve trader agency to override recommendations when they have context the system lacks.

---

## 8. Out of Scope for Phase 1

- Editing or deleting logged trades after submission
- Multi-day historical views, trend analysis across sessions, or calendar views
- Manual session start/end controls
- Trade tagging or session notes
- Broker API integration or actual trade data import
- P&L correlation with mental state data
- Mobile app or responsive mobile layout
- Export functionality
- User authentication and multi-user support
- Individual calibration of behavioral thresholds

---

## 9. Assumptions

- The trader enters one trade at a time after it closes - not mid-trade or speculatively
- P&L is always expressed in dollar terms in the trade description; the system does not handle points, ticks, or percentage-based P&L without a dollar equivalent
- The trader is the sole user; no authentication or multi-user data isolation is required in Phase 1
- A "trading day" maps to a calendar day in the user's local timezone
- The trader's natural language descriptions will contain enough signal for reliable extraction on the majority of entries; edge cases are acceptable with a graceful fallback to `0` scores
- The system assumes English language input for trade descriptions

---

## 10. Success Criteria Checklist

- [ ] Trade entry to confirmed database write completes in under 3 seconds
- [ ] Extraction accuracy is high enough that the trader rarely needs to manually correct a logged trade (target: <5% require review)
- [ ] Discipline and agency scores feel fair and consistent to the trader - not over-penalizing ambiguous descriptions
- [ ] AI insights feel relevant and specific to the session, not generic
- [ ] The UI stays out of the way during live trading - minimal clicks, no required navigation
- [ ] Dashboard updates in real-time without page refresh
- [ ] Tilt risk indicators trigger appropriately at composite score -3 or below
- [ ] Visual hierarchy allows 2-second session state assessment
- [ ] Rolling window aggregates are pre-computed for fast dashboard load times
- [ ] Win/loss ratio is not displayed mid-session in insights panel to avoid anchoring

---

## 11. Changes from Draft

This section summarizes key modifications made based on Phase 4 SME feedback.

### AI/NLP Architecture SME Changes

1. **FR 2.5 - LangGraph Clarification**: Changed from "LangGraph-style node architecture" to "node-based validation architecture similar to LangGraph, with explicit validation nodes rather than using the LangGraph library directly."

2. **FR 2.9 - Confidence Score Methodology**: Added detailed confidence score calculation methodology: weighted average of per-field confidence based on field presence, LLM self-assessment, and explicit signal strength.

3. **FR 2.11 - LLM API Fallback**: Added new requirement for automatic fallback from Haiku to Sonnet on API failure, with queue-and-retry strategy.

4. **FR 14.4 - Rate Limiting Resolution**: Changed to allow Tier 1 (critical) insights always display regardless of rate limit; only non-critical insights are subject to the 2-per-5-minute window.

5. **NFR 1.1 - Latency Adjustment**: Relaxed from 1s to 1.2s target with added 95th and 99th percentile SLA specifications.

6. **NFR 2.1 - Model Selection Criteria**: Added explicit criteria for when to fallback from Haiku to Sonnet (consecutive failures or confidence below 40%).

7. **NFR 8.0 - Prompt Security**: Added new section for input sanitization and prompt versioning.

### Behavioral Psychology SME Changes

1. **FR 8.1 - Win/Loss Display**: Changed from "win/loss count as ratio" to just "win count" to resolve conflict with FR 13.8. Ratio is explicitly prohibited in insights panel but count in header is acceptable.

2. **FR 4.2 - "Got Stopped" Fix**: Added clarification that "got stopped" in isolation shall NOT trigger negative agency score; only when accompanied by blame language.

3. **FR 15.3 - Score Display Threshold**: Changed "Declining" label to "At Risk" starting at -2 to align with FR 13.1 tilt threshold of -3 (display shows "At Risk" for -2 to -3 range).

4. **FR 15.4 - Score -4 Display**: Changed label from "At Risk" to "Critical" for -4 and below to create proper escalation.

5. **FR 13.3 - Size Escalation**: Added "increased position size" as a revenge trading indicator alongside existing conditions.

6. **NFR 9.0 - Autonomy Preservation**: Added new section ensuring behavioral interventions are framed as suggestions, preserving trader agency.

### Data Analytics SME Changes

1. **FR 5.1 - Rolling Window Clarification**: Added explicit behavior: "When fewer than 5 trades exist, the system SHALL compute the composite using all available trades."

2. **FR 5.2 - Trend with Fewer than 6 Trades**: Added explicit behavior: "When fewer than 6 trades exist, the system SHALL display 'Insufficient data' for trend direction."

3. **FR 6.0 - Schema Updates**:
   - Added `is_outlier BOOLEAN` column to trades table
   - Added `cumulative_pnl DECIMAL(14,2)` column for O(1) dashboard loads
   - Added CHECK constraints for confidence_discipline and confidence_agency

4. **FR 6.5 - Confidence Mapping**: Added new requirement mapping numerical scores to categorical levels: 0.0-0.4 = 'low', 0.41-0.7 = 'medium', 0.71-1.0 = 'high'.

5. **FR 7.3 - Rolling Window Scope**: Clarified that rolling windows in trading_days represent session trades (last 5 of current session), aligned with FR 5.1.

6. **FR 7.0 - Extended Schema**: Added session_high_pnl, session_low_pnl, consecutive_wins, consecutive_losses, avg_win, avg_loss columns to trading_days table.

7. **FR 9.9 - Animation Duration**: Added 300ms animation duration specification.

8. **FR 10.6 - Combo Chart Clarification**: Simplified to show line with markers, with bar overlays as optional.

9. **FR 12.7 - Context Window Management**: Added sliding window strategy for sessions exceeding model context limits.

10. **FR 12.8 - Insights Caching**: Added 30-second cache for insights to avoid unnecessary regeneration.

---

*Document prepared by Product Manager Agent - Phase 5 Requirements Finalization*
*Date: 2026-02-25*

*Technical implementation added by Technical Specification Agent - Phase 6*
*Date: 2026-02-25*

---

## Appendix: Architecture Overview

### Tech Stack Summary

| Layer | Technology |
|-------|------------|
| Frontend Framework | Next.js 15 (React 19) |
| Styling | Tailwind CSS 4 |
| State Management | React Query (TanStack Query) |
| Validation | Zod 3.24 |
| Database | PostgreSQL with Drizzle ORM |
| AI Runtime | Vercel AI SDK (@ai-sdk/anthropic) |
| Charts | Recharts |
| Notifications | Sonner |
| Icons | Lucide React |
| Auth (future) | Better Auth |

### Component Tree

```
src/
├── app/
│   ├── page.tsx                    # Main dashboard
│   └── api/
│       └── trades/
│           ├── route.ts            # POST /api/trades
│           └── [id]/route.ts       # PATCH /api/trades/:id
├── components/
│   ├── dashboard/
│   │   ├── HeaderBar.tsx
│   │   ├── DashboardLayout.tsx
│   │   └── MetricsGrid.tsx
│   ├── charts/
│   │   ├── PnLChart.tsx
│   │   ├── DisciplineChart.tsx
│   │   ├── AgencyChart.tsx
│   │   └── EmptyChart.tsx
│   ├── trade-entry/
│   │   ├── TradeInput.tsx
│   │   └── TradeReview.tsx
│   └── insights/
│       ├── InsightsPanel.tsx
│       └── InsightCard.tsx
├── lib/
│   ├── ai/
│   │   ├── extraction/
│   │   │   ├── pipeline.ts
│   │   │   ├── retry-handler.ts
│   │   │   ├── model-fallback.ts
│   │   │   └── tiered-inference.ts
│   │   ├── scoring/
│   │   │   └── discipline-scorer.ts
│   │   ├── insights/
│   │   │   └── generator.ts
│   │   ├── prompts/
│   │   │   ├── trade-extraction.ts
│   │   │   ├── few-shot-examples.ts
│   │   │   └── synonym-clusters.ts
│   │   └── security/
│   │       └── input-sanitizer.ts
│   ├── db/
│   │   ├── schema/
│   │   │   ├── index.ts
│   │   │   ├── trades.ts
│   │   │   ├── trading-days.ts
│   │   │   └── auth.ts
│   │   └── trade-operations.ts
│   └── schemas/
│       └── trade.ts
└── types/
    └── index.ts
```

### Data Flow

```
User Input → Sanitization → Extraction Pipeline → Schema Validation → DB Transaction → Optimistic UI Update
                                        ↓                                              ↓
                                   Retry Logic                                    Invalidate Cache
                                        ↓                                              ↓
                                   Model Fallback ──────────────────────────→ Insights Generation (Async)
```

### API Contracts

#### POST /api/trades

**Request:**
```typescript
{
  input: string  // Natural language trade description
}
```

**Response (Success - 201):**
```typescript
{
  success: true,
  data: {
    id: string,
    direction: 'long' | 'short',
    outcome: 'win' | 'loss' | 'breakeven',
    pnl: number | null,
    timestamp: string,
    setupDescription: string | null,
    disciplineScore: -1 | 0 | 1,
    agencyScore: -1 | 0 | 1,
    confidenceDiscipline: 'high' | 'medium' | 'low',
    confidenceAgency: 'high' | 'medium' | 'low',
    cumulativePnl: number
  }
}
```

**Response (Needs Review - 202):**
```typescript
{
  success: true,
  data: ExtractedTrade,
  needsReview: true,
  lowConfidenceFields: string[]
}
```

**Response (Error - 400):**
```typescript
{
  success: false,
  error: string,
  retryable: boolean
}
```

#### GET /api/trading-days/:date

**Response (200):**
```typescript
{
  success: true,
  data: {
    id: string,
    date: string,
    totalPnl: number,
    winCount: number,
    lossCount: number,
    tradeCount: number,
    netDisciplineScore: number,
    netAgencyScore: number,
    last5DisciplineSum: number,
    last5AgencySum: number,
    sessionHighPnl: number,
    sessionLowPnl: number,
    consecutiveWins: number,
    consecutiveLosses: number,
    avgWin: number | null,
    avgLoss: number | null,
    trades: Trade[]
  }
}
```

#### POST /api/insights

**Request:**
```typescript
{
  tradingDayId: string
}
```

**Response (200):**
```typescript
{
  success: true,
  data: {
    insights: Insight[],
    generatedAt: string
  }
}
```

### Security Considerations

1. **Input Sanitization:** All user input sanitized before LLM processing
2. **Schema Validation:** Zod validation before DB writes
3. **Error Messages:** No sensitive data leaked in error responses
4. **Rate Limiting:** Insights rate-limited to prevent alert fatigue
5. **No Authentication:** Single-user Phase 1 (see Out of Scope)

### Performance Targets

| Metric | Target |
|--------|--------|
| E2E Latency (with DB write) | < 3s |
| Extraction Only | < 1.2s (p95: 1.5s, p99: 3s) |
| DB Write | < 100ms |
| Insights Generation | < 2s (async) |
| Perceived Latency | < 1s (optimistic) |
