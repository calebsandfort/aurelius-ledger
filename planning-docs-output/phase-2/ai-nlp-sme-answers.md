# Phase 2b: AI/NLP SME Answers to Cross-SME Questions

**SME Agent:** ai-nlp-sme (AIWorkflow)
**Domain:** AI/ML Architecture, Prompt Engineering, Agent Design, LLM Inference Optimization
**Project:** Aurelius Ledger

---

## Answers to Questions from Behavioral Psychology SME

### Question 1: Contradictory Signal Handling

**Asked by:** Behavioral Psychology SME (BehavioralCoach)

**Question:** How should the insights agent handle contradictory signals? For example, when discipline_score is positive but agency_score is negative, how should the natural language insight weight and present these conflicting indicators?

---

### Expert Answer

**Recommended Approach: Dual-Track Narrative with Weighted Presentation**

The insights agent should NOT collapse contradictory signals into a single averaged score. Instead, it should present a **dual-track narrative** that acknowledges both dimensions independently, then synthesizes them into actionable guidance.

**Prompt Structure for Contradictory Signals:**

```
CONTEXT ANALYSIS INSTRUCTIONS:
1. Analyze discipline_score independently — this measures adherence to trading plan/strategy
2. Analyze agency_score independently — this measures self-directed vs reactive decision-making
3. If scores diverge (one positive, one negative), provide BOTH observations BEFORE synthesis

SYNTHESIS GUIDANCE:
- discipline=+, agency=-: "Good execution but reactive positioning — focus on plan-based entries"
- discipline=-, agency=+: "Good positioning instincts but inconsistent execution — stick to your checklist"
- Both negative: High-risk state requiring intervention (tilt protocol)
- Both positive: Reinforce current approach

PRESENTATION ORDER:
1. Lead with the more impactful signal based on session stage
2. Early session: Agency matters more (building foundation)
3. Mid/late session: Discipline matters more (protecting gains)
```

**Key Principle:** Never average -1 and +1 into 0. A trader who waited for setup (+1 discipline) but entered impulsively (-1 agency) has fundamentally different needs than one who entered on plan (+1 agency) but chased price (-1 discipline).

---

### Question 2: Context Window Optimization

**Asked by:** Behavioral Psychology SME (BehavioralCoach)

**Question:** What is the optimal context window for the insights generation? Should it receive raw trade records, aggregated session statistics, or both? What are the trade-offs in terms of LLM token costs vs. insight quality?

---

### Expert Answer

**Recommended: Both Raw Records + Aggregated Stats — Structured for Efficiency**

As stated in my Phase 1 analysis, I strongly recommend passing **both** raw records and aggregated stats. Let me elaborate on the specific implementation:

**Optimal Context Structure:**

```typescript
// Context Window: Last 15 trades maximum
// Token estimate: ~800 tokens for context, ~200 tokens for output
// Cost: ~$0.002/insight generation (Sonnet 4.5)

const insightsContext = {
  // Raw records (limited to last 15 trades for context window)
  recentTrades: [
    // Last 15 trades with key fields only
    { seq: 15, outcome: 'win', pnl: 250, discipline: 1, agency: 1, description: "waited for pullback" },
    { seq: 14, outcome: 'loss', pnl: -120, discipline: -1, agency: 0, description: "fomo'd entry" },
    // ... up to 15 records
  ],

  // Aggregated stats (session-level)
  sessionSummary: {
    tradeCount: 12,
    wins: 7, losses: 4, breakeven: 1,
    totalPnl: 890,
    avgWin: 180, avgLoss: -95,
    netDiscipline: 2,
    netAgency: -1,
    winRate: 0.58
  },

  // Computed trend signals (pre-calculated, not raw data)
  trends: {
    disciplineTrajectory: 'stable',
    agencyTrajectory: 'declining',  // Flag for attention
    pnlTrajectory: 'winning'
  }
}
```

**Trade-off Analysis:**

| Approach | Token Cost | Insight Quality | Recommendation |
|----------|------------|------------------|-----------------|
| Raw only (15 trades) | ~$0.003 | Medium | Loses aggregate visibility |
| Aggregated only | ~$0.001 | Low | Loses behavioral patterns |
| **Both (structured)** | **~$0.002** | **High** | **Recommended** |
| Raw only (50 trades) | ~$0.006 | High | Diminishing returns |

**Key Insight:** The LLM cost difference between "just stats" and "stats + raw" is ~$0.001 per insight. This is negligible. The quality gain from having raw descriptions is significant because behavioral patterns often appear in the language used, not just the numbers.

---

### Question 3: Timing of Insight Generation

**Asked by:** Behavioral Psychology SME (BehavioralCoach)

**Question:** How should the system handle the timing of insight generation? Should insights be generated synchronously (blocking trade entry) or asynchronously (generated in background)? What are the behavioral implications of each approach?

---

### Expert Answer

**Recommended: Asynchronous (Background) Generation with Optimistic UI**

**Architecture:**

```
Trade Entry → Extract → Validate → DB Write → Return Success
                                      ↓
                              Trigger Background Insight Generation
                                      ↓
                              Store Insights → Push to Dashboard (WebSocket)
```

**Behavioral Rationale:**

1. **Synchronous (Blocking):** Forces trader to wait 1-2 seconds AFTER entering trade
   - Disadvantage: Adds friction to workflow, breaks flow state
   - Advantage: Trader sees insights immediately with the trade
   - Risk: Traders may skip entering trades to avoid delay

2. **Asynchronous (Background):** Trader gets immediate confirmation, insights arrive 1-2 seconds later
   - Advantage: Maintains frictionless workflow
   - Advantage: Insights appear in dashboard automatically via polling/WebSocket
   - Risk: Brief window where insights are stale (acceptable)

**Recommended Implementation:**

- Trade entry completes in <1 second (blocking)
- Insights generated in background, displayed when ready
- Use optimistic UI — show trade immediately, insights panel shows "Analyzing..." spinner
- If trader navigates away before insights ready, show "New insights available" badge on return

**Latency Budget:**

| Component | Synchronous | Asynchronous |
|-----------|-------------|---------------|
| Trade entry | 900ms | 900ms |
| Insights | 1500ms | 1500ms (background) |
| Total wait | 2400ms | 900ms (perceived) |

The behavioral psychology SME's NFR-B1 (insights within 2 seconds) is achievable with either approach, but async preserves workflow frictionlessness.

---

### Question 4: Prompt Structure for Consistent Score Interpretation

**Asked by:** Behavioral Psychology SME (BehavioralCoach)

**Question:** What prompt structure would maintain consistency in behavioral score interpretation across different trader vocabulary? For example, how should the agent handle descriptions that use different vocabulary to express similar concepts (e.g., "chased price" vs. "fomo'd in" vs. "got greedy")?

---

### Expert Answer

**Recommended: Semantic Mapping with Synonym Clusters in System Prompt**

**Prompt Architecture:**

```
SYSTEM PROMPT STRUCTURE:

## ROLE
You are a trading behavior analyst. Your task is to extract structured data
from natural language trade descriptions and assign behavioral scores.

## SCORING RUBRIC

### Discipline Score (Adherence to Trading Plan)
+1 (Positive Discipline): Trader waited for confirmed setup, followed entry
   criteria, adhered to stop loss, did not override plan
   — Keywords: "waited for", "confirmed", "followed plan", "stayed patient",
     "good setup", "clean entry", "as planned"

0 (Neutral): Trade was neither particularly disciplined nor undisciplined
   — Keywords: "entered", "took", "position"

-1 (Negative Discipline): Trader deviated from plan, over-leveraged, ignored
  signals, Revenge trading indicators
   — Keywords: "chased", "fomo'd", "fomo", "got greedy", "couldn't wait",
     "forced it", "overrode", "revenge", "too big"

### Agency Score (Self-Directed vs Reactive)
+1 (Positive Agency): Trader made independent decisions based on analysis,
   adapted to market conditions thoughtfully
   — Keywords: "adapted", "read the market", "my call", "decided", "chose"

0 (Neutral): Standard trade execution
   — Keywords: "entered", "took"

-1 (Negative Agency): Trader reacted to market moves, impulsive positioning
   — Keywords: "reacted", "got sucked in", "chased", "couldn't resist",
     "followed the crowd", "bandwagon"

## SYNONYM MAPPING (CRITICAL)
Map all equivalent expressions to canonical keywords for consistent scoring:

CHASED PRICE CLUSTER:
- "chased price" → chased → discipline: -1
- "chased up" → chased → discipline: -1
- "fomo'd in" → fomo → discipline: -1
- "fomo'd" → fomo → discipline: -1
- "got greedy" → greedy → discipline: -1
- "got fomo" → fomo → discipline: -1
- "couldn't sit still" → impulsive → discipline: -1

PATIENCE CLUSTER:
- "waited for pullback" → waited → discipline: +1
- "waited for confirmation" → waited → discipline: +1
- "patient" → patience → discipline: +1
- "good setup formed" → waited → discipline: +1
- "as soon as" → immediate → discipline: -1

## OUTPUT FORMAT
Return JSON only. No surrounding text.
```

**Key Technique:** Explicit synonym clusters prevent the LLM from treating "chased" and "fomo'd in" as different concepts with potentially different scores. Both map to the same behavioral pattern.

**Testing Protocol:** Include 3-4 examples in few-shot that cover the synonym variations to ensure the model generalizes correctly.

---

## Answers to Questions from Data Analytics SME

### Question 5: Data Context for Insights Agent

**Asked by:** Data Analytics SME (DataScientist)

**Question:** What context should be passed to the insights agent - raw trade records, aggregated session stats, or both? Should insights be streamed or returned as a complete block?

---

### Expert Answer

**Complete answer provided in Question 2 above.** This is the same question re-phrased.

**Summary Position:**
- Pass **both** raw records (last 15) and aggregated stats
- Return as **complete block** (not streamed)
- See Question 2 for detailed rationale and implementation structure

---

### Question 6: Score Calculation Edge Cases

**Asked by:** Data Analytics SME (DataScientist)

**Question:** How should the AI handle ambiguous trade descriptions where discipline or agency cannot be determined? Should it default to 0, or attempt to infer from other signals in the description?

---

### Expert Answer

**Recommended: Tiered Inference with Explicit Confidence Flagging**

**Approach:**

```typescript
interface ExtractionResult {
  discipline_score: -1 | 0 | 1 | null;
  agency_score: -1 | 0 | 1 | null;
  confidence: {
    discipline: 'high' | 'medium' | 'low';
    agency: 'high' | 'medium' | 'low';
  };
  ambiguity_flag: boolean;
}

// Tiered handling:

// TIER 1: Clear signals → High confidence
"Long NVDA, waited for pullback, +$200"
→ discipline: 1, agency: 1, confidence: high

// TIER 2: Partial signals → Medium confidence
"Long NVDA, small winner"
→ discipline: 0 (neutral execution), agency: 0 (default)
→ confidence: medium (no explicit behavior mentioned)

// TIER 3: One signal clear, one ambiguous → Partial inference
"Long NVDA, chased the breakout, +$150"
→ discipline: -1 (chased), agency: 0 (inferred neutral from context)
→ confidence: discipline-high, agency-low

// TIER 4: Complete ambiguity → Flag for manual review
"Long NVDA"
→ discipline: null, agency: null, ambiguity_flag: true
→ Return error: "Please add more detail about your entry decision"
```

**Recommended Policy:**

1. **Never default to 0 silently** — if there's ambiguity, flag it explicitly
2. **Allow null values** with confidence scores for UI to display "needs review"
3. **If outcome is inferable but scores are not**, set scores to null with low confidence
4. **Reject ambiguous entries** rather than write false data (as per original requirements)

**Why This Matters for Data Analytics:**
- False 0s pollute the behavioral data
- Confidence flags allow the dashboard to show "review needed" badges
- Over time, analyzing which descriptions lead to low confidence improves the prompt

---

### Question 7: Extraction Reliability

**Asked by:** Data Analytics SME (DataScientist)

**Question:** What's the expected extraction accuracy threshold? If extraction fails, should we allow manual entry correction or reject the trade entirely?

---

### Expert Answer

**Recommended: Hybrid Approach with Manual Correction Flow**

**Accuracy Expectations:**

| Extraction Element | Target Accuracy | Rationale |
|--------------------|-----------------|-----------|
| Direction (long/short) | >95% | Simple binary |
| P&L amount | >98% | Explicit numbers |
| Outcome | >95% | Usually implied by P&L |
| Discipline score | >85% | Requires interpretation |
| Agency score | >80% | More subjective |

**Failure Handling Architecture:**

```
Extraction Attempt
       ↓
  Success? ──No──▶ Retry (max 2x)
       │                ↓
      Yes         Success? ──No──▶ User Error Screen
       ↓                │             ↓
  Validation       Yes      "Could not parse. Try: 'Long AAPL, +$200, waited for pullback'"
       ↓
  Valid? ──No──▶ Retry
       │
      Yes
       ↓
  Write to DB ──▶ Success ──▶ Display Trade
       │                │
      Low               Manual Correction Option
    Confidence              ↓
       ↓              "Edit extracted data"
  Show in UI         ┌──────────────┐
  "Review needed"   │ Correct fields │
  badge              │ Re-submit      │
                     └──────────────┘
```

**Recommended Policy:**

1. **After 3 failed attempts:** Show user-friendly error with example format
2. **On successful extraction with low confidence:** Display trade with "Review scores" button
3. **Allow manual correction:** Pre-fill form with extracted data, let user adjust
4. **Log all failures:** For prompt improvement analysis

**Manual Correction UI Flow:**

- If confidence < 70% on any field, show edit modal after extraction
- Pre-populate all extracted fields
- User can confirm or modify before final save
- This balances automation with accuracy requirements

**Why Not Reject Entirely:**
- Poor user experience to lose entered data
- Many "failures" are partial successes user can correct quickly
- Rejection creates friction that discourages logging trades

---

## Summary

All questions answered from the AI/NLP architecture perspective:

1. **Contradictory signals:** Present dual-track narratives, never average diverging scores
2. **Context window:** Pass both raw records and aggregated stats — cost is negligible for quality gained
3. **Timing:** Asynchronous background generation preserves workflow frictionlessness
4. **Prompt structure:** Use synonym clusters for consistent vocabulary mapping
5. **Ambiguous descriptions:** Tiered inference with explicit confidence flagging
6. **Extraction reliability:** Target >85% accuracy, allow manual correction rather than rejection

---

*Answers prepared by ai-nlp-sme for Phase 2b Requirements Elaboration*
