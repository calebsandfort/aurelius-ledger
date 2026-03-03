# AI/NLP SME Answers: Phase 2 Cross-SME Consultation

*Answers to questions posed by Behavioral Psychology SME and Data Analytics SME*

---

## Answers to Behavioral Psychology SME Questions

### 1. Extraction Reliability: Confidence Threshold

**Recommendation: Dual-Threshold Approach with Confidence Banding**

The LLM should return both a score (-1, 0, 1) AND a confidence value (0.0-1.0). Implement a tiered confidence threshold system:

| Confidence Level | Threshold Range | System Behavior |
|-----------------|-----------------|-----------------|
| **High Confidence** | 0.85-1.0 | Display score normally, use in all aggregations |
| **Medium Confidence** | 0.60-0.84 | Display score with subtle indicator, include in aggregations but flag in logs |
| **Low Confidence** | 0.00-0.59 | Display as "unclear" or "insufficient signal", exclude from rolling averages to prevent noise |

**Implementation in Extraction Prompt:**

```
## Confidence Scoring
For each discipline_score and agency_score, also rate your confidence:
- High (0.85-1.0): Clear behavioral signal, unambiguous language
- Medium (0.60-0.84): Some behavioral signal but room for interpretation
- Low (0.00-0.59): No clear behavioral signal, ambiguous or neutral language

Return format: {"discipline_score": 1, "discipline_confidence": 0.92, "agency_score": 0, "agency_confidence": 0.45}
```

**User-Facing Behavior:**
- High/Medium confidence: Score displayed normally with normal weight in insights
- Low confidence: Show "—" or "insufficient signal" instead of a score; exclude from discipline/agency trend calculations to prevent contaminating the signal with noise

**Rationale:** This addresses the Behavioral Psychology SME's concern about the "default-to-zero problem." A score of 0 with 0.92 confidence is meaningfully different from 0 with 0.35 confidence. The system should track this distinction without burdening the user.

---

### 2. Temporal Context in Insights

**Recommendation: Hybrid Window with Recency Weighting**

Include both recent trades (full detail) AND aggregated stats from the full session. The optimal context window is:

| Session Phase | Recent Trades (Full Detail) | Aggregated Stats |
|--------------|----------------------------|------------------|
| Early (1-3 trades) | All trades | Session just starting - minimal aggregation value |
| Mid (4-10 trades) | Last 5 trades | Full session stats meaningful |
| Late (10+ trades) | Last 7 trades | Full session + trend indicators |

**Prompt Context Structure:**

```
## Session Summary (Full Session)
- Total P&L: $X
- Win Rate: X%
- Trade Count: X
- Average Discipline Score: X.X
- Average Agency Score: X.X
- Consecutive Losses: X
- Session Duration: X hours

## Recent Trades (Last 7, Full Detail)
Trade 1: [timestamp] - [direction] [outcome] $[pnl] - [setup] - discipline: [score] agency: [score]
Trade 2: ...
[... continues for 7 trades]

## Trend Indicators
- Discipline Trajectory: [improving/stable/declining]
- Agency Trajectory: [improving/stable/declining]
- Tilt Risk: [low/medium/high]
```

**Why 7 Recent Trades:**
- Captures the recency effect (most influential on emotional state)
- Fits comfortably in context window with session summary
- Provides enough pattern data for the LLM to identify recent behavioral shifts
- Avoids overwhelming the model with older trades that have diminishing relevance

**Key Point:** The LLM should WEIGHT recent trades more heavily in its analysis. Explicitly instruct: "Recent trades (last 7) should carry more weight in your behavioral analysis than earlier trades."

---

### 3. Linguistic Pattern Detection

**Recommendation: Multi-Layer Extraction with Explicit and Implicit Signals**

Yes, the model CAN detect subtler linguistic patterns. Configure the extraction to capture multiple layers:

**Layer 1: Explicit Keywords (Current)**
- "chased", "waited", "fomo", "revenge"
- Already captured via keyword matching

**Layer 2: Structural Signals (New)**
- Sentence length variance (short, clipped sentences may indicate emotional state)
- Use of first-person pronouns ("I", "my") vs. passive voice
- Hedging language ("maybe", "probably", "might have")
- Causal attributions ("because", "since", "so that")

**Layer 3: Emotional Valence (New)**
- Positive emotion words: "great", "awesome", "felt good"
- Negative emotion words: "frustrated", "annoyed", "mad"
- Self-deprecating language: "probably got lucky", "should have known"
- Over-justification: excessive explanation may indicate doubt

**Implementation in Extraction Prompt:**

```
## Extended Behavioral Analysis
Beyond explicit keywords, identify:

1. HEDGING LANGUAGE: Does the trader use tentative language?
   - High hedging: "I think maybe", "probably", "might"
   - Low hedging: "I decided", "I chose", "I knew"

2. CAUSAL ATTRIBUTION: How does the trader explain outcomes?
   - Internal agency: "I waited for confirmation" (high agency)
   - External attribution: "The market stopped me out" (lower agency)
   - Lucky framing: "Got lucky" (low agency signal)

3. EMOTIONAL VALENCE: What's the emotional tone?
   - Positive: "great", "awesome", "felt good"
   - Negative: "frustrated", "annoyed", "mad"
   - Neutral: purely descriptive

Return these as additional fields in your extraction.
```

**Risk Note:** The model may over-interpret. Include a caution: "When signals are ambiguous, default to neutral. Better to miss a subtle pattern than to falsely label normal language as emotional."

---

### 4. Insight Personalization vs. Privacy

**Recommendation: On-Device Personalization Without Federated Learning**

Federated learning is NOT appropriate for this use case. Here's why and what to do instead:

**Why Not Federated Learning:**
- Over-engineered: FL requires coordinating updates across many clients; this is a single-user local app
- Complexity: Implementing FL adds significant infrastructure overhead
- Privacy gain is minimal: The behavioral profiles being learned are already local

**Recommended Approach: Session-Based Context Without Persistent Profiles**

```
Privacy-Preserving Personalization Strategy:

1. SESSION-ONLY CONTEXT
   - All personalization happens within a single trading session
   - Insights are generated from current session data only
   - No cross-session behavioral profile stored

2. AGGREGATED METRICS ONLY
   - Store only anonymized metrics: discipline_score_avg, agency_score_avg, win_rate
   - These are numerical summaries, not narrative behavioral profiles
   - Cannot reconstruct individual's behavioral patterns from metrics alone

3. OPT-IN HISTORICAL CONTEXT (Future Enhancement)
   - If user wants long-term pattern analysis, store encrypted
   - Allow user to delete their data at any time
   - Never share or sell behavioral data

4. LOCAL PROCESSING
   - All LLM inference happens locally or via API without storing conversation context
   - No behavioral data sent to third parties
```

**What This Looks Like in Practice:**
- Each session starts fresh - insights don't carry over memory of past sessions
- The "personalization" comes from analyzing THIS session's patterns, not from comparing to historical behavior
- If we want to show "your discipline is improving" - compare current session's early vs. late trades, not to last week's data

**Privacy Trade-off:**
- Less personalized insights (can't say "compared to your typical Tuesday")
- Much stronger privacy guarantees
- Simpler architecture
- This is the right trade-off for a trading journal - users should own their data

---

### 5. Ambiguous P&L Handling

**Recommendation: Heuristic Mapping with User Confirmation Option**

For "small winner," "big loser," and similar vague descriptions:

**Primary Strategy: Heuristic Mapping with Confidence Flag**

| Implicit Phrase | Estimated P&L | Confidence Impact |
|---------------|---------------|-------------------|
| "small winner" | $50-$100 | Medium confidence |
| "small loser" | -$50 to -$100 | Medium confidence |
| "nice win" | $200-$500 | Medium confidence |
| "big loser" | -$500+ | Medium confidence |
| "breakeven" / "scratched" | $0 | High confidence |
| "barely scratched" | $0-$25 | Low confidence |
| "decimated" | -$1000+ | Low confidence (strong emotion, may not be literal) |
| "killed it" | $500+ | Low confidence (celebratory, not literal) |

**Fallback Logic Flow:**

```
1. Extract explicit dollar amount if present -> Use exact value, high confidence
2. No explicit amount but implicit phrase -> Apply heuristic, medium confidence, flag in UI
3. No amount and no phrase -> Return extraction error: "P&L amount required"
4. Model is uncertain between two values -> Return lower value, low confidence
```

**User Clarification Prompt:**

Instead of guessing and being wrong, surface the ambiguity to the user AFTER initial extraction:

```
Extraction Note: Your description included "small winner" which we've estimated as ~$75.
[Link: "Edit exact amount"] | [Confirm: "This is correct"]
```

This approach:
- Makes reasonable guesses for usability (so the system works with natural language)
- Is transparent about the estimate (user can correct)
- Flags low-confidence extractions for quality monitoring
- Doesn't block the workflow with "please provide exact amount"

---

## Answers to Data Analytics SME Questions

### 1. Implicit P&L Signals

**This is the same question as #5 above. See that answer for the full recommendation.**

**Additional Data Analytics Considerations:**

For the database schema, store the confidence alongside the P&L:

```sql
ALTER TABLE trades ADD COLUMN IF NOT EXISTS pnl_confidence FLOAT DEFAULT 1.0;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS pnl_is_estimated BOOLEAN DEFAULT FALSE;
```

**Query implications:**
- When calculating session P&L, you may want to exclude estimated P&L for tax purposes
- Add a filter: `WHERE pnl_is_estimated = FALSE` for precision reporting
- Keep estimated trades for behavioral analysis (discipline/agency scores are valid regardless)

---

### 2. Few-Shot Examples Diversity

**Recommendation: 5 Examples with Strategic Diversity**

Use exactly 5 few-shot examples covering these scenarios:

| Example # | Scenario | Purpose |
|-----------|----------|---------|
| 1 | Clear win with discipline | Establish baseline positive pattern |
| 2 | Clear loss with lack of discipline | Establish baseline negative pattern |
| 3 | Breakeven / $0 P&L | Edge case - no financial outcome |
| 4 | Ambiguous discipline/agency (0 scores) | Teach when to return neutral |
| 5 | Terse/minimal description | Handle the common "just the facts" input |

**Detailed Example Set:**

```
Example 1 - Clear Discipline + Win:
Input: "Took NQ long at 17850, waited for the pullback to confirm, hit my target at 17900 for a $500 win. Felt good about following my plan."
Output: {"direction": "long", "outcome": "win", "pnl": 500, "setup_description": "NQ long at 17850, waited for pullback confirmation", "discipline_score": 1, "discipline_confidence": 0.95, "agency_score": 1, "agency_confidence": 0.92}

Example 2 - Clear Lack of Discipline + Loss:
Input: "Chased ES short at 5120 after seeing it rip higher, got stopped out for $200 loss. FOMO trade, knew better."
Output: {"direction": "short", "outcome": "loss", "pnl": -200, "setup_description": "ES short at 5120 (chased)", "discipline_score": -1, "discipline_confidence": 0.94, "agency_score": -1, "agency_confidence": 0.88}

Example 3 - Breakeven:
Input: "Played NQ flat, scratched the trade at $0."
Output: {"direction": "flat", "outcome": "breakeven", "pnl": 0, "setup_description": "NQ flat - no position", "discipline_score": 0, "discipline_confidence": 0.98, "agency_score": 0, "agency_confidence": 0.98}

Example 4 - Ambiguous Discipline/Agency:
Input: "Took a small winner on crude, $75 profit."
Output: {"direction": "long", "outcome": "win", "pnl": 75, "setup_description": "Long crude", "discipline_score": 0, "discipline_confidence": 0.35, "agency_score": 0, "agency_confidence": 0.28}

Example 5 - Minimal Description:
Input: "Short ES. Lost 150."
Output: {"direction": "short", "outcome": "loss", "pnl": -150, "setup_description": "ES short", "discipline_score": 0, "discipline_confidence": 0.22, "agency_score": 0, "agency_confidence": 0.25}
```

**Key Diversity Principles:**

1. **Include the ambiguous case (Example 4):** This is critical for calibration. The model learns that "took a small winner" doesn't have enough signal for discipline/agency scoring.

2. **Include the minimal case (Example 5):** Many traders write terse descriptions. The model must handle this gracefully.

3. **Include breakeven explicitly (Example 3):** Zero P&L is different from no trade - the model needs to see this explicitly.

4. **Vary writing styles:**
   - Example 1: Verbose, emotional language
   - Example 2: Emotional but brief
   - Example 5: Minimal, almost telegraphic

5. **Include different directions:** Long, short, flat represented

**Do NOT Include:**
- Exact $0 P&L without "breakeven/scratched" language (too ambiguous)
- Extremely unusual scenarios (e.g., "traded crypto for the first time") - keep examples representative
- Multiple trades in one description - each example should be a single trade

---

## Summary of Key Recommendations

| Question | Recommendation |
|----------|----------------|
| Confidence Threshold | Dual output: score (-1/0/1) + confidence (0-1). Band into high/medium/low with different UI treatment. |
| Temporal Context | Hybrid: full session stats + last 7 trades with recency weighting instruction |
| Linguistic Patterns | Multi-layer: explicit keywords + structural signals (hedging, attribution) + emotional valence |
| Privacy/Personalization | Session-only context, no cross-session profiles, aggregated metrics only |
| Ambiguous P&L | Heuristic mapping + transparency + user correction option |
| Few-Shot Diversity | 5 examples: clear win, clear loss, breakeven, ambiguous, minimal |

---

*Answers prepared for Phase 2 of the Aurelius Ledger requirements elaboration workflow.*
