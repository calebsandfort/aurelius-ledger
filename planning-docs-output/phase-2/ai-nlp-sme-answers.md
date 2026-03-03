# AI/NLP SME Answers (Phase 2)

## Overview

This document provides specific, actionable answers to questions from the Behavioral Psychology SME and Data Analytics SME regarding AI/NLP implementation for the Aurelius Ledger system.

---

## From Behavioral Psychology SME

### Question 1: Prompt Calibration for Behavioral Scores

**Context:** The behavioral psychology analysis discusses discipline and agency scoring (-1, 0, +1) for trading behavior analysis.

**Question:** How should we structure the system prompt to ensure discipline and agency scoring is consistent across different writing styles? Should we include few-shot examples of trades with known outcomes to calibrate the LLM's scoring behavior?

**Answer:**

Yes, few-shot examples are essential for consistent behavioral scoring. Structure the prompt as follows:

```
SYSTEM PROMPT:
You are a trade analysis assistant. Analyze each trade description and assign behavioral scores.

## Scoring Criteria

### discipline_score
- +1: Explicit discipline signals — waited for confirmation, patient, followed plan, stuck to thesis, let winners run, stopped out cleanly
- -1: Discipline failures — chased price, FOMO'd in, revenge traded, overtraded, impulsive entry, ignored stops
- 0: Ambiguous or no behavioral signals present

### agency_score
- +1: Intentional execution — followed trading plan, deliberate entry, acted on setup, made conscious decision
- -1: Reactive trading — knew better but didn't follow plan, acted against rules, couldn't help it, forced entry
- 0: Ambiguous or no agency signals

## Few-Shot Examples

Example 1 (Discipline +1, Agency +1):
"Waited for the retest of support at 4100, entered long on confirmation, rode it to 4125 — solid setup. +$340"
- Analysis: Shows patience (waited), deliberate entry (on confirmation), followed thesis
- Scores: discipline=+1, agency=+1

Example 2 (Discipline -1, Agency -1):
"Chased the breakout above 4110, knew I shouldn't have taken it, FOMO'd in. Got stopped out quickly. -$85"
- Analysis: Explicit chasing behavior, self-aware violation ("knew I shouldn't"), impulsive
- Scores: discipline=-1, agency=-1

Example 3 (Discipline 0, Agency 0):
"Took a long at 4095, exited at 4105. +$100"
- Analysis: No behavioral signals present, purely factual
- Scores: discipline=0, agency=0

Example 4 (Discipline +1, Agency -1):
"Held my long from 4080 through the pullback, patient. But I added to position when I shouldn't have. +$220"
- Analysis: Shows patience (held through pullback) but position sizing violation
- Scores: discipline=+1, agency=-1
```

**Key recommendations:**
- Include 3-4 examples covering all score combinations
- Use diverse writing styles (brief vs detailed, self-aware vs factual)
- Add explicit scoring rationale after each example
- Review and rotate examples quarterly based on accuracy metrics

---

### Question 2: Retry Mechanism for Zero Scores

**Context:** The scoring system relies on the LLM to extract behavioral signals from trade descriptions.

**Question:** What retry mechanism should be used when scores come back as 0 repeatedly — is this a signal that the prompt needs adjustment?

**Answer:**

Repeated zero scores are likely a signal that the prompt needs adjustment, but a retry mechanism is still warranted. Implement a tiered approach:

**Recommended Retry Logic:**

```
1st attempt: Standard prompt → Parse scores
   |
   +-- Valid scores returned → Continue
   |
   +-- All scores = 0 → Check if input has behavioral signals

   If behavioral signals present but scored 0:
      → 2nd attempt with "nudge" prompt: "Be more generous in detecting discipline/agency signals. Look for implicit behavioral cues."

   If still all zeros after 2nd attempt:
      → 3rd attempt with explicit keyword mapping
      → Log for human review

   If 3 consecutive 0-only results across different inputs:
      → Trigger prompt recalibration alert
      → Review recent inputs for false negatives
```

**When to flag for prompt adjustment:**
- 3+ consecutive zero-only results (across different trades)
- Zero scores for inputs that clearly contain behavioral signals (retrospective review)
- Pattern of missing specific signal types (e.g., never detecting "patience")

**Key principle:** Zero scores should be rare. Most trading descriptions contain some behavioral signal. Frequent zeros indicate the prompt is too strict or examples are insufficient.

---

### Question 3: Insights Generation Token Budget

**Context:** The HLRD specifies a 3-second SLA for trade entry to dashboard update. Insights are part of this flow.

**Question:** What is the optimal token budget for the insights generation to ensure it completes within the 3-second SLA? Should insights be generated asynchronously after the trade is committed to avoid blocking the UI?

**Answer:**

**Recommended approach: Asynchronous insights generation**

The 3-second SLA should apply to trade entry completion and dashboard update, NOT to insights generation. Here's the breakdown:

**Token Budget for Insights:**

| Component | Tokens | Estimated Cost |
|-----------|--------|----------------|
| System prompt | ~500 | $0.001 |
| Session summary (5-10 trades) | ~300 | $0.0006 |
| Trade details (JSON) | ~400 | $0.0008 |
| Output | ~300 | $0.0006 |
| **Total** | ~1,500 | ~$0.003 |

**Timing budget:**
- LLM inference: 800ms-1500ms (depends on model and complexity)
- Network: 200-500ms
- **Total: 1-2 seconds for insights generation**

**Architecture recommendation:**

```
Trade Entry →
  1. Commit trade to DB (sync, <500ms)
  2. Update dashboard with new trade data (sync, <500ms)
  3. Queue insights generation (async, non-blocking)
  4. Return success to user

Background:
  5. Generate insights
  6. Push to frontend via WebSocket or poll
```

**UI behavior:**
- Show dashboard immediately with new trade data
- Display "Generating insights..." placeholder in insights panel
- Insights load within 1-2 seconds via background process
- Use optimistic UI — show last cached insights until new ones complete

This approach meets the 3-second SLA while providing rich insights without blocking the user's workflow.

---

### Question 4: Score Confidence Handling

**Context:** The behavioral scoring system assigns discrete values (-1, 0, +1) based on textual analysis of trade descriptions.

**Question:** Should there be a confidence score alongside discipline/agency scores? If the LLM is uncertain, should we default to 0 or surface that ambiguity?

**Answer:**

**Yes, implement confidence scoring alongside behavioral scores.** This is critical for system reliability and user trust.

**Recommended confidence schema:**

```python
from typing import Literal
from pydantic import BaseModel

class TradeScoring(BaseModel):
    discipline_score: Literal[-1, 0, 1]
    discipline_confidence: Literal["high", "medium", "low"]
    agency_score: Literal[-1, 0, 1]
    agency_confidence: Literal["high", "medium", "low"]

    # Optional: explanation for transparency
    scoring_notes: str | None = None
```

**When to return each confidence level:**

| Confidence | Trigger Conditions |
|------------|-------------------|
| High | Explicit behavioral keywords present, clear context |
| Medium | Some signals present but ambiguous, relative terms |
| Low | No clear signals, purely factual description, or conflicting cues |

**Handling low confidence:**
- Default to 0 for the score (neutral) when confidence is low
- Add a flag `requires_review: true` for manual review
- Surface the ambiguity: "Could not determine discipline score — consider adding more detail to your trade description"
- Do NOT guess — returning a confident score when uncertain undermines system trust

**Key principle:** It's better to say "I don't know" (low confidence, 0 score) than to guess incorrectly. Traders will trust a system that admits uncertainty over one that misrepresents their behavior.

---

### Question 5: Insight Generation Async vs Sync

**Context:** Discussion of trade entry latency requirements.

**Question:** Should insights be generated asynchronously after the trade is committed to avoid blocking the UI? If so, what should the UI show while insights are generating?

**Answer:**

**Yes, insights should be generated asynchronously.** This is the recommended approach.

**UI States:**

| State | Display | When |
|-------|---------|------|
| Initial | Last cached insights or "No insights yet" | Before first trade or no cached data |
| Loading | Skeleton/spinner with "Analyzing..." | During insights generation |
| Success | Full insights text | After generation completes |
| Error | "Insights unavailable" with retry button | If generation fails |

**Implementation details:**

1. **Cache last valid insights** — persist after each generation
2. **Optimistic update** — show cached insights while generating new ones
3. **Stale indicator** — show "Last updated: HH:MM" timestamp
4. **Auto-retry** — retry failed generation once, then show error state

**Rationale:**
- The 3-second SLA is for trade entry → dashboard data, not insights
- Blocking the UI for insights adds no value — the trader can proceed
- Async generation provides best UX without compromising requirements

---

### Question 6: Few-Shot Examples for Scoring Calibration

**Context:** The behavioral psychology SME is concerned with consistency of discipline/agency scoring.

**Question:** Should we include few-shot examples of trades with known outcomes to calibrate the LLM's scoring behavior? What examples would be most valuable for distinguishing between positive, negative, and neutral behavioral signals?

**Answer:**

**Yes, include curated few-shot examples.** This is the most effective way to calibrate scoring consistency.

**Recommended example set (minimum 4, optimal 6):**

| Example | Discipline | Agency | Why Included |
|---------|------------|--------|--------------|
| Clear positive | +1 | +1 | Baseline "good" trade |
| Clear negative | -1 | -1 | Baseline "bad" trade |
| Mixed signals | +1 | -1 | Tests nuanced scoring |
| Neutral | 0 | 0 | Tests "no signal" case |
| Edge case: implied negative | -1 | 0 | "Didn't chase, but didn't wait either" |
| Edge case: self-aware | 0 | -1 | "Knew better but did it anyway" |

**Example construction guidelines:**

1. **Use real trading vocabulary** — include terms like FOMO, revenge, tilt, confirmation, retest, stop hunt
2. **Vary description length** — some brief (25 words), some detailed (75 words)
3. **Mix P&L signals** — wins and losses across all examples
4. **Include ambiguous cases** — at least one where a human might debate the score

**Example rotation:**
- Review scoring accuracy monthly
- Replace examples that consistently produce wrong scores
- Add new examples to cover edge cases discovered in production
- Maintain 4-6 examples — more doesn't improve accuracy

---

## From Data Analytics SME

### Question 7: Insights Data Format

**Context:** The data analytics analysis discusses dashboard data requirements and real-time updates.

**Question:** What data format should be passed to the insights generation agent — raw trade records with all fields, pre-aggregated session statistics, or a structured combination? Should the agent receive the data as a JSON object or as a formatted text summary?

**Answer:**

**Recommended: Structured JSON with both raw records and aggregated stats.**

This provides the best balance of detail and efficiency for the LLM:

```json
{
  "session_summary": {
    "total_trades": 7,
    "total_pnl": 340,
    "win_count": 5,
    "loss_count": 2,
    "win_rate": 0.71,
    "discipline_sum": 2,
    "agency_sum": 1,
    "session_duration_minutes": 45,
    "avg_trade_interval_minutes": 7
  },
  "trades": [
    {
      "sequence": 1,
      "timestamp": "2026-03-02T09:30:00Z",
      "direction": "long",
      "pnl": 120,
      "setup_description": "Waited for retest at support, entered on confirmation. Patient execution.",
      "discipline_score": 1,
      "agency_score": 1
    },
    {
      "sequence": 2,
      "timestamp": "2026-03-02T09:45:00Z",
      "direction": "short",
      "pnl": -85,
      "setup_description": "Chased the breakout, knew I shouldn't. FOMO.",
      "discipline_score": -1,
      "agency_score": -1
    }
    // ... remaining trades
  ],
  "recent_trends": {
    "last_3_discipline": [1, -1, 0],
    "last_3_agency": [1, -1, 0],
    "consecutive_losses": 0,
    "consecutive_wins": 2
  }
}
```

**Why JSON over text:**
- Structured data ensures no fields are missed
- LLM can easily reference specific fields (`trades[2].discipline_score`)
- Aggregated stats provide quick context without parsing all records
- JSON is more token-efficient than prose descriptions

**Why both raw + summary:**
- Summary gives immediate trend context
- Raw records enable detailed pattern analysis
- Recent trends field provides pre-computed signals for alert logic

---

### Question 8: Insights Regeneration Strategy

**Context:** Real-time dashboard updates need to balance freshness with performance.

**Question:** For real-time dashboard updates, should insights be regenerated after every trade, or should there be a debounce/throttle mechanism? What's the expected latency for insights generation?

**Answer:**

**Recommended: Regenerate after every trade, with debounce for rapid submissions.**

**Strategy:**

| Scenario | Behavior |
|----------|----------|
| Normal pace (<1 trade/min) | Generate insights immediately after each trade |
| Rapid pace (>1 trade/min) | Debounce 2-3 seconds after last trade |
| Same trade re-submitted | Skip regeneration (use cached) |

**Implementation:**

```python
async def on_trade_submitted(trade: Trade):
    # Cancel any pending generation
    cancel_pending_insights_generation()

    # Debounce rapid submissions
    await asyncio.sleep(2)  # Wait for potential rapid trades

    # Check if new trades arrived during debounce
    if no_new_trades_during_debounce():
        generate_insights()
```

**Expected latency:**
- Single trade session (1 trade): ~800ms-1200ms
- Growing session (5-10 trades): ~1000ms-1500ms
- Large session (20+ trades): ~1500ms-2000ms

**Rationale:**
- Each trade changes the behavioral trajectory
- Debouncing prevents wasteful regeneration during rapid logging
- Latency is acceptable because insights are async (non-blocking)
- Caching ensures stale data isn't shown — either new insights or loading state

---

### Question 9: Edge Case Handling for Small Sessions

**Context:** Early in a trading session, there may be insufficient data for pattern detection.

**Question:** How should the insights agent handle edge cases like sessions with only 1-2 trades (insufficient data for pattern detection)?

**Answer:**

**Implement tiered insight generation based on trade count:**

| Trade Count | Insight Type | Example Output |
|-------------|--------------|----------------|
| 0 | Welcome/Setup | "Ready to trade. Enter your first trade to begin tracking." |
| 1 | Initial assessment | "First trade complete. Starting to build your session pattern." |
| 2-4 | Early patterns | "2 wins so far. Watch for early discipline trends as session develops." |
| 5-9 | Meaningful patterns | "Your discipline is improving (3 consecutive +1 scores)." |
| 10+ | Full analysis | Comprehensive behavioral analysis with trends |

**Recommended prompts by session size:**

**1 trade:**
```
Given a session with 1 trade:
- Acknowledge the trade and outcome
- Note it's too early for patterns
- Encourage continued logging
- Do NOT generate behavioral insights
```

**2-4 trades:**
```
Given a session with 2-4 trades:
- Focus on immediate observations ("winning early")
- Note session is developing
- Avoid trend declarations (not enough data)
- Keep insight brief (1 sentence)
```

**5+ trades:**
```
Given a session with 5+ trades:
- Analyze trends and patterns
- Identify behavioral trajectories
- Provide actionable observations
- Check for dangerous patterns (tilt risk)
```

**UI handling:**
- Early session: Show encouraging message, not "insights"
- 5+ trades: Transition to full insights panel
- Never show false confidence in early sessions

---

## Summary

| Question | Answer Summary |
|----------|----------------|
| Q1: Prompt calibration | 3-4 few-shot examples with diverse score combinations |
| Q2: Zero score retry | Tiered retry → flag for prompt adjustment after 3 consecutive zeros |
| Q3: Token budget | ~1500 tokens total, generate async after trade commit |
| Q4: Confidence handling | Yes, add confidence field. Default to 0 when uncertain. |
| Q5: Async insights | Yes, generate async. Show loading state while generating. |
| Q6: Few-shot examples | 4-6 diverse examples covering all score combinations |
| Q7: Data format | Structured JSON with both raw records + aggregated stats |
| Q8: Regeneration | Generate after each trade with 2-second debounce for rapid submissions |
| Q9: Small sessions | Tiered approach based on trade count, no insights for <5 trades |

---

*Answers prepared by: AI/NLP SME*
*Date: 2026-03-02*
