# Insights Agent

The Insights Agent generates behavioral insights from trading session data, combining rule-based detection with LLM analysis.

## Overview

The insights agent:
1. Analyzes trade data for behavioral patterns
2. Detects risk conditions (tilt, overconfidence, fatigue)
3. Identifies positive patterns (streaks, recovery)
4. Generates AI-powered insights for sessions with 10+ trades

## Tiered Approach

| Trade Count | Approach |
|-------------|----------|
| 0-1 | Encouraging messages |
| 2-4 | Early pattern messages |
| 5-9 | Rule-based insights only |
| 10+ | Full LLM + rule-based analysis |

## Rule-Based Detection

### Risk Detection (Tier 1)

**Tilt Risk** (FR 5.5.1)
- Trigger: 2+ consecutive losses with discipline -1
- Action: Warning message

**Overconfidence** (FR 5.5.2)
- Trigger: 3+ consecutive wins with +1 discipline
- Action: Warning message

**Session Fatigue** (FR 5.5.3)
- Trigger: 90+ minutes with declining discipline
- Action: Warning message

### Pattern Detection (Tier 2)

**Discipline Trajectory** (FR 5.5.4)
- Trigger: 3 consecutive discipline -1 scores
- Action: Info message

**Agency Breakdown** (FR 5.5.5)
- Trigger: Most recent trade has agency -1
- Action: Info message

### Positive Patterns (Tier 3)

**Streak Recognition** (FR 5.5.6)
- Trigger: 3+ consecutive wins OR 3+ disciplined trades
- Action: Success message

**Recovery Pattern** (FR 5.5.7)
- Trigger: Loss followed by win with positive discipline
- Action: Success message

## LLM Analysis

For sessions with 10+ trades, the agent calls OpenAI GPT-4 to generate behavioral insights:

```python
INSIGHTS_SYSTEM_PROMPT = """You are a trading psychology expert AI assistant.
Analyze the trading session data provided and generate behavioral insights.

# Your Task
Generate 2-4 actionable insights about the trader's behavior patterns,
emotional state, and decision-making quality.

# Required Output Fields
- category: "risk", "pattern", or "positive"
- message: 1-2 sentence actionable insight (max 500 chars)
- severity: "warning", "info", or "success"
"""
```

## Response Schema

```python
class Insight(BaseModel):
    category: Literal["risk", "pattern", "positive"]
    message: str  # max 500 chars
    severity: Optional[Literal["warning", "info", "success"]]

class InsightsResponse(BaseModel):
    insights: list[Insight]  # max 3
    generated_at: str  # ISO timestamp
    trade_count: int
```

## Caching

Insights are cached to reduce LLM calls:

- Cache key: session ID
- Invalidation: New trade added to session
- TTL: Configurable (default: session duration)

See: `/backend/src/agent/workflows/insights_caching.py`

## Timing Rules

| Session Duration | Insight Type |
|-----------------|--------------|
| < 5 trades | Encouraging message only |
| 5-9 trades | Rule-based (max 3 insights) |
| 10+ trades | LLM + rule-based (max 3 insights) |

## Warning Level Thresholds

Frontend displays warnings based on consecutive violations:

| Consecutive -1 Scores | Warning Level |
|-----------------------|---------------|
| 0-2 | None |
| 3 | Amber |
| 4+ | Orange |

See: `useBehavioralWarnings` hook in [Frontend Hooks](./frontend/hooks.md)

## Related Documentation

- [Insights API Endpoints](./api/insights.md)
- [InsightsPanel Component](./frontend/components.md)
- [Frontend Hooks](./frontend/hooks.md)
