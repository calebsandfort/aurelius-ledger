# Aurelius Ledger - Functional and Non-Functional Requirements

## Project Goal

The Aurelius Ledger is a lightweight web application for logging futures trades during live trading sessions. The system shall enable frictionless natural-language trade entry with AI-powered extraction, real-time behavioral scoring, and session-level insights, all within a 3-second end-to-end SLA.

---

## 1. Trade Entry Workflow

### FR 1.0 Natural Language Trade Entry

The system **SHALL** provide a persistent text input field at the bottom of the dashboard that accepts free-form natural language descriptions of completed trades.

- **FR 1.1** The system **SHALL** accept natural language input without requiring a specific format or structure.
- **FR 1.2** The system **SHALL** auto-populate the timestamp at the moment of submission.
- **FR 1.3** The system **SHALL** clear the input field upon successful submission.
- **FR 1.4** The system **SHALL** display a loading state during AI extraction processing.
- **FR 1.5** The system **SHALL** display an error message if extraction fails after maximum retries.

### FR 2.0 Trade Data Extraction

The system **SHALL** parse natural language trade descriptions using an AI extraction agent and extract the following structured fields:

| Field | Type | Description |
|-------|------|-------------|
| `direction` | `long` \| `short` | Trade direction (required) |
| `outcome` | `win` \| `loss` \| `breakeven` | Trade outcome (required) |
| `pnl` | Decimal | Dollar P&L (required, nullable for ambiguous cases) |
| `timestamp` | Timestamp | Auto-populated at submission |
| `setup_description` | String | Natural language summary of the setup |
| `discipline_score` | `-1` \| `0` \| `1` | Discipline indicator |
| `agency_score` | `-1` \| `0` \| `1` | Agency indicator |

- **FR 2.1** The extraction prompt **SHALL** include a structured system prompt with role definition, output schema, extraction rules, and few-shot examples.
- **FR 2.2** The system **SHALL** include 4 few-shot examples covering: (1) explicit dollar P&L, (2) ambiguous P&L ("small winner"), (3) clear discipline indicators, (4) reactive/impulsive language.
- **FR 2.3** The system **SHALL** use synonym clusters in the prompt to map equivalent expressions (e.g., "chased," "fomo'd in," "got greedy") to canonical keywords for consistent scoring.
- **FR 2.4** The system **SHALL** implement tiered inference for ambiguous P&L:
  - Tier 1 (explicit): Extract exact dollar amount
  - Tier 2 (relative): Set `pnl: null`, infer outcome if possible
  - Tier 3 (implied): Set `pnl: null`, infer outcome from context
  - Tier 4 (complete ambiguity): Return error requiring clarification
- **FR 2.5** The system **SHALL** implement a two-phase extraction with validation using a LangGraph-style node architecture.
- **FR 2.6** The system **SHALL** validate extracted JSON against the schema before database write.
- **FR 2.7** The system **SHALL** retry extraction up to 2 times (3 total attempts) on schema validation failure.
- **FR 2.8** After exhausted retries, the system **SHALL** display a user-friendly error with example format: "Could not extract trade details. Please provide more detail (e.g., 'Long AAPL, +$250, waited for pullback')."
- **FR 2.9** The system **SHALL** return a confidence score with extraction results for UI display.
- **FR 2.10** When confidence is below 70% on any field, the system **SHALL** display the trade with a "Review scores" option allowing manual correction.

---

## 2. Behavioral Scoring

### FR 3.0 Discipline Score Assignment

The system **SHALL** assign discipline scores based on language patterns indicating adherence to or deviation from the trading plan.

- **FR 3.1** The system **SHALL** assign `discipline_score: 1` for language indicating patience and intentional execution (e.g., "waited for," "held for confirmation," "followed my plan," "respected stop").
- **FR 3.2** The system **SHALL** assign `discipline_score: -1` for language indicating reactive or impulsive execution (e.g., "chased," "fomo'd in," "revenge trade," "doubled up," "jumped in").
- **FR 3.3** The system **SHALL** assign `discipline_score: 0` when signals are absent, ambiguous, or neutral.

### FR 4.0 Agency Score Assignment

The system **SHALL** assign agency scores based on language patterns indicating intentional versus reactive decision-making.

- **FR 4.1** The system **SHALL** assign `agency_score: 1` for language indicating proactive decision-making (e.g., "decided to," "chose to," "my decision," "per my plan").
- **FR 4.2** The system **SHALL** assign `agency_score: -1` for language indicating external blame or passive framing (e.g., "market made me," "couldn't help it," "got stopped," "happened to be").
- **FR 4.3** The system **SHALL** assign `agency_score: 0` when signals are absent, ambiguous, or neutral.

### FR 5.0 Composite Score Calculation

The system **SHALL** calculate composite scores for behavioral threshold detection.

- **FR 5.1** The system **SHALL** calculate a rolling 5-trade composite score: `Sum(discipline_scores[-5:]) + Sum(agency_scores[-5:])`.
- **FR 5.2** The system **SHALL** calculate trend direction by comparing the last 3 trades' average to the previous 3 trades' average with a threshold of 0.5.
- **FR 5.3** The system **SHALL** classify trend as "improving" when short-term avg exceeds medium-term avg by more than 0.5, "declining" when the reverse is true, and "stable" otherwise.

---

## 3. Data Model

### FR 6.0 Trades Table

The system **SHALL** store trade records in a `trades` table with the following schema:

```sql
CREATE TABLE trades (
  id TEXT PRIMARY KEY,
  direction TEXT NOT NULL CHECK (direction IN ('long', 'short')),
  outcome TEXT NOT NULL CHECK (outcome IN ('win', 'loss', 'breakeven')),
  pnl DECIMAL(12,2),  -- Nullable for ambiguous P&L
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  setup_description TEXT,
  discipline_score INTEGER NOT NULL CHECK (discipline_score IN (-1, 0, 1)),
  agency_score INTEGER NOT NULL CHECK (agency_score IN (-1, 0, 1)),
  trading_day_id TEXT NOT NULL REFERENCES trading_days(id),
  confidence_discipline TEXT,  -- 'high' | 'medium' | 'low'
  confidence_agency TEXT,      -- 'high' | 'medium' | 'low'
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

- **FR 6.1** The system **SHALL** create a composite index on `(trading_day_id, timestamp)` for efficient time-series queries.
- **FR 6.2** The system **SHALL** include an outlier flag computed at insert time based on standard deviation from session average.

### FR 7.0 Trading Days Table

The system **SHALL** maintain a `trading_days` table with pre-computed aggregates updated after each trade insertion:

```sql
CREATE TABLE trading_days (
  id TEXT PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  total_pnl DECIMAL(14,2) NOT NULL DEFAULT 0,
  win_count INTEGER NOT NULL DEFAULT 0,
  loss_count INTEGER NOT NULL DEFAULT 0,
  breakeven_count INTEGER NOT NULL DEFAULT 0,
  trade_count INTEGER NOT NULL DEFAULT 0,
  net_discipline_score INTEGER NOT NULL DEFAULT 0,
  net_agency_score INTEGER NOT NULL DEFAULT 0,
  last_3_discipline_sum INTEGER NOT NULL DEFAULT 0,
  last_5_discipline_sum INTEGER NOT NULL DEFAULT 0,
  last_3_agency_sum INTEGER NOT NULL DEFAULT 0,
  last_5_agency_sum INTEGER NOT NULL DEFAULT 0,
  last_3_pnl DECIMAL(12,2) NOT NULL DEFAULT 0,
  last_5_pnl DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

- **FR 7.1** The system **SHALL** create a new `trading_days` record automatically when the first trade of a calendar day is logged.
- **FR 7.2** The system **SHALL** update all aggregates in the same database transaction as the trade insert.
- **FR 7.3** The system **SHALL** update rolling window columns (last 3, last 5) at trade insert time.

---

## 4. Dashboard Components

### FR 8.0 Dashboard Layout

The system **SHALL** display the dashboard with the following visual hierarchy:

```
+------------------------------------------------------------------+
|  HEADER BAR: Session Time | Total P&L | Win/Loss | Net Discipline|
+------------------------------------------+-------------------------+
|                                          |                         |
|        P&L TIME SERIES CHART             |    AI INSIGHTS PANEL   |
|        (Area chart with gradient)        |    (Latest Analysis)   |
|                                          |                         |
+--------------------+---------------------+-------------------------+
|   DISCIPLINE       |     AGENCY          |                         |
|   SCORE CHART     |     SCORE CHART     |                         |
|   (Line + markers)|     (Line + markers)|                         |
+--------------------+---------------------+-------------------------+
|                    TRADE ENTRY INPUT                              |
|    [Natural language trade description input field]              |
+------------------------------------------------------------------+
```

- **FR 8.1** The header **SHALL** display: session duration, total P&L (green for positive, red for negative), win/loss count as ratio (e.g., "3-2"), and net discipline score with color coding.
- **FR 8.2** The P&L time series chart **SHALL** occupy the largest visual area as the primary success metric.
- **FR 8.3** The discipline and agency score charts **SHALL** be displayed side-by-side below the P&L chart.
- **FR 8.4** The AI insights panel **SHALL** be positioned to the right of the P&L chart.
- **FR 8.5** The trade entry input **SHALL** remain persistently accessible at the bottom of the viewport.

### FR 9.0 P&L Time Series Chart

The system **SHALL** display cumulative P&L over the trading session.

- **FR 9.1** The chart **SHALL** use an area chart with gradient fill.
- **FR 9.2** The chart **SHALL** display cumulative P&L (running total), not individual trade P&L.
- **FR 9.3** The X-axis **SHALL** represent trade sequence number.
- **FR 9.4** The Y-axis **SHALL** represent cumulative dollar P&L.
- **FR 9.5** The chart **SHALL** display a prominent zero reference line (dashed, slate-400 at 50% opacity).
- **FR 9.6** The chart **SHALL** use green gradient fill above zero and red gradient fill below zero.
- **FR 9.7** Trade markers **SHALL** be color-coded: green dot for win, red dot for loss, gray for breakeven.
- **FR 9.8** Hover tooltips **SHALL** show individual trade P&L contribution.

### FR 10.0 Discipline Score Chart

The system **SHALL** display the running sum of discipline scores over the session.

- **FR 10.1** The chart **SHALL** use a line chart with markers.
- **FR 10.2** The X-axis **SHALL** match the P&L chart trade sequence.
- **FR 10.3** The Y-axis **SHALL** display the running sum of discipline scores.
- **FR 10.4** The line color **SHALL** be green (#10b981) for positive trajectory, amber (#f59e0b) for flat, and rose (#f43f5e) for negative trajectory.
- **FR 10.5** A zero reference line **SHALL** be displayed as a subtle dashed line.
- **FR 10.6** The chart **SHALL** display a combo bar + line showing individual trade contributions as bars and cumulative trajectory as a line.

### FR 11.0 Agency Score Chart

The system **SHALL** display the running sum of agency scores over the session, mirroring the discipline chart format.

- **FR 11.1** The agency score chart **SHALL** follow all specifications from FR 10.0 with agency-specific data.
- **FR 11.2** The chart **SHALL** be positioned adjacent to the discipline chart for correlation assessment.

---

## 5. AI Insights Panel

### FR 12.0 Insights Generation

The system **SHALL** generate behavioral insights after each trade is logged.

- **FR 12.1** The system **SHALL** feed the full session's trade data to a Trading Expert agent for insight generation.
- **FR 12.2** The system **SHALL** pass both raw trade records (last 15 trades) AND aggregated session statistics to the insights agent.
- **FR 12.3** The system **SHALL** pre-compute and pass trend flags (disciplineTrajectory, agencyTrajectory, pnlTrajectory) to the insights agent.
- **FR 12.4** Insights **SHALL** be generated asynchronously in the background after trade confirmation.
- **FR 12.5** The insights panel **SHALL** display a loading state ("Analyzing...") while insights are being generated.
- **FR 12.6** Insights **SHALL** be returned as a complete block (not streamed).

### FR 13.0 Insight Categories

The system **SHALL** prioritize and generate insights in the following order:

**Tier 1 - Immediate Behavioral Intervention:**
- **FR 13.1** The system **SHALL** provide a tilt risk indicator when composite score drops below -3 or when 2+ consecutive trades have negative scores.
- **FR 13.2** The tilt risk insight **SHALL** include a specific, actionable recommendation (e.g., "Consider taking a 5-minute break before your next entry").
- **FR 13.3** The system **SHALL** detect revenge trading patterns (immediate re-entry within 5 minutes after a loss, opposite direction or increased size).

**Tier 2 - Trend Awareness:**
- **FR 13.4** The system **SHALL** display discipline and agency trend direction (improving/declining/stable) using non-numerical visual indicators (arrows).
- **FR 13.5** The system **SHALL** detect decision fatigue when session exceeds 90 minutes with more than 8 trades.

**Tier 3 - Pattern Recognition (requires 5+ trades):**
- **FR 13.6** The system **SHALL** surface setup-outcome correlations when 5+ trades with identifiable setups exist.
- **FR 13.7** The system **SHALL** display win/loss language pattern differences.

- **FR 13.8** The system **SHALL NOT** display win/loss ratio or total session P&L in mid-session insights (to avoid anchoring and loss aversion).
- **FR 13.9** The system **SHALL NOT** display generic motivational statements.

### FR 14.0 Insight Types

The system **SHALL** differentiate between observation and recommendation insights.

- **FR 14.1** For minor behavioral signals, the system **SHALL** provide information-only insights (observations without recommendations).
- **FR 14.2** For critical behavioral signals (tilt risk, revenge trading, decision fatigue), the system **SHALL** provide both observation AND actionable recommendation.
- **FR 14.3** The system **SHALL** present observations before recommendations to respect trader autonomy.
- **FR 14.4** The system **SHALL** limit behavioral insights to a maximum of 2 per 5-minute window to prevent alarm fatigue.

### FR 15.0 Dashboard Score Display

The system **SHALL** display behavioral scores using qualitative labels, not raw numbers.

- **FR 15.1** Score range +2 or higher **SHALL** display as "Strong" with green up arrow.
- **FR 15.2** Score range +1 to -1 **SHALL** display as "Neutral" with horizontal line.
- **FR 15.3** Score range -2 to -3 **SHALL** display as "Declining" with amber down arrow.
- **FR 15.4** Score -4 or lower **SHALL** display as "At Risk" with red warning indicator.

---

## 6. Real-Time Updates

### FR 16.0 Dashboard Refresh

The system **SHALL** update the dashboard in real-time after each trade is logged.

- **FR 16.1** The dashboard **SHALL** reflect the newly logged trade without requiring a page refresh.
- **FR 16.2** Charts **SHALL** animate smoothly when new data points are added.
- **FR 16.3** The system **SHALL** use optimistic UI updates - showing the trade immediately while processing.
- **FR 16.4** When new insights are available, the system **SHALL** update the insights panel automatically via polling or WebSocket.

---

## 7. Non-Functional Requirements

### NFR 1.0 Performance - End-to-End Latency

The system **SHALL** complete the trade entry to confirmed database write in under 3 seconds under normal conditions.

- **NFR 1.1** Trade entry to extraction completion **SHALL** complete in under 1 second.
- **NFR 1.2** Database write **SHALL** complete in under 100 milliseconds.
- **NFR 1.3** Insights generation **SHALL** complete in under 2 seconds (asynchronous, non-blocking).
- **NFR 1.4** The perceived latency after trade submission **SHALL** be under 1 second (UI optimistic update).

**Latency Budget Allocation:**

| Component | Target | Notes |
|-----------|--------|-------|
| Network latency | 200ms | Assume OpenAI API overhead |
| Extraction (Haiku) | 500ms | Fast model, structured output |
| Validation | 50ms | Local JSON schema check |
| DB write | 100ms | SQLite local, fast |
| Insights generation (Sonnet) | 1500ms | Background, not blocking |
| UI update | 50ms | React state update |
| **Total (blocking)** | **~900ms** | Well under 3s |
| **Total (with insights)** | **~2.5s** | Still under 3s |

### NFR 2.0 Performance - Model Selection

The system **SHALL** use appropriate LLM models for each task to balance cost and quality.

- **NFR 2.1** The extraction agent **SHALL** use Haiku 4.5 (or Sonnet 4.5 if needed) for structured extraction.
- **NFR 2.2** The insights agent **SHALL** use Sonnet 4.5 for synthesis and pattern recognition.

### NFR 3.0 Reliability - Schema Conformance

The system **SHALL** ensure all extracted data conforms to the defined schema before database insertion.

- **NFR 3.1** The extraction agent **SHALL** return valid, schema-conformant JSON or surface a recoverable error.
- **NFR 3.2** The system **SHALL** perform schema validation before database write.
- **NFR 3.3** The system **SHALL NOT** perform silent partial writes - incomplete or invalid data must be rejected.
- **NFR 3.4** Failed extraction attempts **SHALL** be logged for analysis and prompt improvement.

### NFR 4.0 Reliability - Error Handling

The system **SHALL** handle errors gracefully with user-friendly messaging.

- **NFR 4.1** Extraction failure after max retries **SHALL** display: "Could not extract trade details. Please provide more detail (e.g., 'Long AAPL, +$250, waited for pullback')."
- **NFR 4.2** Database write failure **SHALL** display a retry option with error details.
- **NFR 4.3** Network failures **SHALL** display a connection error with retry option.

### NFR 5.0 Usability - Frictionless Workflow

The system **SHALL** minimize friction in the trade entry workflow.

- **NFR 5.1** The trader **SHALL** require no navigation or page changes to enter a trade.
- **NFR 5.2** The trader **SHALL** require no more than 2 seconds of attention to assess current session state from the dashboard.
- **NFR 5.3** The trader **SHALL** require no more than one click to enter a trade (type + submit).
- **NFR 5.4** The input field **SHALL** remain accessible at all viewport sizes.

### NFR 6.0 Usability - Visual Design

The system **SHALL** use a dark theme to reduce eye strain during long trading sessions.

- **NFR 6.1** The dashboard **SHALL** use a dark background (slate-950: #020617).
- **NFR 6.2** Positive values **SHALL** display in green (#22c55e).
- **NFR 6.3** Negative values **SHALL** display in red (#ef4444).
- **NFR 6.4** Neutral values **SHALL** display in amber (#f59e0b).
- **NFR 6.5** Primary text **SHALL** use high contrast (slate-50: #f8fafc).
- **NFR 6.6** Secondary text **SHALL** use subtle labels (slate-400: #94a3b8).

### NFR 7.0 Usability - Empty States

The system **SHALL** provide appropriate empty state handling.

- **NFR 7.1** Empty charts **SHALL** display placeholder with "No trades yet" message.
- **NFR 7.2** Empty state **SHALL** display the input field prominently for first trade entry.

---

## 8. Out of Scope for Phase 1

- Editing or deleting logged trades after submission
- Multi-day historical views, trend analysis across sessions, or calendar views
- Manual session start/end controls
- Trade tagging or session notes
- Broker API integration or actual trade data import
- P&L correlation with mental state data
- Mobile app or responsive mobile layout
- Export functionality
- User authentication and multi-user support

---

## 9. Assumptions

- The trader enters one trade at a time after it closes - not mid-trade or speculatively
- P&L is always expressed in dollar terms in the trade description; the system does not handle points, ticks, or percentage-based P&L without a dollar equivalent
- The trader is the sole user; no authentication or multi-user data isolation is required in Phase 1
- A "trading day" maps to a calendar day in the user's local timezone
- The trader's natural language descriptions will contain enough signal for reliable extraction on the majority of entries; edge cases are acceptable with a graceful fallback to `0` scores

---

## 10. Success Criteria Checklist

- [ ] Trade entry to confirmed database write completes in under 3 seconds
- [ ] Extraction accuracy is high enough that the trader rarely needs to manually correct a logged trade
- [ ] Discipline and agency scores feel fair and consistent to the trader - not over-penalizing ambiguous descriptions
- [ ] AI insights feel relevant and specific to the session, not generic
- [ ] The UI stays out of the way during live trading - minimal clicks, no required navigation
- [ ] Dashboard updates in real-time without page refresh
- [ ] Tilt risk indicators trigger appropriately at composite score -3 or below
- [ ] Visual hierarchy allows 2-second session state assessment
- [ ] Rolling window aggregates are pre-computed for fast dashboard load times

---

*Document prepared by Product Manager Agent - Phase 3 Requirements Synthesis*
*Date: 2026-02-25*
