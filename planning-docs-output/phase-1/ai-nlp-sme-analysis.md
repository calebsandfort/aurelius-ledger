# Phase 1 SME Analysis: AI/NLP Architecture

**SME Agent:** ai-nlp-sme
**Domain:** AI/ML Architecture, Prompt Engineering, Agent Design, LLM Inference Optimization
**Project:** Aurelius Ledger

---

## Executive Summary

The Aurelius Ledger requires a robust AI pipeline for two primary tasks: (1) extracting structured trade data from natural language descriptions, and (2) generating behavioral insights from session data. Below is the expert analysis addressing all AIWorkflow-tagged questions, with recommendations grounded in current best practices for LLM-based extraction and agentic workflows.

---

## Question 1: Optimal Prompt Structure for Trade Extraction

### Recommendation: Structured System Prompt with 3-5 Few-Shot Examples

**Optimal Prompt Structure:**

```
SYSTEM PROMPT:
| Section | Content |
|---------|---------|
| Role Definition | You are a precise trade extraction assistant... |
| Output Schema | JSON schema with field definitions and valid values |
| Extraction Rules | Discipline/agency scoring rubrics with examples |
| Few-Shot Examples | 3-5 diverse examples covering edge cases |
| Error Handling | Instructions for handling ambiguous inputs |
| Output Format | Strict JSON, no surrounding text |
```

### Few-Shot Example Count: 3-5 Examples

**Rationale:**
- **3 examples** is the minimum viable for covering the main variation patterns (clear win, clear loss, ambiguous/edge case)
- **5 examples** allows for including both long and short inputs, different writing styles, and the discipline/agency edge cases
- Beyond 5 examples, token cost increases without proportional accuracy gains
- For this use case, I recommend **4 examples** covering: (1) explicit dollar P&L, (2) "small winner/loser" without amount, (3) clear discipline indicators, (4) reactive/impulsive language

### Handling Ambiguous P&L

**Recommended Strategy: Tiered Inference**

```
TIER 1 (explicit): "Made $450" → pnl: 450
TIER 2 (relative): "small winner" or "nice profit" → pnl: null, flag for review
TIER 3 (implied): "took a loss" → pnl: null, outcome: "loss", pnl: null
TIER 4 (complete ambiguity): no P&L mentioned → return error requiring clarification
```

**Implementation Notes:**
- Do NOT fabricate dollar amounts — this introduces false data
- For Tier 2-3, set `pnl: null` but infer `outcome` where possible
- The requirement states "If extraction fails or required fields cannot be inferred, the system surfaces an error and does not write a partial record" — this is correct; however, `pnl` can be nullable if `outcome` is inferable
- Consider adding a "confidence" field to the extraction output so the UI can flag low-confidence extractions for manual review

### Prompt Engineering Best Practices for This Use Case

1. **Use JSON Schema in system prompt** — Define exact structure with enum values for direction, outcome, discipline_score, agency_score
2. **Provide scoring rubrics** — Include explicit examples of language mapping to each score (-1, 0, 1)
3. **Include negative examples** — Show what "chased" and "waited for" look like side-by-side
4. **Set output format strictly** — "Output valid JSON only, no explanatory text"
5. **Temperature = 0** — For extraction, reproducibility is critical

---

## Question 2: Single LLM Call vs. LangGraph Node with Validation

### Recommendation: LangGraph Node with Validation Step

**Architecture: Two-Phase Extraction with Retry**

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Trade Text     │────▶│  LLM Extraction  │────▶│  JSON Validation│
│  Input          │     │  (structured)   │     │  + Schema Check │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                         │
                        ┌────────────────────────────────┘
                        │                    │
                   Valid JSON            Invalid/Retry
                        │                    │
                        ▼                    ▼
                ┌───────────────┐    ┌──────────────────┐
                │ Write to DB  │    │ Retry (max 2x)   │
                └───────────────┘    └──────────────────┘
```

### Rationale

| Factor | Single Call | LangGraph Node |
|--------|-------------|----------------|
| **Reliability** | Schema may mismatch on first try | Validation catches errors, retries automatically |
| **Latency** | Slightly faster (no validation round-trip) | +200-500ms for retry, acceptable for 3s SLA |
| **User Experience** | Silent failure or cryptic error | Clear error message after retries exhausted |
| **Cost** | 1 call per extraction | 1-3 calls depending on retries |
| **Debugging** | Harder to diagnose failures | Easy to log which validation step failed |

**Why Not Single Call:**
- Structured output guarantees vary by model; even with JSON mode, schema mismatches occur
- The requirement states "no silent partial writes" — validation ensures completeness
- LangGraph adds minimal complexity but significantly improves reliability

**Retry Strategy:**
- Max 2 retries (3 total attempts)
- On final failure, return user-friendly error: "Could not extract trade details. Please provide more detail (e.g., 'Long AAPL, +$250, waited for pullback')"
- Log failed attempts for later analysis

### Model Selection

- **Extraction:** Haiku 4.5 or Sonnet 4.5 — structured extraction is a "lightweight agent" task
- **Rationale:** Extraction follows explicit rules, doesn't require deep reasoning; Haiku is sufficient and 3x cheaper than Sonnet
- **Use Sonnet** only if discipline/agency scoring proves difficult and requires more contextual inference

---

## Question 3: Insights Agent Context & Streaming

### Recommendation: Pass Both Raw Records + Aggregated Stats; Return Complete Block

**Context Structure:**

```typescript
interface InsightsContext {
  // Raw session data (last 10-20 trades max)
  trades: Array<{
    timestamp: string
    direction: 'long' | 'short'
    outcome: 'win' | 'loss' | 'breakeven'
    pnl: number
    discipline_score: -1 | 0 | 1
    agency_score: -1 | 0 | 1
    setup_description: string
  }>

  // Aggregated stats
  sessionStats: {
    totalTrades: number
    wins: number
    losses: number
    breakeven: number
    totalPnl: number
    avgWin: number
    avgLoss: number
    disciplineSum: number
    agencySum: number
    winRate: number
    firstTradeTime: string
    lastTradeTime: string
  }

  // Recent trend flags
  trends: {
    disciplineTrajectory: 'improving' | 'declining' | 'stable'
    agencyTrajectory: 'improving' | 'declining' | 'stable'
    pnlTrajectory: 'winning' | 'losing' | 'flat'
  }
}
```

### Why Both Raw + Aggregated?

| Context Type | Purpose | Example Insight |
|--------------|---------|-----------------|
| **Raw records** | Detect behavioral patterns in descriptions | "Last 3 losses all involved 'chased' language" |
| **Aggregated stats** | Quick session health assessment | "3 losses in a row after first hour" |
| **Trend flags** | Directional indicators for quick triage | "Discipline declining — intervention flag" |

**Key Insight:** The behavioral psychology SME's insights are most actionable when they connect raw behavioral signals (descriptions, score patterns) to aggregate outcomes. Don't send only aggregated stats — lose the narrative detail. Don't send only raw records — lose the trend visibility.

### Streaming vs. Complete Block

**Recommendation: Complete Block (Not Streamed)**

**Rationale:**
1. **Latency:** Insights generation takes 1-2 seconds; streaming saves minimal perceived latency
2. **Coherence:** Trading insights should be presented as cohesive analysis, not word-by-word
3. **UI Simplicity:** Dashboard panel can show loading state, then display complete insights
4. **Cost:** Streaming doesn't reduce token costs; full generation still required

**Exception:** If insights exceed 500+ words or latency is problematic, consider streaming. But for typical session summaries (100-200 words), complete block is cleaner.

### Insights Generation Strategy

**Post-Trade Workflow:**
1. User submits trade → Extraction → DB write
2. Immediately fetch last N trades (up to 20 for context window)
3. Compute aggregated stats + trend flags
4. Call insights agent with full context
5. Store insights in DB (overwrite previous)
6. Dashboard updates with new insights

**Model Selection: Sonnet 4.5**
- Insights generation requires synthesis and pattern recognition across multiple trades
- This is "main development work" complexity, not lightweight
- Accept the higher cost for better quality insights

---

## Technical Implementation Notes

### Latency Budget Allocation (3s SLA)

| Component | Target | Notes |
|-----------|--------|-------|
| Network latency | 200ms | Assume OpenAI API overhead |
| Extraction (Haiku) | 500ms | Fast model, structured output |
| Validation | 50ms | Local JSON schema check |
| DB write | 100ms | SQLite local, fast |
| Insights generation (Sonnet) | 1500ms | Background, not blocking |
| UI update | 50ms | React state update |
| **Total (blocking)** | **~900ms** | Well under 3s |
| **Total (with insights)** | **~2.5s** | Still under 3s |

### Error Handling Architecture

```typescript
// Extraction failure → User feedback flow
interface ExtractionResult {
  success: boolean
  trade?: TradeData
  error?: {
    code: 'PARSE_ERROR' | 'MISSING_REQUIRED' | 'AMBIGUOUS'
    message: string
    suggested_fix?: string
  }
  confidence?: number // 0-1 for UI display
}
```

### Cost Optimization

- **Haiku for extraction:** ~$0.0002/transaction (at 200 tokens in, 50 out)
- **Sonnet for insights:** ~$0.003/insight generation (at 500 tokens in, 200 out)
- **Monthly estimate:** 50 trades/day × 20 days = 1000 trades/month
  - Extraction: ~$0.20/month
  - Insights: ~$3.00/month
  - **Total: ~$3.20/month** — negligible cost

---

## Summary of Recommendations

1. **Prompt Structure:** 4 few-shot examples, JSON schema in system prompt, explicit scoring rubrics
2. **Ambiguous P&L:** Tiered inference; never fabricate; null allowed if outcome inferable
3. **Extraction Architecture:** LangGraph node with validation and 2 retries max
4. **Insights Context:** Both raw records + aggregated stats + trend flags
5. **Insights Delivery:** Complete block, not streamed; use Sonnet model
6. **Model Selection:** Haiku for extraction, Sonnet for insights
7. **Latency:** Total pipeline well under 3s SLA

---

## Questions for Other SMEs

### For Behavioral Psychology SME [SME:BehavioralCoach]:

1. **Discipline/Agency Scoring Validation:** What specific language patterns beyond the examples in the HLRD ("waited for," "chased," "fomo'd in") should be prioritized in the prompt? Are there common trader phrases that might be misclassified?

2. **Insights Actionability:** Beyond the categories you mentioned (setup consistency, discipline trend, tilt risk, winning vs. losing patterns), what other insight categories would be most valuable mid-session? Should insights differentiate between "information" (observations) and "recommendations" (actionable changes)?

3. **Score Calibration:** The HLRD specifies -1/0/1 for scores. Is this granularity sufficient, or would -2 to +2 provide better differentiation without introducing noise? How should we communicate score meaning to the trader?

### For Data Analytics SME [SME:DataScientist]:

1. **Visualization Recommendations:** For the P&L time series, discipline trend, and agency trend charts — what chart types and visual patterns would be most immediately readable during live trading? Should there be reference lines (e.g., "at zero" for cumulative scores)?

2. **Aggregation Window:** The trading_days table maintains running aggregates. What aggregation granularity beyond daily is needed for the insights agent? Should we track rolling windows (last 5 trades, last 10 trades)?

3. **Outlier Handling:** How should the system handle outlier trades (e.g., +$5000 winner vs. typical +$200 winners) in the insights? Should P&L be normalized for context, or shown as-is?

---

*Analysis prepared by ai-nlp-sme for Phase 1 Requirements Elaboration*
