# Data Analytics SME Answers (Phase 2)

## Overview

This document provides answers to questions from the AI/NLP SME and Behavioral Psychology SME regarding data analytics, visualization, and database concerns for the Aurelius Ledger dashboard.

---

## From AI/NLP SME

### Question 1: Dashboard Real-Time Updates

**Context:** Handling rapid trade submissions (e.g., a trader logging multiple trades quickly). Should updates be debounced, or is immediate refresh acceptable?

**Answer:**

**Recommendation: Immediate refresh with optimistic UI updates**

For a trading journal where trades are typically logged after execution (not during active market participation), immediate refresh is the correct approach. Here's the reasoning:

1. **Latency is minimal**: Each trade is a discrete event, and the database insert + aggregation recalculation should complete in <50ms for local SQLite. There's no need to debounce.

2. **Optimistic UI pattern**: Show the trade data immediately in the chart before server confirmation. This provides instant feedback without waiting for round-trip completion.

3. **Debouncing is appropriate for**: User typing in input fields, window resize events, or scroll position changes — not for discrete data submissions.

4. **Implementation approach**:
   ```typescript
   // Client-side: Immediate visual update
   const handleTradeSubmit = async (tradeData) => {
     // 1. Optimistically update chart state
     setDashboardState(prev => ({
       ...prev,
       trades: [...prev.trades, { ...tradeData, sequenceNumber: prev.trades.length + 1 }],
       aggregates: computeAggregates([...prev.trades, tradeData])
     }))

     // 2. Background API call
     await api.post('/trades', tradeData)

     // 3. Sync with server response (for consistency)
     await refreshDashboard()
   }
   ```

5. **What to debounce instead**: The insights regeneration should NOT fire on every keystroke in the trade description field — only after the full submission.

---

### Question 2: Chart Visualization for Scores

**Context:** Requirements specify "running sum" for discipline and agency. Would a moving average or trend line be more informative? Should the charts show individual trade scores alongside the running sum?

**Answer:**

**Recommendation: Running sum as primary, with individual trade markers visible on hover**

The running sum is the correct primary visualization for discipline and agency scores. Here's why and how to enhance it:

1. **Running sum advantages**:
   - Cumulative scores show the trajectory of behavioral quality over the session
   - Easy to understand at a glance: above 0 = net positive, below 0 = net negative
   - Aligns with the psychological concept of "banking" good vs. bad decisions

2. **What to add alongside the running sum**:
   - **Individual trade markers** (dots) at each data point on the line
   - **Hover tooltip** showing: trade number, individual score (+1/-1/0), and cumulative total
   - **Color-coded segments**: Connect lines between points with colors matching the individual score (green line for +1, red for -1, gray for 0)

3. **Moving average alternative**: Consider a 3-trade moving average as a **secondary overlay** that can be toggled on. This smooths noise and shows the short-term trend more clearly.

4. **Visual mockup**:
   ```
   Y-axis: Cumulative Score
   |
   |        /--(+1)         /--(+1)
   |       /              /
   |------/----(-1)------/------(+1)
   |     /
   |----(+1)
   |
   +-------------------------------- X-axis: Trade #
   ```

5. **Implementation notes**:
   - The step chart approach (from my Phase 1 analysis) still applies
   - Add a toggle for "Show moving average" in chart options
   - Default to running sum only for cleanest initial view

---

### Question 3: Insights Caching Strategy

**Context:** Insights are regenerated after each trade. What's the recommended cache invalidation strategy? Should insights be cached by trade count?

**Answer:**

**Recommendation: Cache by session ID + trade count + timestamp hash**

The insights should regenerate when there is new data, not on every dashboard refresh. Here is the recommended caching strategy:

1. **Cache key structure**:
   ```typescript
   const insightsCacheKey = {
     sessionId: string,        // Current trading session
     tradeCount: number,       // Number of trades in session
     lastTradeTimestamp: Date  // Hash of last trade time
   }
   ```

2. **Invalidation logic**:
   ```
   IF current_trade_count != cached_trade_count
      THEN regenerate insights
   ELSE IF current_last_trade_time != cached_last_trade_time
      THEN regenerate insights
   ELSE
      RETURN cached insights
   ```

3. **Storage location**: Server-side in-memory cache (or Redis if distributed). Not client-side, because insights are generated server-side.

4. **Cache TTL**: For Phase 1, no time-based expiration within an active session. Insights persist until the session ends or a new trade is added.

5. **What NOT to cache by**:
   - Do NOT cache by user ID alone (stale data problem)
   - Do NOT cache by timestamp alone (unnecessary regenerations)

6. **Implementation pseudo-code**:
   ```python
   def get_insights(session_id: str) -> Insights:
       cache_key = f"insights:{session_id}"
       cached = redis.get(cache_key)

       current_trade_count = get_trade_count(session_id)
       last_trade_time = get_last_trade_time(session_id)

       if cached and cached.trade_count == current_trade_count:
           return cached.insights

       # Cache miss or stale — regenerate
       trades = get_trades_for_session(session_id)
       insights = generate_insights(trades)

       redis.set(cache_key, {
           "insights": insights,
           "trade_count": current_trade_count,
           "last_trade_time": last_trade_time
       })

       return insights
   ```

---

## From Behavioral Psychology SME

### Question 4: Real-Time Aggregation Queries

**Context:** What database queries will efficiently compute running aggregates (discipline sum, P&L, win/loss count) after each trade insertion? Should we use materialized views or computed columns?

**Answer:**

**Recommendation: Pre-computed aggregate columns on the session table (NOT materialized views or runtime queries)**

For Phase 1 with SQLite, the most efficient approach is storing aggregates directly on the session record and updating them on each trade insert.

1. **Schema approach**:
   ```sql
   CREATE TABLE trading_sessions (
       id TEXT PRIMARY KEY,
       date TEXT NOT NULL,
       total_pnl REAL DEFAULT 0,
       win_count INTEGER DEFAULT 0,
       loss_count INTEGER DEFAULT 0,
       breakeven_count INTEGER DEFAULT 0,
       net_discipline_score INTEGER DEFAULT 0,
       net_agency_score INTEGER DEFAULT 0,
       trade_count INTEGER DEFAULT 0,
       created_at TEXT,
       updated_at TEXT
   );

   CREATE TABLE trades (
       id TEXT PRIMARY KEY,
       session_id TEXT REFERENCES trading_sessions(id),
       sequence_number INTEGER NOT NULL,
       timestamp TEXT NOT NULL,
       direction TEXT NOT NULL,
       outcome TEXT NOT NULL,
       pnl REAL NOT NULL,
       discipline_score INTEGER NOT NULL,
       agency_score INTEGER NOT NULL,
       setup_description TEXT,
       created_at TEXT
   );

   CREATE INDEX idx_trades_session ON trades(session_id, sequence_number);
   ```

2. **Update logic on trade insert** (transactional):
   ```sql
   BEGIN TRANSACTION;

   INSERT INTO trades (id, session_id, sequence_number, ...) VALUES (...);

   UPDATE trading_sessions SET
       total_pnl = total_pnl + NEW.pnl,
       trade_count = trade_count + 1,
       win_count = win_count + CASE WHEN NEW.outcome = 'win' THEN 1 ELSE 0 END,
       loss_count = loss_count + CASE WHEN NEW.outcome = 'loss' THEN 1 ELSE 0 END,
       breakeven_count = breakeven_count + CASE WHEN NEW.outcome = 'breakeven' THEN 1 ELSE 0 END,
       net_discipline_score = net_discipline_score + NEW.discipline_score,
       net_agency_score = net_agency_score + NEW.agency_score,
       updated_at = datetime('now')
   WHERE id = NEW.session_id;

   COMMIT;
   ```

3. **Why NOT materialized views**:
   - SQLite does not have native materialized view support
   - Overhead for a simple sum/count across a small table
   - Adds complexity without benefit for Phase 1

4. **Why NOT computed columns**:
   - Computed columns in SQLite are calculated at read time (not stored)
   - Would require scanning all trades for every dashboard load
   - Our approach of updating on insert is O(1) per trade, O(1) per read

5. **Dashboard query**:
   ```sql
   SELECT * FROM trading_sessions WHERE id = ?;
   SELECT * FROM trades WHERE session_id = ? ORDER BY sequence_number;
   ```
   Single-row session fetch + indexed trades fetch = <10ms for typical sessions.

---

### Question 5: Chart Library Recommendations

**Context:** What chart library/approach do you recommend for the time-series charts given the Next.js + Shadcn/ui + Tailwind stack?

**Answer:**

**Recommendation: Recharts or Tremor (both React-native, work well with Shadcn/ui)**

For Next.js + Shadcn/ui + Tailwind, here are the best options:

| Library | Pros | Cons |
|---------|------|------|
| **Recharts** | Most popular, excellent docs, customizable | Bundle size ~40KB |
| **Tremor** | Built for dashboards, Shadcn-like aesthetic | Less flexible |
| **Chart.js** | Mature, many chart types | Not React-native (wrapper) |
| **Visx** | Low-level, Airbnb-built | Steeper learning curve |

**Primary recommendation: Recharts** for these reasons:
1. Native React components (no wrapper needed)
2. Excellent TypeScript support
3. Highly customizable styling via props
4. Works well with Tailwind for colors
5. Active maintenance

**Secondary recommendation: Tremor** if you want out-of-the-box dashboard components that match Shadcn's design philosophy.

**Implementation example with Recharts**:
```tsx
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

const DisciplineChart = ({ trades }) => {
  const data = trades.map((trade, idx) => ({
    tradeNumber: idx + 1,
    cumulativeScore: trades.slice(0, idx + 1).reduce((sum, t) => sum + t.disciplineScore, 0),
    individualScore: trade.disciplineScore
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data}>
        <XAxis dataKey="tradeNumber" stroke="#94a3b8" />
        <YAxis stroke="#94a3b8" />
        <Tooltip
          content={({ payload }) => (
            <div className="bg-slate-800 p-2 rounded border border-slate-700">
              <p>Trade #{payload[0]?.payload?.tradeNumber}</p>
              <p>Cumulative: {payload[0]?.payload?.cumulativeScore}</p>
              <p>Score: {payload[0]?.payload?.individualScore}</p>
            </div>
          )}
        />
        <ReferenceLine y={0} stroke="#6b7280" />
        <Line
          type="stepAfter"
          dataKey="cumulativeScore"
          stroke="#14b8a6"
          strokeWidth={2}
          dot={{ fill: '#14b8a6' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};
```

---

### Question 6: No Data State Handling

**Context:** How should we handle the "no data" state for early-session (1-2 trades) where trend analysis isn't meaningful yet?

**Answer:**

**Recommendation: Show skeleton/placeholder with explanatory message, not empty charts**

For early-session states (0-2 trades), provide meaningful UI rather than empty charts:

1. **State 0: No trades yet**
   - Show placeholder chart area with dashed outline
   - Message: "Log your first trade to begin tracking"
   - Entry input should be prominent and inviting

2. **State 1: Single trade**
   - Show the single trade as a single point on the chart
   - Message below chart: "1 trade logged — patterns emerge with more data"
   - Show the individual P&L and scores numerically

3. **State 2: Two trades**
   - Show line connecting the two points
   - Message: "2 trades — early indicators forming"
   - Show comparison: "Trade 1 vs Trade 2: Discipline +1 vs 0"

4. **Threshold for meaningful trends**: At 5+ trades, trend lines become statistically more meaningful. Show this threshold clearly in UI.

5. **Implementation**:
   ```tsx
   const ChartPlaceholder = ({ tradeCount }) => {
     const messages = {
       0: "Log your first trade to begin tracking",
       1: "1 trade logged — patterns emerge with more data",
       2: "2 trades — early indicators forming"
     };

     if (tradeCount < 3) {
       return (
         <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-slate-600 rounded-lg">
           <p className="text-slate-400">{messages[tradeCount]}</p>
         </div>
       );
     }

     return <ActualChart />;
   };
   ```

---

### Question 7: Data Retention Policy

**Context:** For Phase 1, how long should trade data be retained locally before considering archival? Should we implement any data compression for older sessions (e.g., rolling up to daily summaries after 30 days)?

**Answer:**

**Recommendation: Phase 1 = Keep all data indefinitely, no archival**

For Phase 1 of Aurelius Ledger, data retention should be simple:

1. **Phase 1 approach (MVP)**:
   - Keep ALL trade data indefinitely
   - No time-based deletion
   - No archival needed — the data volume is manageable

2. **Why no archival for Phase 1**:
   - **Learning value**: Full trade history is needed for long-term pattern analysis
   - **Volume is low**: Even active traders generate <10,000 trades/year
   - **Complexity**: Archival adds significant implementation complexity
   - **Premature optimization**: Don't optimize until you have a problem

3. **Estimated storage**:
   - 10,000 trades × ~500 bytes per record = ~5MB
   - SQLite handles this trivially

4. **Future Phase considerations** (for roadmap):
   - After 90 days: Consider compressing setup descriptions (NLP embeddings)
   - After 1 year: Archive old sessions to separate table
   - After 2 years: Daily summaries instead of individual trades

5. **Data export**: Provide export functionality (CSV/JSON) so users can back up their own data if desired.

---

### Question 8: Materialized Views vs Computed Columns

**Context:** Performance optimization for real-time dashboard updates. Should we use materialized views or computed columns for the running aggregates?

**Answer:**

**Recommendation: Neither — use pre-computed columns updated at insert time**

This is the most efficient approach for Phase 1:

| Approach | Read Cost | Write Cost | Complexity | Recommendation |
|----------|-----------|------------|------------|----------------|
| Runtime aggregation (SUM/COUNT) | O(n) | O(1) | Low | No — slow |
| Computed columns | O(n) | O(1) | Low | No — SQLite recalculates |
| Materialized views | O(1) | O(n) | High | No — SQLite doesn't support |
| Pre-computed columns | O(1) | O(1) | Low | YES — best for Phase 1 |

**Detailed explanation**:

1. **Computed columns in SQLite**: When you define a column as `GENERATED ALWAYS AS (expression)`, SQLite recalculates the expression on EVERY read. For a session with 50 trades, that's 50 calculations every time you view the dashboard.

2. **Materialized views**: SQLite has no native support. You'd need to manually maintain a summary table and update it via triggers — overkill for this use case.

3. **Pre-computed columns (recommended)**: Store the aggregates directly in the `trading_sessions` table and update them atomically when a trade is inserted:
   - O(1) reads: Just `SELECT * FROM trading_sessions WHERE id = ?`
   - O(1) writes: Single UPDATE statement increments counters
   - Simple to implement and reason about

4. **Transaction requirement**: The trade insert and aggregate update MUST be in the same transaction to maintain consistency:
   ```sql
   BEGIN TRANSACTION;
   INSERT INTO trades ...;
   UPDATE trading_sessions SET ... WHERE id = ?;
   COMMIT;
   ```

5. **If scaling beyond Phase 1**: Consider Redis for hot aggregates, but don't add this complexity until needed.

---

## Summary

| Question | Recommendation |
|----------|----------------|
| Real-time updates | Immediate refresh with optimistic UI |
| Score visualization | Running sum + individual markers + optional moving average |
| Insights caching | Cache by session + trade count, regenerate on new trades |
| Aggregation queries | Pre-computed columns updated on insert, not runtime queries |
| Chart library | Recharts (primary) or Tremor (secondary) |
| No data state | Show placeholder with encouraging message, not empty chart |
| Data retention | Keep all data indefinitely for Phase 1 |
| Materialized views | Not needed — use pre-computed columns instead |

---

*Answers prepared by: Data Analytics SME*
*Date: 2026-03-02*
