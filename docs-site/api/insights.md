# Insights API Endpoints

This document covers the insights API endpoint for retrieving AI-generated behavioral insights.

## Base URL

```
/api/v1/insights
```

All endpoints require authentication via session cookie.

## Endpoints

### GET /api/v1/insights

Returns behavioral insights for the current trading session.

**Authentication**: Required (session cookie)

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| session_id | string | no | Specific session ID to get insights for |

**Response (200)**:
```json
{
  "insights": [
    {
      "category": "risk",
      "message": "Tilt risk detected: 2+ consecutive losses with low discipline. Consider taking a break.",
      "severity": "warning"
    },
    {
      "category": "positive",
      "message": "Strong recovery! You bounced back well from a losing trade with good discipline.",
      "severity": "success"
    },
    {
      "category": "pattern",
      "message": "You're showing consistent discipline in your last 3 trades.",
      "severity": "info"
    }
  ],
  "generated_at": "2024-01-15T10:30:00.000Z",
  "trade_count": 5
}
```

**Insight Categories**:
- `risk`: Immediate risk alerts (tilt, overconfidence, fatigue)
- `pattern`: Behavioral pattern recognition
- `positive`: Positive reinforcement

**Insight Severity**:
- `warning`: Risk alert - take action
- `info`: Informational observation
- `success`: Positive reinforcement

## Small Session Behavior

Based on trade count, the insights system returns different responses:

| Trade Count | Behavior |
|-------------|----------|
| 0 | Welcome message |
| 1 | Encouraging message |
| 2-4 | Early patterns forming message |
| 5-9 | Rule-based insights only (no LLM) |
| 10+ | Full LLM analysis with rule-based insights |

## Caching

Insights are cached to avoid redundant generation. The caching mechanism:

- Stores generated insights per session
- Invalidates on new trade submissions
- Returns cached insights if available and fresh

## Related Documentation

- [Insights Agent](./agents/insights.md)
- [InsightsPanel Component](./frontend/components.md)
- [Insights Schema](./database/schema.md)
