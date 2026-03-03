# AI/NLP SME Analysis: Aurelius Ledger

## Executive Summary

This analysis addresses three core AI/NLP architecture questions for the Aurelius Ledger trade extraction system. Given the established tech stack (FastAPI, LangGraph, CopilotKit, OpenAI), I recommend a LangGraph-based extraction pipeline with structured output, Pydantic validation, and carefully curated few-shot examples. For insights generation, a hybrid context approach with complete-block return provides the best balance of latency and quality.

---

## Question 1: Optimal Prompt Structure for Trade Extraction

### Recommendation: Few-Shot Examples with 3-5 Diverse Examples

**Prompt Structure:**

```
SYSTEM PROMPT:
- Role definition with domain context
- Output schema with field descriptions and validation rules
- Decision criteria for ambiguous cases
- Few-shot examples (3-5) covering edge cases
- Error handling instructions

USER PROMPT:
- Raw trade description text
```

**Why 3-5 Examples:**

- **3 examples** is the minimum for teaching pattern recognition in extraction tasks
- **5 examples** provides good coverage without bloating context or overwhelming the model's pattern matching
- More than 5 examples shows diminishing returns and increases token cost
- Examples should span: clear wins, clear losses, ambiguous P&L, discipline/agency edge cases

**Example Prompt Structure:**

```python
TRADE_EXTRACTION_SYSTEM_PROMPT = """You are a trading journal assistant. Your task is to extract structured data from natural language trade descriptions.

## Output Schema
{
    "direction": "long" | "short",  # Required - must be inferred
    "outcome": "win" | "loss" | "breakeven",  # Inferred from P&L or explicit language
    "pnl": number,  # Dollar value, positive = win, negative = loss
    "setup_description": string,  # Natural language summary
    "discipline_score": -1 | 0 | 1,  # 1=disciplined, -1=undisciplined, 0=ambiguous
    "agency_score": -1 | 0 | 1  # 1=intentional, -1=reactive, 0=ambiguous
}

## Scoring Guidelines

### Discipline Score
- +1: "waited for confirmation", "patient entry", "followed my plan", "stayed disciplined"
- -1: "chased", "fomo'd", "didn't wait", "impulsive entry", "revenge trade"
- 0: No clear discipline signal or mixed signals

### Agency Score
- +1: "intentional", "decided to", "chose to", "my call"
- -1: "revenge trade", "knew better but couldn't help it", "失控" (lost control)
- 0: No clear agency signal

## P&L Handling
- Exact dollar amounts: Use as stated
- "Small winner/loser": Estimate $50-$100 for "small", $100-$200 for "moderate"
- "Nice win/big loss": Estimate $200-$500 for "nice", $500+ for "big"
- Explicit language "won $X" or "lost $X": Use exact or estimated based on context
- NO P&L stated: Return error - P&L is required

## Few-Shot Examples

Example 1:
Input: "Took NQ long at 17850, waited for the pullback to confirm, hit my target at 17900 for a $500 win. Felt good about following my plan."
Output: {"direction": "long", "outcome": "win", "pnl": 500, "setup_description": "NQ long at 17850, waited for pullback confirmation", "discipline_score": 1, "agency_score": 1}

Example 2:
Input: "Chased ES short at 5120, got stopped out for $200 loss. FOMO trade, knew better."
Output: {"direction": "short", "outcome": "loss", "pnl": -200, "setup_description": "ES short at 5120", "discipline_score": -1, "agency_score": -1}

Example 3:
Input: "Small winner on crude, $75 profit on long"
Output: {"direction": "long", "outcome": "win", "pnl": 75, "setup_description": "Long crude", "discipline_score": 0, "agency_score": 0}

## Error Handling
If required fields cannot be determined, return error with specific missing information.
"""
```

**Handling Ambiguous P&L:**

The prompt should include explicit heuristics for common ambiguous phrases:

| Phrase | Estimated P&L |
|--------|---------------|
| "small winner" | $50-$100 |
| "small loser" | -$50 to -$100 |
| "nice win" | $200-$500 |
| "big loss" | -$500+ |
| "breakeven" / "scratched" | $0 |
| "mixed" / "mediocre" | $25-$50 (positive) or -$25 to -$50 (negative) based on context |

**Trade-off Analysis:**

| Approach | Pros | Cons |
|----------|------|------|
| Zero-shot (no examples) | Lower tokens, faster | Lower accuracy on edge cases |
| 3-5 examples (recommended) | Good coverage, reasonable cost | Requires maintenance as edge cases emerge |
| 10+ examples | High accuracy | Token bloat, diminishing returns, slower |

---

## Question 2: Single Structured Call vs. LangGraph with Validation

### Recommendation: LangGraph Node with Validation Step

**Architecture:**

```
[Trade Input] --> [LLM Extraction Node] --> [Pydantic Validation Node] --> [Database Write]
                      |                           |
                      v                           v
              (Structured Output)          (Retry on failure)
                       |
                       v
              [Error Handler Node]
```

**Implementation:**

```python
# LangGraph node for trade extraction
from langgraph.graph import StateGraph
from pydantic import BaseModel, Field, field_validator
from typing import Literal

class TradeExtraction(BaseModel):
    direction: Literal["long", "short"]
    outcome: Literal["win", "loss", "breakeven"]
    pnl: float = Field(description="Dollar P&L, positive for wins")
    setup_description: str
    discipline_score: Literal[-1, 0, 1]
    agency_score: Literal[-1, 0, 1]

def extract_trade_node(state: TradeState) -> TradeState:
    """LangGraph node that calls LLM with structured output."""
    response = llm.with_structured_output(TradeExtraction).invoke([
        {"role": "system", "content": TRADE_EXTRACTION_SYSTEM_PROMPT},
        {"role": "user", "content": state["trade_description"]}
    ])
    return {"extracted_trade": response}

def validate_trade_node(state: TradeState) -> TradeState:
    """Validation node - retries on schema mismatch."""
    try:
        extraction = state["extracted_trade"]
        # Additional business logic validation
        if extraction.pnl == 0 and extraction.outcome not in ["breakeven", "win", "loss"]:
            raise ValueError("Zero P&L requires explicit outcome")
        return {"validation_passed": True, "trade": extraction}
    except Exception as e:
        # Retry up to 2 times
        if state.get("retry_count", 0) < 2:
            return {"retry_count": state.get("retry_count", 0) + 1}
        return {"validation_passed": False, "error": str(e)}
```

**Why LangGraph with Validation:**

| Factor | Single Call | LangGraph + Validation |
|--------|-------------|------------------------|
| Schema Enforcement | Good (with structured output) | Excellent (double validation) |
| Retry on Failure | Requires manual handling | Built-in retry logic |
| Error Recovery | Manual | Graph-based conditional edges |
| Latency | Lower (single API call) | Slightly higher (may retry) |
| Debugging | Harder to trace | Clear node execution flow |
| Extensibility | Limited | Can add more nodes easily |

**Specific Benefits for This Use Case:**

1. **Schema Mismatch Recovery**: If the LLM returns invalid JSON or schema violations, the validation node can trigger a retry with different prompts
2. **Graceful Degradation**: Can add fallback nodes for different error types
3. **Observability**: Each node execution can be logged for debugging extraction failures
4. **Future Extensibility**: Easy to add sentiment analysis, setup classification, or other nodes without restructuring

**Retry Strategy:**

- Maximum 2 retries on validation failure
- On final failure, surface clear error to user: "Could not extract trade details. Please provide more specific information."
- Log failed extractions for analysis and prompt refinement

---

## Question 3: Insights Agent Context and Streaming

### Recommendation: Hybrid Context with Complete Block Return

**Context Strategy:**

Pass **both** raw trade records AND aggregated session stats to the insights agent:

```python
INSIGHTS_SYSTEM_PROMPT = """You are a trading psychology expert. Analyze the current trading session and provide actionable insights.

## Session Statistics (Aggregated)
- Total P&L: ${total_pnl}
- Win Rate: {win_rate}%
- Total Trades: {trade_count}
- Discipline Score: {discipline_score}/10
- Agency Score: {agency_score}/10
- Recent Trend: {discipline_trend}

## Individual Trades (Raw Data)
{trade_list}

## Your Task
Generate 3-5 actionable insights that:
1. Identify behavioral patterns (discipline, agency trends)
2. Note setup consistency or variance
3. Flag potential tilt or emotional trading
4. Provide specific, non-generic recommendations

Format as bullet points, keep under 150 words.
"""
```

**Why Hybrid Context:**

| Context Type | What It Provides | Limitation |
|-------------|-------------------|------------|
| Raw Records Only | Individual trade details | No session-level pattern visibility |
| Aggregated Stats Only | High-level trends | Loses behavioral nuance from descriptions |
| **Both (Recommended)** | Full picture | Slightly more tokens |

**Streamed vs. Complete Block:**

| Approach | Pros | Cons |
|----------|------|------|
| Streamed | Perceived faster, engaging | Complicated UI, potential for partial/incomplete insights |
| Complete Block | Simpler UI, full context for quality | Must wait for complete generation |

**Recommendation: Complete Block Return**

For this use case, complete block return is preferable because:

1. **Latency Requirement**: The 3-second SLA is achievable with complete return (insights can be generated asynchronously after trade is logged)
2. **Quality over Perceived Speed**: Partial insights that get overwritten are confusing; complete insights are more useful
3. **UI Simplicity**: Streaming requires managing partial state, which adds complexity
4. **Asynchronous Generation**: Insights can be regenerated after trade write completes, with the old insights showing until new ones are ready

**Implementation Pattern:**

```python
async def generate_insights(trades: list[Trade], session_stats: SessionStats) -> str:
    """Generate insights after trade is persisted."""
    context = build_insights_context(trades, session_stats)
    response = llm.invoke(INSIGHTS_SYSTEM_PROMPT.format(**context))
    return response.content

# Called asynchronously after successful trade write
# Frontend polls or receives WebSocket update when ready
```

---

## Cross-Cutting Architecture Considerations

### Latency Optimization

For the 3-second end-to-end SLA:

1. **Extraction**: Use `gpt-4o-mini` or `gpt-4o` with structured output (fast model, ~500ms)
2. **Parallel Operations**: Write trade to DB and generate insights in parallel
3. **Caching**: Cache session stats in memory; regenerate insights only on new trade
4. **Timeout Handling**: Set 2.5s timeout on extraction, fail gracefully with user-facing error

### Error Handling Strategy

| Error Type | User Feedback | Recovery |
|------------|---------------|----------|
| Extraction failure | "Could not understand trade. Try being more specific." | Retry with prompt adjustment |
| Validation failure | "Missing required info. Did you include P&L?" | Specific field request |
| DB write failure | "Trade saved but couldn't generate insights. Try refreshing." | Partial success state |
| LLM timeout | "System busy. Try again." | Retry with exponential backoff |

### Cost Optimization

- **Extraction**: Use structured output with `gpt-4o-mini` (cheaper, faster)
- **Insights**: Use cached context; regenerate only on new trades
- **Token Management**: Limit few-shot examples to 5; use concise field descriptions

---

## Questions for Other SMEs

### For Behavioral Psychology SME:

1. **Discipline/Agency Scoring**: Are the scoring heuristics I defined aligned with trading psychology principles? Specifically:
   - Does "waited for confirmation" universally indicate discipline, or are there scenarios where patience could be weakness (analysis paralysis)?
   - How should we handle cases where discipline and agency conflict (e.g., "stuck to my plan even though I knew it was wrong")?

2. **Insights Actionability**: What behavioral patterns should take priority in the insights? Should we flag tilt risk based on:
   - Consecutive losses?
   - Discipline score dropping below threshold?
   - Agency score trend (becoming more reactive)?

3. **Edge Case Handling**: How should we interpret self-deprecating language like "I probably got lucky there" - does it indicate low agency or just trader humility?

### For Data Analytics SME:

1. **Dashboard Layout**: For a trader during live sessions, what is the optimal chart arrangement? Should P&L be prominent with scores as secondary, or should behavioral metrics be equally visible?

2. **Real-Time Updates**: Should charts animate/transition smoothly when new data arrives, or is instant update preferable for "at a glance" assessment during fast markets?

3. **Insight Display**: Where in the UI should insights appear? A persistent sidebar takes space but provides constant reference; a collapsible panel keeps UI clean but requires action to view.

---

## Summary of Recommendations

| Decision | Recommendation | Rationale |
|----------|----------------|-----------|
| Few-shot count | 3-5 examples | Balance of coverage and token cost |
| Ambiguous P&L | Heuristic mapping in prompt | Clear rules, consistent estimates |
| Extraction architecture | LangGraph with validation | Retry capability, extensibility, observability |
| Insights context | Both raw + aggregated | Full behavioral picture |
| Insights delivery | Complete block | Simpler UI, quality over perceived speed |
| Model selection | gpt-4o-mini for extraction | Speed + cost optimization |

---

*Analysis prepared for Phase 1 of the Aurelius Ledger requirements elaboration workflow.*
