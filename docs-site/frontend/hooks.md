# Frontend Hooks

This document covers the custom React hooks used in the Aurelius Ledger frontend.

## Hooks Overview

| Hook | Purpose |
|------|---------|
| useOptimisticTrades | Optimistic UI for trade submissions |
| useInsights | Fetch and cache insights data |
| useBehavioralWarnings | Detect negative behavioral patterns |

---

## useOptimisticTrades

Location: `/frontend/src/hooks/useOptimisticTrades.ts`

Manages optimistic UI updates for trade submissions.

### Signature

```typescript
function useOptimisticTrades(): UseOptimisticTradesResult

interface UseOptimisticTradesResult {
  pendingTrades: Map<string, PendingTrade>
  addOptimisticTrade: (tempId: string, rawInput: string) => PendingTrade
  resolveTrade: (tempId: string, actual: TradeResponse) => void
  rejectTrade: (tempId: string) => void
}
```

### Usage

```typescript
const { addOptimisticTrade, resolveTrade, rejectTrade } = useOptimisticTrades()

// Add optimistic trade immediately
const tempId = `temp-${Date.now()}`
addOptimisticTrade(tempId, tradeDescription)

// On server success
resolveTrade(tempId, actualTradeResponse)

// On server error
rejectTrade(tempId)
```

### Features

- **FR 1.2.1**: Displays trade immediately with placeholder data
- **FR 1.2.2**: Syncs with server response after submission

### Pending Trade Structure

```typescript
interface PendingTrade {
  id: string
  session_id: string
  sequence_number: number
  direction: 'long' | 'short'
  outcome: 'win' | 'loss' | 'breakeven'
  pnl: number
  discipline_score: number
  agency_score: number
  created_at: string
  raw_input: string
}
```

---

## useInsights

Location: `/frontend/src/hooks/useInsights.ts`

Fetches behavioral insights using TanStack Query.

### Signature

```typescript
function useInsights(sessionId?: string): UseQueryResult<InsightsResponse, Error>
```

### Usage

```typescript
const { data, isLoading, error } = useInsights()

// Access insights
data?.insights  // Insight[]
data?.generated_at  // string
data?.trade_count  // number
```

### Query Configuration

```typescript
{
  staleTime: 30000,  // 30 seconds
  retry: 1,
}
```

### Response Type

```typescript
interface InsightsResponse {
  insights: Insight[]
  generated_at: string
  trade_count: number
}
```

---

## useBehavioralWarnings

Location: `/frontend/src/hooks/useBehavioralWarnings.ts`

Detects behavioral warning patterns in trade data.

### Signature

```typescript
function useBehavioralWarnings(trades: TradeResponse[]): WarningState

interface WarningState {
  level: 'none' | 'amber' | 'orange'
  message: string
  triggeredBy: number[]  // Trade indices
}
```

### Usage

```typescript
const { level, message, triggeredBy } = useBehavioralWarnings(trades)

// level: 'none' | 'amber' | 'orange'
// message: "3 consecutive discipline violations"
// triggeredBy: [4, 5, 6]  // 0-indexed trade positions
```

### Detection Rules

| Consecutive -1 Scores | Warning Level |
|-----------------------|---------------|
| 0-2 | None |
| 3 | Amber |
| 4+ | Orange |

**FR 4.4**: NOT show warnings for <3 trades

### Implementation

```typescript
// Track longest streak of -1 scores (discipline or agency)
let maxStreak = 0
let maxStreakType: 'discipline' | 'agency' = 'discipline'

// For each trade
if (trade.discipline_score === -1) {
  currentDisciplineStreak++
  // Update max streak
}

if (trade.agency_score === -1) {
  currentAgencyStreak++
  // Update max streak
}

// Determine warning level
if (maxStreak >= 4) level = 'orange'
else if (maxStreak >= 3) level = 'amber'
else level = 'none'
```

---

## useAuth

Location: `/frontend/src/hooks/use-auth.ts`

Authentication hook using Better Auth.

### Usage

```typescript
const { data: session, isLoading } = useAuth()

if (session) {
  // User is authenticated
  session.user.id
  session.user.email
}
```

---

## Related Documentation

- [TradeEntry Component](./components.md)
- [InsightsPanel Component](./components.md)
- [Trade API Endpoints](./api/trades.md)
- [Insights API Endpoints](./api/insights.md)
