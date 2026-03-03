# AI/NLP Architecture SME Analysis: Aurelius Ledger

## Executive Summary

This analysis addresses the AI/NLP architecture considerations for the Aurelius Ledger project, focusing on the trade extraction agent, insights generation, and integration with the established tech stack (FastAPI + LangGraph + LangChain + OpenAI + CopilotKit).

---

## Question 1: Optimal Prompt Structure for Trade Extraction

### Prompt Architecture Recommendation

**Recommended Structure: Hybrid Few-Shot with Structured Output**

The optimal prompt structure combines:
1. **System prompt with 3-5 curated few-shot examples** demonstrating the expected input/output format
2. **Explicit field definitions with decision criteria** for each extracted field
3. **Output schema specified via JSON Schema** (leveraging OpenAI's structured output capability)

### Few-Shot Example Count: 3-4 Examples

**Why 3-4 examples:**
- **Minimum effective**: 2-3 examples cover the main variance patterns (win, loss, breakeven)
- **Optimal balance**: 3-4 examples capture the key behavioral signals without overfitting
- **Token efficiency**: More examples increase latency and cost without proportional accuracy gains

**Example selection strategy:**
1. Clear winner with explicit discipline signals ("waited for confirmation, rode the bounce, +$340")
2. Clear loss with discipline signals ("stayed patient on the short, stopped out cleanly, -$120")
3. Loss with undisciplined signals ("chased the breakout, FOMO'd in, -$85")
4. Ambiguous case with neutral scores ("took the trade at resistance, exited at market, +$45")

### Handling Ambiguous P&L

**Recommended approach: Tiered fallback strategy**

| Signal Quality | P&L Inference | Confidence Level |
|----------------|---------------|-------------------|
| Explicit dollar amount | Use exact value | High |
| Relative terms ("small winner", "big loss") | Estimate based on typical position sizes or session average | Medium |
| Direction + outcome only | Use placeholder with flag for review | Low |
| No P&L signal | Return error (required field per HLRD) | N/A |

**Implementation note**: For relative terms like "small winner", the agent should:
1. Check for any positional context (e.g., "0.5 lot", "10 contracts") to estimate
2. Default to a configurable small amount (e.g., $50 for "small winner") with a `pnl_confidence: "low"` field
3. Ensure the trade is not persisted without human verification if confidence is low

**Alternative consideration**: Use a secondary "estimation" prompt that asks the LLM to quantify relative P&L terms, then validate against typical session ranges. This adds latency (~300ms) but improves accuracy for ambiguous cases.

### Detailed Prompt Structure

```
SYSTEM PROMPT:
You are a trade extraction assistant for a futures trader. Your task is to parse natural language
trade descriptions and extract structured data.

## Output Schema
{JSON_SCHEMA_HERE}

## Field Extraction Guidelines

### direction
- "long" if the trader bought/went long
- "short" if the trader sold/went short
- Default: error if undeterminable

### outcome
- "win" if pnl > 0
- "loss" if pnl < 0
- "breakeven" if pnl == 0 or explicitly stated

### pnl
- Extract as positive for wins, negative for losses
- If dollar amount present: use exact value
- If relative term ("small winner", "nice profit", "small loss"): estimate based on context
- If no P&L signal: return error (required field)

### discipline_score
- +1: "waited for", "held for", "patient", "planned", "stuck to thesis"
- -1: "chased", "FOMO'd", "revenge", "overtraded", "impulsive"
- 0: ambiguous or no behavioral signals

### agency_score
- +1: intentional execution, followed plan, deliberate entry
- -1: "knew better", "against my rules", "couldn't help it", reactive trading
- 0: ambiguous or no agency signals

## Few-Shot Examples

[INSERT 3-4 EXAMPLES HERE]

## Instructions
- Always output valid JSON matching the schema exactly
- If required fields cannot be determined, return an error object with "error" key
- Do not fabricate data
```

---

## Question 2: Single LLM Call vs. LangGraph Node with Validation

### Recommendation: LangGraph Node with Validation + Retry

**Architecture: LangGraph agent with structured output and schema validation**

Given the tech stack (FastAPI + LangGraph + LangChain + OpenAI), I recommend implementing extraction as a **LangGraph node** rather than a direct LLM call for the following reasons:

### Rationale

1. **Schema enforcement**: LangChain's `with_structured_output()` combined with Pydantic validation ensures the output conforms to the required schema before database insertion.

2. **Retry capability**: Schema mismatches can occur due to:
   - Model hallucination (returning fields not in schema)
   - Malformed JSON from parsing errors
   - Edge cases in extraction logic

3. **Graceful error handling**: A LangGraph node can implement conditional logic:
   - Valid output -> proceed to database write
   - Invalid output -> retry up to N times with modified prompt
   - Persistent failure -> surface error to user without partial write

4. **Observability**: LangGraph's checkpointer allows tracing extraction attempts, which is valuable for debugging and improving the extraction accuracy over time.

### Implementation Architecture

```
[Trade Input]
     |
     v
[Extract Trade Node] --> LLM with structured output (Pydantic schema)
     |
     v
[Validate Schema Node] --> Check all required fields present
     |
     v
[Retry Logic] --> Max 2 retries with error context in prompt
     |
     v
[Success: Continue to DB Write]  OR  [Failure: Return Error]
```

### Code Structure (Tech Stack Aligned)

```python
# Using LangChain with structured output
from langchain_openai import ChatOpenAI
from pydantic import BaseModel
from typing import Literal

class TradeExtraction(BaseModel):
    direction: Literal["long", "short"]
    outcome: Literal["win", "loss", "breakeven"]
    pnl: float
    setup_description: str
    discipline_score: Literal[-1, 0, 1]
    agency_score: Literal[-1, 0, 1]

# LangGraph node implementation
extract_node = llm.with_structured_output(TradeExtraction)
```

### Trade-offs

| Aspect | Single LLM Call | LangGraph Node + Validation |
|--------|-----------------|------------------------------|
| Latency | ~500ms | ~700ms (validation + potential retry) |
| Reliability | Lower (no retry) | Higher (automatic retry) |
| Complexity | Simpler | More components |
| Cost | Lower (1 call) | Higher (1-3 calls) |
| Debugging | Harder | Easier with checkpointer |

**Conclusion**: The 3-second latency requirement can be met with the LangGraph approach (typical extraction runs in 500-700ms), and the reliability gains outweigh the minor cost increase. The HLRD explicitly requires "valid, schema-conformant JSON response or surface a recoverable error" — the LangGraph approach directly enables this.

---

## Question 3: Insights Agent Context and Streaming

### Recommendation: Both Raw Records + Aggregated Stats, Non-Streamed Block

### Context Strategy: Pass Both Raw Records and Aggregated Stats

**Rationale:**

1. **Raw trade records** provide:
   - Individual setup descriptions for pattern analysis
   - Behavioral signals (discipline/agency scores per trade)
   - Temporal sequence for trajectory analysis

2. **Aggregated session stats** provide:
   - Quick context for the LLM (total P&L, win rate)
   - Summary metrics without parsing all records
   - Score trends (running sums visible at a glance)

**Recommended payload structure:**

```python
insights_request = {
    "session_summary": {
        "total_trades": int,
        "total_pnl": float,
        "win_count": int,
        "loss_count": int,
        "breakeven_count": int,
        "discipline_sum": int,
        "agency_sum": int,
        "win_rate": float
    },
    "trades": [
        {
            "timestamp": "ISO8601",
            "direction": "long|short",
            "outcome": "win|loss|breakeven",
            "pnl": float,
            "setup_description": str,
            "discipline_score": -1|0|1,
            "agency_score": -1|0|1
        }
        # ... all trades in session
    ]
}
```

### Streaming vs. Block Return: Block Return

**Recommendation: Complete block return (not streamed)**

**Rationale:**

1. **Latency constraint**: The 3-second end-to-end requirement already includes insights generation. Streaming would require maintaining an open connection and delivering partial updates, adding complexity without significant UX benefit.

2. **Insight coherence**: AI-generated insights are most valuable as a cohesive analysis, not as incremental fragments. A mid-stream insight (e.g., "your discipline is improving...") before seeing all trades would be premature.

3. **UI simplicity**: Displaying a complete insights block is straightforward. Streaming would require frontend state management for partial content.

4. **Token efficiency**: Streaming doesn't save tokens — the full insight is generated regardless.

**Exception consideration**: If the insights generation exceeds 2 seconds, consider:
- Generating insights asynchronously after trade submission
- Showing "Analyzing..." state while generating
- Returning cached insights until new analysis completes

This is acceptable because the HLRD states "Trade entry to dashboard update must complete in under 3 seconds" — the dashboard should update with the trade data immediately, while insights can load asynchronously.

---

## Domain-Specific Recommendations

### 1. Extraction Accuracy Optimization

**Implement confidence scoring:**

Add a `confidence` field to the extraction output:
```python
class ExtractionResult(BaseModel):
    # ... existing fields
    confidence: Literal["high", "medium", "low"]
    extraction_notes: str | None  # Explain ambiguous decisions
```

This enables:
- Flagging trades for manual review when confidence is low
- Building a dataset for future prompt refinement
- Providing transparency to the trader about extraction certainty

### 2. Error Recovery Strategy

**Structured error handling for extraction failures:**

| Error Type | Handling |
|------------|----------|
| Schema mismatch | Retry with explicit schema reminder in prompt |
| Missing required field | Retry with field-specific prompting |
| P&L undeterminable | Surface error, allow manual entry |
| LLM timeout | Retry once, then error |

### 3. Latency Optimization

**For the 3-second requirement:**

1. **Use gpt-4o-mini or gpt-4o** (not o1 or o3) for extraction — faster for simple structured tasks
2. **Cache the insights result** — regenerate only after new trade, not on every dashboard refresh
3. **Pre-warm the LLM connection** — keep the model "warm" between trades
4. **Parallel execution** — run extraction and dashboard update in parallel where possible

### 4. Behavioral Score Calibration

**Consider adding calibration prompts:**

- Periodically ask the trader if the automated scores feel accurate
- Use feedback to adjust the scoring heuristics in the prompt
- This addresses the success criterion: "Discipline and agency scores feel fair and consistent to the trader"

### 5. Cost Management

**Token budget for extraction:**
- System prompt: ~800 tokens
- Few-shot examples: ~400 tokens (3-4 examples)
- User input: Variable (~100-300 tokens typical)
- Output: ~150 tokens
- **Total per extraction**: ~1,500 tokens (~$0.003 with gpt-4o-mini)

**Token budget for insights:**
- Session context: ~500 tokens (5 trades)
- System prompt: ~600 tokens
- **Total per insight**: ~1,100 tokens (~$0.002)

---

## Questions for Other SMEs

### For Behavioral Psychology SME:

1. **Discipline/agency scoring calibration**: The current scoring schema (-1, 0, +1) is simple, but are there common trading behaviors that might be misclassified? For example, "scaling out" or "adding to a position" — should these be neutral, positive, or negative signals?

2. **Insight actionability**: What specific behavioral patterns would be most valuable to surface in the AI insights panel? Should the system warn about specific risk factors (e.g., "tilt risk elevated" based on recent loss streak)?

3. **Score trajectory interpretation**: If a trader's discipline score starts positive and trends negative over a session, what interventions or insights would be most helpful? Is a warning appropriate, or would that be counterproductive during active trading?

### For Data Analytics SME:

1. **Dashboard real-time updates**: What's the recommended approach for handling rapid trade submissions (e.g., a trader logging multiple trades quickly)? Should updates be debounced, or is immediate refresh acceptable?

2. **Chart visualization for scores**: The requirements specify "running sum" for discipline and agency. Would a moving average or trend line be more informative? Should the charts show individual trade scores alongside the running sum?

3. **Insights caching strategy**: Since insights are regenerated after each trade, what's the recommended cache invalidation strategy? Should insights be cached by trade count (e.g., regenerate only when trade count changes)?

---

## Summary of Recommendations

| Decision | Recommendation | Rationale |
|----------|----------------|-----------|
| Few-shot count | 3-4 examples | Optimal balance of coverage and token efficiency |
| Ambiguous P&L handling | Tiered fallback with confidence flag | Addresses requirement without blocking valid trades |
| Extraction architecture | LangGraph node with validation | Enables retry, meets schema requirement, observability |
| Insights context | Both raw + aggregated | Provides both detail and summary for best analysis |
| Insights delivery | Block return (non-streamed) | Coherence, simplicity, meets latency requirement |

---

## References

- Tech Stack: FastAPI + LangGraph + LangChain + OpenAI + CopilotKit
- Latency Requirement: <3 seconds end-to-end
- Schema Requirement: Valid JSON or recoverable error (no silent partial writes)
