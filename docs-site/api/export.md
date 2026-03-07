# Export API Endpoints

This document covers the export API endpoint for downloading trade data.

## Base URL

```
/api/v1/export
```

All endpoints require authentication via session cookie.

## Endpoints

### GET /api/v1/export

Exports session data in JSON or CSV format.

**Authentication**: Required (session cookie)

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| format | string | yes | `json` or `csv` |

**Response - JSON Format (200)**:
```json
{
  "session": {
    "id": "uuid-string",
    "user_id": "user-id",
    "total_pnl": 1500.00,
    "win_count": 5,
    "loss_count": 3,
    "breakeven_count": 1,
    "net_discipline_score": 2,
    "net_agency_score": 1,
    "trade_count": 9,
    "started_at": "2024-01-15T09:00:00.000Z",
    "ended_at": null
  },
  "trades": [
    {
      "id": "uuid-string",
      "session_id": "uuid-string",
      "sequence_number": 1,
      "direction": "long",
      "outcome": "win",
      "pnl": 500.00,
      "setup_description": "Long NQ at 17800",
      "discipline_score": 1,
      "agency_score": 1,
      "discipline_confidence": "high",
      "agency_confidence": "medium",
      "created_at": "2024-01-15T10:30:00.000Z"
    }
  ],
  "exported_at": "2024-01-15T14:00:00.000Z"
}
```

**Response - CSV Format (200)**:

```csv
id,session_id,sequence_number,direction,outcome,pnl,setup_description,discipline_score,agency_score,discipline_confidence,agency_confidence,created_at
uuid-1,uuid-sess,1,long,win,500,Long NQ at 17800,1,1,high,medium,2024-01-15T10:30:00.000Z
```

Headers:
```
id,session_id,sequence_number,direction,outcome,pnl,setup_description,discipline_score,agency_score,discipline_confidence,agency_confidence,created_at
```

**Error Responses**:
| Status | Condition |
|--------|-----------|
| 400 | Invalid format parameter (must be `json` or `csv`) |
| 401 | Not authenticated |
| 500 | Internal server error |

## CSV Escape Rules

CSV values are escaped according to RFC 4180:
- Fields containing commas, double quotes, or newlines are enclosed in double quotes
- Double quotes within fields are escaped by doubling them

## Export Scope

Currently exports the **most recent active session** only. All historical sessions are stored but not included in exports by default.

## Related Documentation

- [Trade API Endpoints](./trades.md)
- [Database Schema](./database/schema.md)
