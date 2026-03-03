# Aurelius Ledger - Functional and Non-Functional Requirements

## Project Goal

The Aurelius Ledger is a lightweight web application for logging futures trades during live trading sessions. The system SHALL provide frictionless natural-language trade entry with AI-powered extraction of structured data, real-time behavioral score visualization (discipline and agency), and auto-generated AI insights to help traders improve their performance and self-regulation.

---

## 1. Trade Entry

### FR 1.0 Natural Language Trade Input

The system **SHALL** provide a persistent text input at the bottom of the dashboard that accepts free-form natural language descriptions of completed trades.

- **FR 1.1** The system **SHALL** accept any natural language text describing a trade without requiring a specific format or structure.
- **FR 1.2** The system **SHALL** auto-populate the timestamp at the moment of submission.
- **FR 1.3** The system **SHALL** clear the input field upon successful submission.
- **FR 1.4** The system **SHALL** display a visual confirmation (green flash) upon successful trade logging.
- **FR 1.5** The input field **SHALL** auto-focus after each submission to enable rapid logging.
- **FR 1.6** The input **SHALL** remain fixed at the bottom of the screen and remain accessible without navigation.

*Source: HLRD Section 1.1; Behavioral Psychology SME Phase 1 Section 4.1*

### FR 1.2 Trade Submission Flow

The system **SHALL** process trade submissions with immediate feedback and no page refresh.

- **FR 1.2.1** The system **SHALL** use optimistic UI updates, displaying the submitted trade data immediately in the dashboard before server confirmation.
- **FR 1.2.2** The system **SHALL** sync with the server response after submission to ensure consistency.
- **FR 1.2.3** The system **SHALL** show a loading state during trade processing.

*Source: Data Analytics SME Phase 2 Q1*

---

## 2. AI Trade Extraction

### FR 2.0 Extraction Agent Functionality

The system **SHALL** parse natural language trade descriptions and extract structured data using an AI agent.

- **FR 2.1** The system **SHALL** extract the following fields from trade descriptions:
  - `direction`: "long" or "short"
  - `outcome`: "win", "loss", or "breakeven" (inferred from P&L or explicit language)
  - `pnl`: Dollar value (positive for wins, negative for losses)
  - `setup_description`: Natural language summary of the setup
  - `discipline_score`: -1, 0, or +1
  - `agency_score`: -1, 0, or +1
- **FR 2.2** The system **SHALL** infer discipline score from behavioral language:
  - +1 for explicit discipline signals ("waited for", "held for confirmation", "patient", "followed plan")
  - -1 for undisciplined signals ("chased", "FOMO'd", "revenge trade", "impulsive")
  - 0 for ambiguous or no signals
- **FR 2.3** The system **SHALL** infer agency score from intentionality language:
  - +1 for intentional execution ("followed trading plan", "deliberate entry", "made conscious decision")
  - -1 for reactive trading ("knew better but didn't follow plan", "acted against rules")
  - 0 for ambiguous signals
- **FR 2.4** The system **SHALL** assign confidence scores ("high", "medium", "low") alongside discipline and agency scores.
- **FR 2.5** When confidence is low, the system **SHALL** default the score to 0 and flag the trade for review.

*Source: HLRD Section 2.1; AI/NLP SME Phase 1 Q1; Behavioral Psychology SME Phase 2 Q1*

### FR 2.1 Extraction Architecture

The system **SHALL** implement trade extraction as a LangGraph node with validation and retry capability.

- **FR 2.1.1** The system **SHALL** use LangChain's `with_structured_output()` combined with Pydantic validation to ensure output conforms to the required schema.
- **FR 2.1.2** The system **SHALL** implement retry logic with up to 2 retries on schema mismatch.
- **FR 2.1.3** The system **SHALL** surface a recoverable error if extraction fails after retries, without writing partial data.
- **FR 2.1.4** The system **SHALL NOT** write partial or incomplete trade records to the database.

*Source: AI/NLP SME Phase 1 Q2*

### FR 2.2 Prompt Structure

The system **SHALL** use a hybrid few-shot prompt structure with structured output for reliable extraction.

- **FR 2.2.1** The system **SHALL** include 3-4 curated few-shot examples in the system prompt demonstrating expected input/output format.
- **FR 2.2.2** The few-shot examples **SHALL** cover diverse score combinations: (+1,+1), (-1,-1), (+1,-1), (0,0), and edge cases.
- **FR 2.2.3** The system **SHALL** use real trading vocabulary in examples (FOMO, revenge, tilt, confirmation, retest, stop hunt).
- **FR 2.2.4** The system **SHALL** specify output schema via JSON Schema leveraging OpenAI's structured output capability.

*Source: AI/NLP SME Phase 1 Q1; AI/NLP SME Phase 2 Q6*

### FR 2.3 Ambiguous P&L Handling

The system **SHALL** handle ambiguous P&L expressions with a tiered fallback strategy.

- **FR 2.3.1** When explicit dollar amounts are present, the system **SHALL** use the exact value.
- **FR 2.3.2** When relative terms ("small winner", "big loss") are used without dollar amounts, the system **SHALL** estimate based on context and default to a configurable amount with `pnl_confidence: "low"`.
- **FR 2.3.3** The system **SHALL** require human verification for trades where P&L cannot be determined.
- **FR 2.3.4** The system **SHALL** return an error if no P&L signal is present (required field per HLRD).

*Source: AI/NLP SME Phase 1 Q1*

### FR 2.4 Position Management Scoring

The system **SHALL** correctly score position management behaviors in trade descriptions.

- **FR 2.4.1** Scaling out (partial profit-taking) **SHALL** score as +1 for both discipline and agency.
- **FR 2.4.2** Adding to a winning position **SHALL** score as context-dependent: +1 agency if following plan.
- **FR 2.4.3** Adding to a losing position (averaging down) **SHALL** score as -1 for both discipline and agency.
- **FR 2.4.4** Moving a stop further from entry **SHALL** score as -1 unless explicitly part of the trading plan.
- **FR 2.4.5** Using a trailing stop **SHALL** score as +1 for both discipline and agency.

*Source: Behavioral Psychology SME Phase 2 Q1*

### FR 2.5 Error Handling

The system **SHALL** handle extraction errors gracefully with appropriate user feedback.

- **FR 2.5.1** If extraction fails, the system **SHALL** display a user-friendly message: "Couldn't parse that — add it manually when you have a moment."
- **FR 2.5.2** The system **SHALL NOT** make the trader feel their input was "wrong."
- **FR 2.5.3** The system **SHALL** log repeated zero-score results for prompt recalibration review after 3 consecutive occurrences.

*Source: Behavioral Psychology SME Phase 1 Section 4.2; AI/NLP SME Phase 2 Q2*

### FR 2.6 Model Selection

The system **SHALL** use specific OpenAI models optimized for each AI task.

- **FR 2.6.1** The system **SHALL** use `gpt-4o-mini` for trade extraction to optimize for latency and cost.
- **FR 2.6.2** The system **SHALL** use `gpt-4o` for insights generation to ensure accurate behavioral analysis.

*Source: AI/NLP SME Phase 4 Review - Critical Missing Requirement*

### FR 2.7 Extraction Reliability

The system **SHALL** implement reliability mechanisms for AI extraction.

- **FR 2.7.1** The system **SHALL** implement a timeout of 5 seconds for trade extraction AI calls.
- **FR 2.7.2** If timeout occurs, the system **SHALL** retry once, then surface a recoverable error.
- **FR 2.7.3** The system **SHALL NOT** write partial data on timeout.
- **FR 2.7.4** When OpenAI API is unavailable, the system **SHALL** display: "Trade saved. Analysis unavailable — check back later."
- **FR 2.7.5** The trade **SHALL** be saved without extraction data when API is unavailable.
- **FR 2.7.6** The system **SHALL** queue extraction for retry when API recovers.

*Source: AI/NLP SME Phase 4 Review - Extraction Timeout & API Fallback*

### FR 2.8 Business Logic Validation

The system **SHALL** validate extracted data against business rules.

- **FR 2.8.1** The system **SHALL** validate extracted P&L is within reasonable range (-$10,000 to +$10,000 per trade).
- **FR 2.8.2** The system **SHALL** validate direction is either "long" or "short".
- **FR 2.8.3** Invalid extractions **SHALL** trigger retry before failing.

*Source: AI/NLP SME Phase 4 Review - Business Logic Validation*

### FR 2.9 Input Sanitization

The system **SHALL** sanitize trade descriptions before passing to LLM.

- **FR 2.9.1** The system **SHALL** sanitize trade descriptions to prevent prompt injection.
- **FR 2.9.2** The system **SHALL** remove or escape any system prompt instructions embedded in trade descriptions.

*Source: AI/NLP SME Phase 4 Review - Prompt Security*

### FR 2.10 Extraction Observability

The system **SHALL** log extraction results for accuracy monitoring.

- **FR 2.10.1** The system **SHALL** log all extraction inputs and outputs for accuracy monitoring.
- **FR 2.10.2** The system **SHALL** track extraction success rate by confidence level.
- **FR 2.10.3** The system **SHALL** flag recurring extraction patterns for prompt recalibration.

*Source: AI/NLP SME Phase 4 Review - Observability*

---

## 3. Data Model

### FR 3.0 Trade Persistence

The system **SHALL** persist trade data with proper schema and relationships.

- **FR 3.1** The system **SHALL** store trades in a `trades` table with the following schema:
  - `id`: UUID (primary key)
  - `session_id`: UUID (foreign key to sessions)
  - `sequence_number`: INTEGER
  - `raw_input`: TEXT (original natural language input)
  - `direction`: VARCHAR(10) - "long" or "short"
  - `outcome`: VARCHAR(20) - "win", "loss", or "breakeven"
  - `pnl`: NUMERIC(10,2) - dollar value (positive for wins, negative for losses)
  - `setup_description`: VARCHAR(2000)
  - `discipline_score`: INTEGER (-1, 0, or +1)
  - `agency_score`: INTEGER (-1, 0, or +1)
  - `discipline_confidence`: VARCHAR(10) - "high", "medium", or "low"
  - `agency_confidence`: VARCHAR(10) - "high", "medium", or "low"
  - `created_at`: TIMESTAMPTZ (timezone-aware)
- **FR 3.2** Each trade **SHALL** have a sequence number within its session.
- **FR 3.3** Each trade **SHALL** include confidence scores for discipline and agency.
- **FR 3.4** The system **SHALL** create a trading session automatically when the first trade of a calendar day is logged.
- **FR 3.5** The system **SHALL** store the original raw input text in a separate column for audit purposes and future re-processing.

*Source: HLRD Section 3.1; Data Analytics SME Phase 4 Review - Data Types & Raw Input Storage*

### FR 3.1 Session Aggregates

The system **SHALL** maintain running aggregates on the trading session record, updated after each trade insertion.

- **FR 3.1.1** The system **SHALL** store and update: total_pnl (NUMERIC), win_count (INTEGER), loss_count (INTEGER), breakeven_count (INTEGER), net_discipline_score (INTEGER), net_agency_score (INTEGER), trade_count (INTEGER).
- **FR 3.1.2** Aggregate updates **SHALL** occur atomically within the same transaction as trade insertion.
- **FR 3.1.3** The system **SHALL** compute aggregates in O(1) time using pre-computed columns on the sessions table, updated via database triggers or application transaction logic.
- **FR 3.1.4** The system **SHALL** index trades by (session_id, sequence_number) for efficient time-series retrieval.
- **FR 3.1.5** The system **SHALL** add composite indexes for:
  - (session_id, created_at) for time-range queries within sessions
  - (created_at) for cross-session analytics queries

*Source: HLRD Section 3.2; Data Analytics SME Phase 2 Q4, Q8; Phase 4 Review - Index Strategy*

### FR 3.2 Data Quality Validation

The system **SHALL** validate data quality at ingestion.

- **FR 3.2.1** The system **SHALL** validate P&L values are within reasonable bounds (-$100,000 to +$100,000 per trade) and flag outliers.
- **FR 3.2.2** The system **SHALL** validate timestamp is not in the future.

*Source: Data Analytics SME Phase 4 Review - Data Quality Validation*

### FR 3.3 Data Export

The system **SHALL** support data export for backup and analysis.

- **FR 3.3.1** The system **SHALL** support exporting session data as JSON for backup purposes.
- **FR 3.3.2** The system **SHALL** support exporting all trades as CSV for spreadsheet analysis.

*Source: Data Analytics SME Phase 4 Review - Data Export*

### FR 3.4 TimescaleDB Optimization

The system **SHALL** leverage TimescaleDB features for optimal time-series performance.

- **FR 3.4.1** The trades table **SHALL** be created as a TimescaleDB hypertable partitioned by `created_at` for optimal time-series performance.

*Source: Data Analytics SME Phase 4 Review - TimescaleDB-Specific Optimizations*

---

## 4. Dashboard

### FR 4.0 Dashboard Organization

The system **SHALL** display current-day data in a single-screen vertically-stacked layout with all critical information above the fold.

- **FR 4.1** The dashboard **SHALL** display four main components: P&L Time Series Chart, Discipline Score Chart, Agency Score Chart, and AI Insights Panel.
- **FR 4.2** The P&L Time Series Chart **SHALL** be the largest and most prominent visualization.
- **FR 4.3** The discipline and agency score charts **SHALL** be positioned side-by-side for easy comparison.
- **FR 4.4** The AI Insights Panel **SHALL** be adjacent to the behavioral score charts.
- **FR 4.5** The trader **SHALL** be able to assess session state in 3 seconds or less (3-Second Rule).

*Source: Data Analytics SME Phase 1 Q1; Data Analytics SME Phase 1 Section 3*

### FR 4.1 P&L Visualization

The system **SHALL** display cumulative P&L as a time-series chart.

- **FR 4.1.1** The chart **SHALL** show cumulative P&L (running total), not individual trade P&L.
- **FR 4.1.2** The line **SHALL** be green when above zero and red when below zero (dynamic coloring). At exactly zero, the system **SHALL** use a neutral gray or split gradient.
- **FR 4.1.2.1** Color transitions **SHALL** use smooth gradients rather than abrupt switches to reduce emotional reactivity.
- **FR 4.1.3** The chart **SHALL** include a horizontal reference line at $0 for breakeven.
- **FR 4.1.4** The chart **SHALL** display tooltips on hover showing: trade sequence number, timestamp (HH:MM:SS), individual trade P&L, cumulative P&L, direction (long/short), discipline score, and agency score.
- **FR 4.1.5** The chart **SHALL** use a line chart with area fill design.
- **FR 4.1.6** The P&L chart **SHALL** maintain aspect ratio and remain readable on screens as small as 768px width.
- **FR 4.1.7** Extreme P&L values (more than 3 standard deviations) **SHALL** be flagged in tooltips but still displayed.

*Source: Data Analytics SME Phase 1 Q1; Data Analytics SME Phase 1 Section 2.1; Phase 4 Review - Tooltips, Responsive, Outliers*

### FR 4.2 Discipline Score Visualization

The system **SHALL** display discipline scores as a running sum chart.

- **FR 4.2.1** The chart **SHALL** show running sum of discipline scores over the session.
- **FR 4.2.2** The chart **SHALL** use a step chart or line chart with data markers at each trade.
- **FR 4.2.3** The chart **SHALL** display color-coded segments: green for +1 scores, red for -1 scores, gray for 0.
- **FR 4.2.4** The chart **SHALL** show a reference line at y=0.
- **FR 4.2.5** The chart **SHALL** include a toggle option for a 3-trade moving average overlay.
- **FR 4.2.6** When session exceeds 50 trades, charts **SHALL** display rolling window of last 50 trades with option to view full history.

*Source: HLRD Section 3.3; Data Analytics SME Phase 2 Q2; Phase 4 Review - Data Windowing*

### FR 4.3 Agency Score Visualization

The system **SHALL** display agency scores identically to discipline scores for pattern recognition consistency.

- **FR 4.3.1** The chart **SHALL** mirror the discipline chart in format and design.
- **FR 4.3.2** The chart **SHALL** use distinct colors from discipline (indigo/rose palette per AGENTS.md design system).

*Source: HLRD Section 3.4; Data Analytics SME Phase 1 Section 2.3*

### FR 4.4 Visual Warning System

The system **SHALL** implement a graduated visual warning system for negative behavioral trends.

- **FR 4.4.1** The system **SHALL NOT** show warnings for sessions with fewer than 3 trades (minimum data requirement).
- **FR 4.4.2** The system **SHALL** show no alert for 2 consecutive -1 discipline scores (normal variance).
- **FR 4.4.3** The system **SHALL** show a yellow (amber) indicator when 3 consecutive -1 discipline scores occur.
- **FR 4.4.3.1** The warning **SHALL** require at least 2 of 3 trades to have explicit negative behavioral language in the trade description before triggering.
- **FR 4.4.4** The system **SHALL** show an orange indicator when 4+ consecutive -1 discipline scores occur.
- **FR 4.4.5** The warning **SHALL** be visual only (amber dot on chart edge), not interruptive (no pop-ups, sounds, or push notifications).
- **FR 4.4.6** The warning **SHALL** include a tooltip explaining the trigger on hover.
- **FR 4.4.7** The warning **SHALL** fade when the negative pattern resolves.

*Source: Behavioral Psychology SME Phase 2 Q4; Behavioral Psychology SME Phase 1 Section 2.3; Phase 4 Review - Warning Confirmation*

### FR 4.5 Early Session Handling

The system **SHALL** handle the "no data" state gracefully for early-session traders.

- **FR 4.5.1** With 0 trades, the system **SHALL** show a placeholder chart area with dashed outline and message: "Log your first trade to begin tracking."
- **FR 4.5.2** With 1 trade, the system **SHALL** display the single data point with message: "1 trade logged — patterns emerge with more data."
- **FR 4.5.3** With 2 trades, the system **SHALL** show a line connecting the two points with message: "2 trades — early indicators forming."
- **FR 4.5.4** The system **SHALL** clearly indicate the 5+ trade threshold where trend lines become statistically meaningful.
- **FR 4.5.5** Charts **SHALL** render with empty state (axes visible, no data line) rather than hiding completely when no data exists.

*Source: Data Analytics SME Phase 2 Q6; Phase 4 Review - Empty State Chart Rendering*

### FR 4.6 Real-Time Updates

The system **SHALL** update the dashboard in real-time without page refresh.

- **FR 4.6.1** The system **SHALL** update charts immediately upon trade submission using optimistic UI.
- **FR 4.6.2** The system **SHALL** animate chart updates with 300-500ms smooth transitions using ease-out-cubic easing.
- **FR 4.6.3** The system **SHALL** maintain consistent chart sizing after updates (no layout shift).

*Source: Data Analytics SME Phase 1 Section 3.3; Data Analytics SME Phase 2 Q1; Phase 4 Review - Animation Specifications*

### FR 4.7 Cognitive Bias Mitigation

The system **SHALL** implement strategies to reduce cognitive biases in visualization.

- **FR 4.7.1** The P&L chart **SHALL** display cumulative values, not percentage changes, to reduce relative thinking bias.
- **FR 4.7.2** Insights **SHALL** explicitly frame neutral information as such, avoiding language that implies pattern significance when statistical significance is uncertain.
- **FR 4.7.3** The system **SHALL NOT** highlight "near misses" or "almost wins" that could trigger recency bias.
- **FR 4.7.4** The P&L chart **SHALL** display a horizontal reference showing the average P&L per trade as a subtle guide, not prominently.

*Source: Behavioral Psychology SME Phase 4 Review - Cognitive Bias Mitigation*

### FR 4.8 Self-Report Calibration

The system **SHALL** provide mechanisms for traders to adjust AI-inferred scores.

- **FR 4.8.1** The system **SHALL** provide a mechanism for traders to manually adjust discipline and agency scores with a reason field.
- **FR 4.8.2** The system **SHALL** log AI/trader score discrepancies for model calibration.

*Source: Behavioral Psychology SME Phase 4 Review - Self-Report Calibration*

---

## 5. AI Insights

### FR 5.0 Insights Generation

The system **SHALL** generate and display AI-powered insights after each trade.

- **FR 5.1** The system **SHALL** feed the full session's trade data to a Trading Expert agent for regeneration after each trade.
- **FR 5.2** The system **SHALL** pass both raw trade records and aggregated session statistics to the insights agent.
- **FR 5.3** The insights **SHALL** include: behavioral patterns, setup consistency, emotional state indicators, and actionable flags.
- **FR 5.4** The insights **SHALL** be displayed in a card format with 2-4 bullet points maximum.
- **FR 5.5** The insights panel **SHALL** show a timestamp: "Last updated: HH:MM:SS".

*Source: HLRD Section 3.5; AI/NLP SME Phase 2 Q7*

### FR 5.1 Insights Context Format

The system **SHALL** pass structured JSON data to the insights generation agent.

- **FR 5.1.1** The payload **SHALL** include a `session_summary` object with: total_trades, total_pnl, win_count, loss_count, win_rate, discipline_sum, agency_sum, session_duration_minutes, avg_trade_interval_minutes (calculated as median time between trades, excluding gaps greater than 60 minutes).
- **FR 5.1.2** The payload **SHALL** include a `trades` array with sequence, timestamp, direction, pnl, setup_description, discipline_score, agency_score for each trade.
- **FR 5.1.3** The payload **SHALL** include a `recent_trends` object with last_3_discipline, last_3_agency, consecutive_losses, consecutive_wins.

*Source: AI/NLP SME Phase 2 Q7; Phase 4 Review - Calculation Ambiguity*

### FR 5.2 Insights Generation Timing

The system **SHALL** generate insights asynchronously to meet the 3-second SLA.

- **FR 5.2.1** The 3-second SLA **SHALL** apply to trade entry completion and dashboard data update only, not to insights generation.
- **FR 5.2.2** Insights generation **SHALL** be queued asynchronously after trade commit.
- **FR 5.2.3** The dashboard **SHALL** show "Generating insights..." placeholder during generation.
- **FR 5.2.4** Insights **SHALL** load within 1-2 seconds via background process.

*Source: AI/NLP SME Phase 2 Q3, Q5*

### FR 5.3 Insights Regeneration Strategy

The system **SHALL** regenerate insights strategically to balance freshness with performance.

- **FR 5.3.1** The system **SHALL** regenerate insights after each trade under normal pace (<1 trade/minute).
- **FR 5.3.2** The system **SHALL** debounce 2-3 seconds for rapid submissions (>1 trade/minute).
- **FR 5.3.3** The system **SHALL** cache insights by session ID + trade count + hash of last 3 trades to prevent stale insights.
- **FR 5.3.4** The system **SHALL** regenerate if current_trade_count != cached_trade_count or last_trade_time changes.

*Source: AI/NLP SME Phase 2 Q8; Data Analytics SME Phase 2 Q3; Phase 4 Review - Cache Key Enhancement*

### FR 5.4 Small Session Insights

The system **SHALL** implement tiered insight generation based on trade count.

| Trade Count | Insight Type | Example |
|-------------|--------------|---------|
| 0 | Welcome message | "Ready to trade. Enter your first trade to begin tracking." |
| 1 | Initial assessment | "First trade complete. Starting to build your session pattern." |
| 2-4 | Early patterns | "2 wins so far. Watch for early discipline trends as session develops." |
| 5-9 | Meaningful patterns | Full analysis with trends |
| 10+ | Full analysis | Comprehensive behavioral analysis |

- **FR 5.4.1** The system **SHALL** show encouraging messages for fewer than 5 trades, not false confidence.
- **FR 5.4.2** The system **SHALL NOT** generate behavioral trend insights for fewer than 5 trades.

*Source: AI/NLP SME Phase 2 Q9*

### FR 5.5 Insight Categories

The system **SHALL** prioritize actionable insight categories in a specific order.

#### Tier 1: Immediate Risk Alerts
- **FR 5.5.1** Tilt Risk Indicator: Trigger at 2+ consecutive losses with discipline -1. Message: "Two losses in a row — consider stepping back for 5 minutes."
- **FR 5.5.1.1** Tilt warnings **SHALL** offer options rather than directives (e.g., "Consider: [take break] [reduce size] [log why]").
- **FR 5.5.2** Overconfidence Warning: Trigger at 3+ consecutive wins with +1 discipline. Message: "Three wins in a row — remember to size appropriately."
- **FR 5.5.3** Session Fatigue Alert: Trigger at 90+ minutes with declining discipline. Message: "You've been trading for 90+ minutes — decision quality typically declines."

#### Tier 2: Pattern Recognition (Show After 3+ Trades)
- **FR 5.5.4** Discipline Trajectory: Trigger at 3 consecutive -1 scores. Message: "Discipline scores trending down — what's driving this?"
- **FR 5.5.5** Agency Breakdown: Trigger at agency -1. Message: "Recent trade felt reactive — what was the trigger?"

#### Tier 3: Positive Reinforcement
- **FR 5.5.6** Streak Recognition: Trigger at 3+ win streak or 3+ disciplined trades. Message: "You're sticking to your plan — keep it up."
- **FR 5.5.7** Recovery Pattern: Trigger at positive discipline after recovering from loss. Message: "Good recovery after that loss — maintained discipline."

*Source: Behavioral Psychology SME Phase 2 Q2; Phase 4 Review - Warning Message Options*

### FR 5.6 Insight Presentation Standards

The system **SHALL** present insights in a trader-friendly format.

- **FR 5.6.1** Insights **SHALL** be 1-2 sentences maximum, action-oriented.
- **FR 5.6.2** Insights **SHALL** use conditional framing ("Your discipline score has dropped") rather than judgment ("You're losing control").
- **FR 5.6.3** Insights **SHALL** offer action, not diagnosis ("Consider a 5-minute break" vs. "You're tilting").
- **FR 5.6.4** Insights **SHALL** use color coding by severity: green (positive), yellow (caution), red (warning) — but use sparingly.
- **FR 5.6.5** Maximum 3 insights **SHALL** be displayed at once to avoid cognitive overload.
- **FR 5.6.6** Insights **SHALL** ensure meaningful positive reinforcement when patterns warrant, without mandating a specific percentage.

*Source: Behavioral Psychology SME Phase 1 Section 2.3; Behavioral Psychology SME Phase 1 Section 4.3; Behavioral Psychology SME Phase 2 Q2; Phase 4 Review - Removed 40% Quota*

---

## 6. Non-Functional Requirements

### NFR 1.0 Performance

The system **SHALL** meet strict latency requirements.

- **NFR 1.1** Trade entry to confirmed database write **SHALL** complete in under 3 seconds under normal conditions.
- **NFR 1.2** Dashboard data update **SHALL** complete synchronously within the 3-second SLA.
- **NFR 1.3** Insights generation **SHALL** complete within 1-2 seconds (async, non-blocking).
- **NFR 1.4** Database queries for dashboard load **SHALL** complete in under 10ms for typical sessions using pre-computed aggregates.

*Source: HLRD Section 5.1; AI/NLP SME Phase 2 Q3*

### NFR 2.0 Reliability

The system **SHALL** ensure data integrity and error recovery.

- **NFR 2.1** The AI extraction agent **SHALL** return valid, schema-conformant JSON response or surface a recoverable error.
- **NFR 2.2** The system **SHALL NOT** write partial records to the database.
- **NFR 2.3** Trade insert and aggregate update **SHALL** occur within the same database transaction.
- **NFR 2.4** Failed insights generation **SHALL** retry once, then show error state with retry button.
- **NFR 2.5** The system **SHALL** cache the last valid insights to display during regeneration.

*Source: HLRD Section 5.2; Data Analytics SME Phase 2 Q8*

### NFR 3.0 Usability

The system **SHALL** provide an intuitive, non-intrusive user experience.

- **NFR 3.1** The UI **SHALL** stay out of the way during live trading with minimal clicks and no required navigation.
- **NFR 3.2** The input **SHALL** remain persistent and accessible at all times.
- **NFR 3.3** The dashboard **SHALL** support assessment of session state in 3 seconds or less.
- **NFR 3.4** Insights **SHALL** be collapsible (collapsed by default after session establishes baseline).
- **NFR 3.5** No push notifications, pop-ups, or sound alerts **SHALL** interrupt active trading.
- **NFR 3.6** The system **SHALL** support keyboard navigation for the input field.

*Source: HLRD Section 4.4; Behavioral Psychology SME Phase 1 Section 4.1; Data Analytics SME Phase 1 Q1*

### NFR 4.0 Scalability

The system **SHALL** handle reasonable data volumes efficiently.

- **NFR 4.1** The system **SHALL** keep all trade data indefinitely for Phase 1 (no archival required).
- **NFR 4.2** Charts **SHALL** implement data windowing if session exceeds 50+ trades.
- **NFR 4.3** Chart components **SHALL** be memoized to prevent unnecessary re-renders.

*Source: Data Analytics SME Phase 2 Q7; Data Analytics SME Phase 1 Section 4*

### NFR 5.0 Accessibility

The system **SHALL** meet accessibility standards.

- **NFR 5.1** Color **SHALL NOT** be the only indicator (add icons, patterns, or labels).
- **NFR 5.2** Minimum contrast ratio of 4.5:1 **SHALL** be maintained for text.
- **NFR 5.3** Screen reader labels **SHALL** be included for all interactive elements.

*Source: Data Analytics SME Phase 1 Section 5*

---

## 7. Technical Implementation Constraints

### TIC 1.0 Stack Compliance

The system **SHALL** be implemented using the established technology stack.

- **TIC 1.1** Frontend **SHALL** use Next.js + TypeScript + Shadcn/ui + Tailwind CSS.
- **TIC 1.2** Backend **SHALL** use FastAPI + LangGraph + LangChain + OpenAI.
- **TIC 1.3** Database **SHALL** use TimescaleDB (PostgreSQL 16) + Drizzle ORM.
- **TIC 1.4** AI Interface **SHALL** use CopilotKit.
- **TIC 1.5** Charting **SHALL** use Recharts or Tremor (React-native, compatible with Shadcn/ui).

*Source: AGENTS.md Tech Stack Section*

### TIC 2.0 Integration Requirements

The system **SHALL** follow established integration patterns.

- **TIC 2.1** All CopilotKit traffic **SHALL** flow through the Next.js `/api/copilotkit` proxy.
- **TIC 2.2** The FastAPI backend **SHALL NOT** be exposed directly to the browser.
- **TIC 2.3** The trade extraction agent **SHALL** be implemented as a LangGraph node within the backend.
- **TIC 2.4** Backend endpoint **SHALL** use `add_langgraph_fastapi_endpoint` from `ag_ui_langgraph`.

*Source: AGENTS.md Integration Gotchas; AI/NLP SME Phase 4 Review - Package Name Verification*

---

## Success Criteria Checklist

- [ ] Trade entry to confirmed database write completes in under 3 seconds
- [ ] Extraction accuracy is high enough that manual corrections are rarely needed
- [ ] Discipline and agency scores feel fair and consistent to the trader
- [ ] AI insights feel relevant and specific to the session, not generic
- [ ] The UI stays out of the way during live trading
- [ ] Dashboard updates in real-time without page refresh
- [ ] Insights generation is asynchronous and non-blocking
- [ ] Graduated warning system activates at correct thresholds (3+ trades)
- [ ] Early session states handled gracefully with encouraging messages
- [ ] All requirements implemented using the established tech stack

---

## Synthesis Notes

### Cross-SME Decisions Resolved

1. **Extraction Architecture**: LangGraph node with validation is the definitive architecture (AI/NLP SME Q2, Phase 1)
2. **Insights Timing**: Asynchronous generation with loading state (AI/NLP SME Q5, Phase 2)
3. **Data Format**: Structured JSON with raw + aggregated (AI/NLP SME Q7, Phase 2)
4. **Warning Thresholds**: Minimum 3 trades before warnings; graduated response with confirmation requirement (Behavioral SME Q4, Phase 2 & Phase 4)
5. **Chart Visualization**: Running sum + individual markers + optional moving average (Data Analytics SME Q2, Phase 2)
6. **Aggregation Strategy**: Pre-computed columns, not materialized views or runtime queries (Data Analytics SME Q8, Phase 2)
7. **Small Session Handling**: Tiered approach by trade count (AI/NLP SME Q9, Phase 2)
8. **40% Positive Quota**: Removed - replaced with quality-based guidance to prevent false positives (Behavioral Psychology SME Phase 4)
9. **Cache Key**: Enhanced to include hash of recent trades (Data Analytics SME Phase 4)

### Tech Stack Validation

All synthesized requirements have been validated against the established tech stack in AGENTS.md:
- Frontend uses Next.js + TypeScript + Shadcn/ui + Tailwind CSS
- Backend uses FastAPI + LangGraph + LangChain + OpenAI
- Database uses TimescaleDB + Drizzle ORM
- AI uses CopilotKit for frontend integration
- No alternative technologies are recommended

### Phase 4 Review Feedback Incorporated

**AI/NLP SME (Critical/High Priority):**
- Added FR 2.6 Model Selection (gpt-4o-mini for extraction, gpt-4o for insights)
- Added FR 2.7 Extraction Reliability (timeout, API fallback)
- Added FR 2.8 Business Logic Validation (P&L range, direction validation)
- Added FR 2.9 Input Sanitization (prompt injection prevention)
- Added FR 2.10 Extraction Observability (logging for accuracy monitoring)
- Verified TIC 2.4 package name (ag_ui_langgraph is correct)

**Behavioral Psychology SME:**
- Removed FR 5.6.6 40% positive quota (replaced with quality guidance)
- Added FR 4.7 Cognitive Bias Mitigation
- Added FR 4.4.3.1 Warning confirmation requirement
- Added FR 4.7.4 Session average reference
- Added FR 4.8 Self-Report Calibration mechanism
- Added FR 4.1.2.1 Smooth color transitions
- Added FR 5.5.1.1 Warning message options

**Data Analytics SME:**
- Added explicit data types to FR 3.1 (DECIMAL/NUMERIC, VARCHAR, TIMESTAMPTZ)
- Added FR 3.5 Raw input storage
- Added FR 3.1.5 Additional index strategy
- Added FR 3.4 TimescaleDB hypertable specification
- Enhanced FR 4.1.4 tooltip with full field list
- Added FR 3.3 Data export (JSON/CSV)
- Added FR 4.2.6 Data windowing implementation
- Added FR 4.5.5 Empty state chart rendering
- Enhanced FR 5.1.1 avg_trade_interval calculation method
- Enhanced FR 5.3.3 Cache key with hash of recent trades

---

*Document prepared by: Product Manager Agent*
*Date: 2026-03-02*
*Sources: HLRD, AI/NLP SME Phase 1 & 2 & 4, Behavioral Psychology SME Phase 1 & 2 & 4, Data Analytics SME Phase 1 & 2 & 4, AGENTS.md*
