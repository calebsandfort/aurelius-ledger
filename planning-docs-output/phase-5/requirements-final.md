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
- **FR 2.5** The system **SHALL** implement a two-phase extraction pipeline with validation: (1) extraction phase, (2) validation phase with schema checking and retry logic. This pattern **SHALL** be implemented using a node similar-based validation architecture to LangGraph, with explicit validation nodes rather than using the LangGraph library directly.
- **FR 2.6** The system **SHALL** validate extracted JSON against the schema before database write.
- **FR 2.7** The system **SHALL** retry extraction up to 2 times (3 total attempts) on schema validation failure.
- **FR 2.8** After exhausted retries, the system **SHALL** display a user-friendly error with example format: "Could not extract trade details. Please provide more detail (e.g., 'Long AAPL, +$250, waited for pullback')."
- **FR 2.9** The system **SHALL** return a confidence score with extraction results. The confidence score **SHALL** be calculated as a weighted average of per-field confidence values, where each field receives a confidence value between 0.0 and 1.0 based on:
  - Field presence (1.0 if present, 0.0 if null/undefined)
  - LLM self-assessed confidence for the field extraction
  - Explicit signal strength in the input text (strong keywords = higher confidence)
- **FR 2.10** When overall confidence is below 70%, or any individual field confidence is below 50%, the system **SHALL** display the trade with a "Review scores" option allowing manual correction.
- **FR 2.11** The system **SHALL** implement LLM API fallback: when the primary model (Haiku) fails due to API unavailability, the system **SHALL** automatically retry with Sonnet model. If both fail, the system **SHALL** queue the trade for later extraction and display: "Trade saved. AI analysis will complete shortly. You can manually edit scores if needed."

---

## 2. Behavioral Scoring

### FR 3.0 Discipline Score Assignment

The system **SHALL** assign discipline scores based on language patterns indicating adherence to or deviation from the trading plan.

- **FR 3.1** The system **SHALL** assign `discipline_score: 1` for language indicating patience and intentional execution (e.g., "waited for," "held for confirmation," "followed my plan," "respected stop", "scaled in").
- **FR 3.2** The system **SHALL** assign `discipline_score: -1` for language indicating reactive or impulsive execution (e.g., "chased," "fomo'd in," "revenge trade," "doubled up," "jumped in").
- **FR 3.3** The system **SHALL** assign `discipline_score: 0` when signals are absent, ambiguous, or neutral.

### FR 4.0 Agency Score Assignment

The system **SHALL** assign agency scores based on language patterns indicating intentional versus reactive decision-making.

- **FR 4.1** The system **SHALL** assign `agency_score: 1` for language indicating proactive decision-making (e.g., "decided to," "chose to," "my decision," "per my plan").
- **FR 4.2** The system **SHALL** assign `agency_score: -1** for language indicating external blame or passive framing (e.g., "market made me," "couldn't help it," "happened to be"). The phrase "got stopped" **SHALL NOT** trigger a negative agency score in isolation, as stopping out is a normal mechanical aspect of trading. Only "got stopped" accompanied by blame language (e.g., "got stopped unfairly," "market stopped me out") **SHALL** trigger a negative score.
- **FR 4.3** The system **SHALL** assign `agency_score: 0` when signals are absent, ambiguous, or neutral.

### FR 5.0 Composite Score Calculation

The system **SHALL** calculate composite scores for behavioral threshold detection.

- **FR 5.1** The system **SHALL** calculate a rolling 5-trade composite score: `Sum(discipline_scores[-5:]) + Sum(agency_scores[-5:])`. When fewer than 5 trades exist, the system **SHALL** compute the composite using all available trades (e.g., 3 trades = sum of 3 discipline + 3 agency scores).
- **FR 5.2** The system **SHALL** calculate trend direction by comparing the last 3 trades' average to the previous 3 trades' average with a threshold of 0.5. When fewer than 6 trades exist, the system **SHALL** display "Insufficient data" for trend direction.
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
  confidence_discipline TEXT NOT NULL CHECK (confidence_discipline IN ('high', 'medium', 'low')),
  confidence_agency TEXT NOT NULL CHECK (confidence_agency IN ('high', 'medium', 'low')),
  is_outlier BOOLEAN NOT NULL DEFAULT FALSE,
  cumulative_pnl DECIMAL(14,2),  -- Pre-computed cumulative P&L at insert time
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

- **FR 6.1** The system **SHALL** create a composite index on `(trading_day_id, timestamp)` for efficient time-series queries.
- **FR 6.2** The system **SHALL** also create single-column indexes on `timestamp`, `discipline_score`, and `agency_score` for query flexibility.
- **FR 6.3** The system **SHALL** compute `is_outlier` at insert time based on standard deviation from session average P&L. A trade is flagged as an outlier if its absolute P&L deviates more than 2 standard deviations from the session mean.
- **FR 6.4** The system **SHALL** compute `cumulative_pnl` at insert time as: `previous cumulative_pnl + new trade pnl`, enabling O(1) dashboard loads.
- **FR 6.5** The system **SHALL** map confidence scores to categorical levels: 0.0-0.4 = 'low', 0.41-0.7 = 'medium', 0.71-1.0 = 'high'.

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
  last_5_discipline_sum INTEGER NOT NULL DEFAULT 0,
  last_5_agency_sum INTEGER NOT NULL DEFAULT 0,
  session_high_pnl DECIMAL(14,2) NOT NULL DEFAULT 0,
  session_low_pnl DECIMAL(14,2) NOT NULL DEFAULT 0,
  consecutive_wins INTEGER NOT NULL DEFAULT 0,
  consecutive_losses INTEGER NOT NULL DEFAULT 0,
  avg_win DECIMAL(14,2),
  avg_loss DECIMAL(14,2),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

- **FR 7.1** The system **SHALL** create a new `trading_days` record automatically when the first trade of a calendar day is logged.
- **FR 7.2** The system **SHALL** update all aggregates in the same database transaction as the trade insert.
- **FR 7.3** The system **SHALL** update rolling window columns (last_5 discipline and agency sums) at trade insert time. The rolling window **SHALL** represent the last 5 trades of the current session (not day-level), aligned with FR 5.1 session-based computation.

---

## 4. Dashboard Components

### FR 8.0 Dashboard Layout

The system **SHALL** display the dashboard with the following visual hierarchy:

```
+------------------------------------------------------------------+
|  HEADER BAR: Session Time | Total P&L | Win Count | Net Discipline|
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

- **FR 8.1** The header **SHALL** display: session duration, total P&L (green for positive, red for negative), win count (not ratio - see FR 13.8), and net discipline score with color coding.
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
- **FR 9.9** Chart animations **SHALL** complete within 300ms when new data points are added.

### FR 10.0 Discipline Score Chart

The system **SHALL** display the running sum of discipline scores over the session.

- **FR 10.1** The chart **SHALL** use a line chart with markers.
- **FR 10.2** The X-axis **SHALL** match the P&L chart trade sequence.
- **FR 10.3** The Y-axis **SHALL** display the running sum of discipline scores.
- **FR 10.4** The line color **SHALL** be green (#10b981) for positive trajectory, amber (#f59e0b) for flat, and rose (#f43f5e) for negative trajectory.
- **FR 10.5** A zero reference line **SHALL** be displayed as a subtle dashed line.
- **FR 10.6** The chart **SHALL** display individual trade scores as markers with a connected line showing the cumulative trajectory. Bar overlays **MAY** be used to show discrete trade-level scores if desired.

### FR 11.0 Agency Score Chart

The system **SHALL** display the running sum of agency scores over the session, mirroring the discipline chart format.

- **FR 11.1** The agency score chart **SHALL** follow all specifications from FR 10.0 with agency-specific data.
- **FR 11.2** The chart **SHALL** be positioned adjacent to the discipline chart for correlation assessment.

---

## 5. AI Insights Panel

### FR 12.0 Insights Generation

The system **SHALL** generate behavioral insights after each trade is logged.

- **FR 12.1** The system **SHALL** feed the full session's trade data to a Trading Expert agent for insight generation.
- **FR 12.2** The system **SHALL** pass both raw trade records (last 15 trades) AND aggregated session statistics to the insights agent as structured JSON data.
- **FR 12.3** The system **SHALL** pre-compute and pass trend flags (disciplineTrajectory, agencyTrajectory, pnlTrajectory) to the insights agent.
- **FR 12.4** Insights **SHALL** be generated asynchronously in the background after trade confirmation.
- **FR 12.5** The insights panel **SHALL** display a loading state ("Analyzing...") while insights are being generated.
- **FR 12.6** Insights **SHALL** be returned as a complete block (not streamed).
- **FR 12.7** When session data exceeds model context limits, the system **SHALL** use a sliding window (most recent trades) with aggregate history summary.
- **FR 12.8** The system **SHALL** cache insights for 30 seconds to avoid unnecessary regeneration for unchanged session state.

### FR 13.0 Insight Categories

The system **SHALL** prioritize and generate insights in the following order:

**Tier 1 - Immediate Behavioral Intervention:**
- **FR 13.1** The system **SHALL** provide a tilt risk indicator when composite score drops below -3 or when 2+ consecutive trades have negative scores.
- **FR 13.2** The tilt risk insight **SHALL** include a specific, actionable recommendation (e.g., "Consider taking a 5-minute break before your next entry").
- **FR 13.3** The system **SHALL** detect revenge trading patterns when ANY of the following conditions are met:
  - Immediate re-entry within 5 minutes after a loss
  - Trade in opposite direction immediately after a loss
  - Increased position size on the trade immediately following a loss (detected via explicit mention or "doubled up" language)

**Tier 2 - Trend Awareness:**
- **FR 13.4** The system **SHALL** display discipline and agency trend direction (improving/declining/stable) using non-numerical visual indicators (arrows).
- **FR 13.5** The system **SHALL** detect decision fatigue when session exceeds 90 minutes with more than 8 trades.

**Tier 3 - Pattern Recognition (requires 5+ trades):**
- **FR 13.6** The system **SHALL** surface setup-outcome correlations when 5+ trades with identifiable setups exist.
- **FR 13.7** The system **SHALL** display win/loss language pattern differences.

- **FR 13.8** The system **SHALL NOT** display win/loss ratio in the AI insights panel during the session (to avoid anchoring and loss aversion). Win/loss count **MAY** be displayed in the header bar per FR 8.1, but ratio calculation **SHALL NOT** be shown mid-session in the insights panel.
- **FR 13.9** The system **SHALL NOT** display generic motivational statements.

### FR 14.0 Insight Types

The system **SHALL** differentiate between observation and recommendation insights.

- **FR 14.1** For minor behavioral signals, the system **SHALL** provide information-only insights (observations without recommendations).
- **FR 14.2** For critical behavioral signals (tilt risk, revenge trading, decision fatigue), the system **SHALL** provide both observation AND actionable recommendation.
- **FR 14.3** The system **SHALL** present observations before recommendations to respect trader autonomy.
- **FR 14.4** The system **SHALL** limit behavioral insights to a maximum of 2 per 5-minute window to prevent alarm fatigue. Tier 1 (critical) insights **SHALL** always be displayed regardless of rate limit. Non-critical insights **SHALL** be subject to the rate limit, showing the most recent observations.

### FR 15.0 Dashboard Score Display

The system **SHALL** display behavioral scores using qualitative labels, not raw numbers.

- **FR 15.1** Score range +2 or higher **SHALL** display as "Strong" with green up arrow.
- **FR 15.2** Score range +1 to -1 **SHALL** display as "Neutral" with horizontal line.
- **FR 15.3** Score -2 to -3 **SHALL** display as "At Risk" with amber down arrow. (Changed from "Declining" to align with FR 13.1 tilt threshold of -3)
- **FR 15.4** Score -4 or lower **SHALL** display as "Critical" with red warning indicator.

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

- **NFR 1.1** Trade entry to extraction completion **SHALL** complete in under 1.2 seconds under normal conditions. The 95th percentile **SHALL** be under 1.5 seconds, and the 99th percentile **SHALL** be under 3 seconds.
- **NFR 1.2** Database write **SHALL** complete in under 100 milliseconds.
- **NFR 1.3** Insights generation **SHALL** complete in under 2 seconds (asynchronous, non-blocking).
- **NFR 1.4** The perceived latency after trade submission **SHALL** be under 1 second (UI optimistic update).

**Latency Budget Allocation:**

| Component | Target | Notes |
|-----------|--------|-------|
| Network latency | 200ms | Assume OpenAI API overhead |
| Extraction (Haiku) | 600ms | Fast model, structured output |
| Validation | 50ms | Local JSON schema check |
| DB write | 100ms | SQLite local, fast |
| Insights generation (Sonnet) | 1500ms | Background, not blocking |
| UI update | 50ms | React state update |
| **Total (blocking)** | **~1.0s** | Under 1.2s target |
| **Total (with insights)** | **~2.5s** | Still under 3s |

### NFR 2.0 Performance - Model Selection

The system **SHALL** use appropriate LLM models for each task to balance cost and quality.

- **NFR 2.1** The extraction agent **SHALL** use Haiku 4.5 by default. The system **SHALL** automatically fallback to Sonnet 4.5 when Haiku fails twice consecutively or returns confidence below 40%.
- **NFR 2.2** The insights agent **SHALL** use Sonnet 4.5 for synthesis and pattern recognition.

### NFR 3.0 Reliability - Schema Conformance

The system **SHALL** ensure all extracted data conforms to the defined schema before database insertion.

- **NFR 3.1** The extraction agent **SHALL** return valid, schema-conformant JSON or surface a recoverable error.
- **NFR 3.2** The system **SHALL** perform schema validation before database write.
- **NFR 3.3** The system **SHALL NOT** perform silent partial writes - incomplete or invalid data must be rejected.
- **NFR 3.4** Failed extraction attempts **SHALL** be logged with input text, error type, retry count, and final output for analysis and prompt improvement.

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

### NFR 8.0 Reliability - Prompt Security

The system **SHALL** protect against prompt injection attacks.

- **NFR 8.1** The system **SHALL** sanitize user input to remove or escape potential prompt injection attempts before passing to the LLM.
- **NFR 8.2** The system **SHALL** implement prompt versioning to track changes and enable A/B testing of extraction accuracy.

### NFR 9.0 Autonomy Preservation

The system **SHALL** frame behavioral interventions as recommendations, not mandates.

- **NFR 9.1** All behavioral insights **SHALL** be framed as suggestions rather than mandates.
- **NFR 9.2** Traders **SHALL** have the ability to dismiss or snooze behavioral recommendations.
- **NFR 9.3** The system **SHALL** preserve trader agency to override recommendations when they have context the system lacks.

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
- Individual calibration of behavioral thresholds

---

## 9. Assumptions

- The trader enters one trade at a time after it closes - not mid-trade or speculatively
- P&L is always expressed in dollar terms in the trade description; the system does not handle points, ticks, or percentage-based P&L without a dollar equivalent
- The trader is the sole user; no authentication or multi-user data isolation is required in Phase 1
- A "trading day" maps to a calendar day in the user's local timezone
- The trader's natural language descriptions will contain enough signal for reliable extraction on the majority of entries; edge cases are acceptable with a graceful fallback to `0` scores
- The system assumes English language input for trade descriptions

---

## 10. Success Criteria Checklist

- [ ] Trade entry to confirmed database write completes in under 3 seconds
- [ ] Extraction accuracy is high enough that the trader rarely needs to manually correct a logged trade (target: <5% require review)
- [ ] Discipline and agency scores feel fair and consistent to the trader - not over-penalizing ambiguous descriptions
- [ ] AI insights feel relevant and specific to the session, not generic
- [ ] The UI stays out of the way during live trading - minimal clicks, no required navigation
- [ ] Dashboard updates in real-time without page refresh
- [ ] Tilt risk indicators trigger appropriately at composite score -3 or below
- [ ] Visual hierarchy allows 2-second session state assessment
- [ ] Rolling window aggregates are pre-computed for fast dashboard load times
- [ ] Win/loss ratio is not displayed mid-session in insights panel to avoid anchoring

---

## Changes from Draft

This section summarizes key modifications made based on Phase 4 SME feedback.

### AI/NLP Architecture SME Changes

1. **FR 2.5 - LangGraph Clarification**: Changed from "LangGraph-style node architecture" to "node-based validation architecture similar to LangGraph, with explicit validation nodes rather than using the LangGraph library directly."

2. **FR 2.9 - Confidence Score Methodology**: Added detailed confidence score calculation methodology: weighted average of per-field confidence based on field presence, LLM self-assessment, and explicit signal strength.

3. **FR 2.11 - LLM API Fallback**: Added new requirement for automatic fallback from Haiku to Sonnet on API failure, with queue-and-retry strategy.

4. **FR 14.4 - Rate Limiting Resolution**: Changed to allow Tier 1 (critical) insights always display regardless of rate limit; only non-critical insights are subject to the 2-per-5-minute window.

5. **NFR 1.1 - Latency Adjustment**: Relaxed from 1s to 1.2s target with added 95th and 99th percentile SLA specifications.

6. **NFR 2.1 - Model Selection Criteria**: Added explicit criteria for when to fallback from Haiku to Sonnet (consecutive failures or confidence below 40%).

7. **NFR 8.0 - Prompt Security**: Added new section for input sanitization and prompt versioning.

### Behavioral Psychology SME Changes

1. **FR 8.1 - Win/Loss Display**: Changed from "win/loss count as ratio" to just "win count" to resolve conflict with FR 13.8. Ratio is explicitly prohibited in insights panel but count in header is acceptable.

2. **FR 4.2 - "Got Stopped" Fix**: Added clarification that "got stopped" in isolation shall NOT trigger negative agency score; only when accompanied by blame language.

3. **FR 15.3 - Score Display Threshold**: Changed "Declining" label to "At Risk" starting at -2 to align with FR 13.1 tilt threshold of -3 (display shows "At Risk" for -2 to -3 range).

4. **FR 15.4 - Score -4 Display**: Changed label from "At Risk" to "Critical" for -4 and below to create proper escalation.

5. **FR 13.3 - Size Escalation**: Added "increased position size" as a revenge trading indicator alongside existing conditions.

6. **NFR 9.0 - Autonomy Preservation**: Added new section ensuring behavioral interventions are framed as suggestions, preserving trader agency.

### Data Analytics SME Changes

1. **FR 5.1 - Rolling Window Clarification**: Added explicit behavior: "When fewer than 5 trades exist, the system SHALL compute the composite using all available trades."

2. **FR 5.2 - Trend with Fewer than 6 Trades**: Added explicit behavior: "When fewer than 6 trades exist, the system SHALL display 'Insufficient data' for trend direction."

3. **FR 6.0 - Schema Updates**:
   - Added `is_outlier BOOLEAN` column to trades table
   - Added `cumulative_pnl DECIMAL(14,2)` column for O(1) dashboard loads
   - Added CHECK constraints for confidence_discipline and confidence_agency

4. **FR 6.5 - Confidence Mapping**: Added new requirement mapping numerical scores to categorical levels: 0.0-0.4 = 'low', 0.41-0.7 = 'medium', 0.71-1.0 = 'high'.

5. **FR 7.3 - Rolling Window Scope**: Clarified that rolling windows in trading_days represent session trades (last 5 of current session), aligned with FR 5.1.

6. **FR 7.0 - Extended Schema**: Added session_high_pnl, session_low_pnl, consecutive_wins, consecutive_losses, avg_win, avg_loss columns to trading_days table.

7. **FR 9.9 - Animation Duration**: Added 300ms animation duration specification.

8. **FR 10.6 - Combo Chart Clarification**: Simplified to show line with markers, with bar overlays as optional.

9. **FR 12.7 - Context Window Management**: Added sliding window strategy for sessions exceeding model context limits.

10. **FR 12.8 - Insights Caching**: Added 30-second cache for insights to avoid unnecessary regeneration.

---

*Document prepared by Product Manager Agent - Phase 5 Requirements Finalization*
*Date: 2026-02-25*
