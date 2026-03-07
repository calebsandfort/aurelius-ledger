# Trade API Endpoints

This document covers all trade-related API endpoints for creating, reading, and adjusting trades.

## Base URL

```
/api/v1/trades
```

All endpoints require authentication via session cookie.

## Endpoints

### GET /api/v1/trades

Returns the list of trades for the current user's active session.

**Authentication**: Required (session cookie)

**Query Parameters**: None

**Response (200)**:
```json
{
  "data": [
    {
      "id": "uuid-string",
      "session_id": "uuid-string",
      "sequence_number": 1,
      "direction": "long",
      "outcome": "win",
      "pnl": 500.00,
      "setup_description": "Long NQ at 17800, exited at 17850",
      "discipline_score": 1,
      "agency_score": 1,
      "discipline_confidence": "high",
      "agency_confidence": "medium",
      "created_at": "2024-01-15T10:30:00.000Z"
    }
  ],
  "meta": { "total": 1 }
}
```

**Error Responses**:
| Status | Condition |
|--------|-----------|
| 401 | Not authenticated |

---

### POST /api/v1/trades

Creates a new trade from a natural language description.

**Authentication**: Required (session cookie)

**Rate Limiting**: 30 requests per minute per user

**Request Body**:
| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| raw_input | string | yes | 1-5000 characters |

```json
{
  "raw_input": "Long NQ at 17800, exited at 17850 for +$500. Good wait for the push above 17800."
}
```

**Response (201)**:
```json
{
  "data": {
    "id": "uuid-string",
    "session_id": "uuid-string",
    "sequence_number": 1,
    "direction": "long",
    "outcome": "win",
    "pnl": 500,
    "setup_description": "Long NQ at 17800, exited at 17850",
    "discipline_score": 1,
    "agency_score": 1,
    "discipline_confidence": "high",
    "agency_confidence": "medium",
    "created_at": "2024-01-15T10:30:00.000Z"
  },
  "meta": { "sequence_number": 1 }
}
```

**Error Responses**:
| Status | Condition |
|--------|-----------|
| 400 | Empty description or validation failure |
| 401 | Not authenticated |
| 429 | Rate limit exceeded (30/min) |
| 500 | Internal server error |

---

### PATCH /api/v1/trades/[id]/adjust

Adjusts discipline or agency scores for a specific trade.

**Authentication**: Required (session cookie)

**URL Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | Trade UUID |

**Request Body**:
| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| discipline_score | number | no | -1, 0, or 1 |
| agency_score | number | no | -1, 0, or 1 |
| reason | string | yes | 1-500 characters |

```json
{
  "discipline_score": 0,
  "agency_score": -1,
  "reason": "Did not follow my trading plan - revenge trade"
}
```

**Response (200)**:
```json
{
  "data": {
    "id": "uuid-string",
    "session_id": "uuid-string",
    "sequence_number": 1,
    "direction": "long",
    "outcome": "win",
    "pnl": 500,
    "setup_description": "Long NQ at 17800, exited at 17850",
    "discipline_score": 0,
    "agency_score": -1,
    "discipline_confidence": "high",
    "agency_confidence": "medium",
    "created_at": "2024-01-15T10:30:00.000Z"
  }
}
```

**Error Responses**:
| Status | Condition |
|--------|-----------|
| 400 | Invalid UUID format or validation failure |
| 401 | Not authenticated |
| 404 | Trade not found |
| 500 | Internal server error |

## Score Adjustment Logging

Score adjustments are logged for model calibration (FR 4.8.2). When a user modifies a score:

```typescript
console.log('[Calibration Log]', {
  trade_id: string,
  previous_discipline_score: number,
  new_discipline_score: number,
  previous_agency_score: number,
  new_agency_score: number,
  adjustment_reason: string,
  adjusted_at: string,
})
```

## Related Documentation

- [Schema Definition](./database/schema.md)
- [TradeEntry Component](./frontend/components.md)
- [Extraction Agent](./agents/extraction.md)
