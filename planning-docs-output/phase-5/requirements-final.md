# Aurelius Ledger Requirements Document

## Project Goal

The Aurelius Ledger is a lightweight web application for logging futures trades during live trading sessions. The system enables frictionless natural language trade logging with AI-powered behavioral scoring and real-time session insights, helping traders improve their discipline and decision-making.

---

## Functional Requirements

### FR 1.0 Trade Entry System

The system SHALL accept free-form natural language trade descriptions through a persistent text input field at the bottom of the dashboard.

- **FR 1.1** The system SHALL clear the input field upon successful trade submission.
- **FR 1.2** The system SHALL auto-populate the trade timestamp at the moment of submission.
- **FR 1.3** The system SHALL require no specific format or structure from the user.
- **FR 1.4** The system SHALL process one trade per submission.

### FR 2.0 AI Trade Extraction

The system SHALL extract structured data from natural language trade descriptions using an AI agent.

- **FR 2.1** The system SHALL extract the following required fields from each trade description:
  - `direction`: "long" or "short"
  - `outcome`: "win", "loss", or "breakeven"
  - `pnl`: Decimal dollar value (positive for wins, negative for losses)
  - `setup_description`: Natural language summary of the trade setup
  - `discipline_score`: Integer value of -1, 0, or 1
  - `agency_score`: Integer value of -1, 0, or 1

- **FR 2.2** The system SHALL use a LangGraph-based extraction pipeline with a validation step that retries on schema mismatch.

- **FR 2.3** The system SHALL include 3-5 few-shot examples in the extraction prompt covering: clear wins, clear losses, breakeven trades, ambiguous discipline/agency, and minimal descriptions.

- **FR 2.4** The system SHALL apply heuristic mapping for ambiguous P&L phrases:
  - "small winner": $50-$100
  - "small loser": -$50 to -$100
  - "nice win": $200-$500
  - "big loser": -$500+
  - "breakeven" / "scratched": $0

- **FR 2.5** The system SHALL return confidence scores (0.0-1.0) alongside discipline and agency scores.

- **FR 2.6** The system SHALL handle confidence levels as follows:
  - High confidence (0.85-1.0): Display score normally
  - Medium confidence (0.60-0.84): Display score with subtle indicator
  - Low confidence (0.00-0.59): Display as "insufficient signal" and exclude from rolling averages

- **FR 2.7** The system SHALL return an error if P&L cannot be determined from the description.

- **FR 2.8** The system SHALL surface clear user-facing errors when extraction fails, including specific guidance on what information is missing.

- **FR 2.9** The extraction system prompt SHALL include behavioral scoring criteria (FR 3.1-3.7) as part of the extraction instructions to enable single-pass extraction of all fields.

### FR 3.0 Behavioral Scoring

The system SHALL infer behavioral scores from trade descriptions to track trading psychology.

- **FR 3.1** The system SHALL assign discipline_score = 1 for language indicating patience and intentional execution (e.g., "waited for confirmation," "followed my plan," "patient entry").

- **FR 3.2** The system SHALL assign discipline_score = -1 for language indicating reactive or impulsive execution (e.g., "chased," "fomo'd," "revenge trade," "didn't wait").

- **FR 3.3** The system SHALL assign discipline_score = 0 when behavioral signals are absent or ambiguous.

- **FR 3.4** The system SHALL assign agency_score = 1 for language indicating intentional action (e.g., "decided to," "chose to," "my call").

- **FR 3.5** The system SHALL assign agency_score = -1 for language indicating loss of control (e.g., "knew better but couldn't help it," "lost control").

- **FR 3.6** When discipline and agency scores conflict, the agency score SHALL take precedence for behavioral insight purposes.

- **FR 3.7** The system SHALL detect self-deprecating language patterns and assign agency_score = -1 for:
  - External attribution on wins (e.g., "got lucky," "market gave me that one")
  - Internal attribution on losses (e.g., "I messed up," "I'm so stupid")

### FR 4.0 Data Persistence

The system SHALL persist trade data to a relational database.

- **FR 4.1** The system SHALL create a `trading_days` record automatically when the first trade of a calendar day is logged.

- **FR 4.2** The system SHALL maintain running aggregates in the `trading_days` table after each trade insertion:
  - Total P&L
  - Win count, loss count
  - Running sum of discipline scores
  - Running sum of agency scores

- **FR 4.3** The system SHALL store confidence scores and estimated P&L flags in the database for later analysis.

- **FR 4.4** The system SHALL implement the following denormalized session metrics:
  - peak_pnl (highest cumulative P&L)
  - trough_pnl (lowest cumulative P&L)
  - largest_win, largest_loss
  - consecutive_wins, consecutive_losses

- **FR 4.5** The system SHALL store all timestamps in UTC.

- **FR 4.6** The system SHALL display timestamps in the user's configured timezone.

### FR 5.0 Dashboard Display

The system SHALL display current-day trading data in a real-time dashboard.

- **FR 5.1** The system SHALL display only current-day data in the dashboard (not historical).

- **FR 5.2** The dashboard SHALL use a 2x2 grid layout with:
  - P&L Time Series Chart (top-left, primary)
  - Discipline Score Chart (top-right)
  - Agency Score Chart (bottom-left)
  - AI Insights Panel (bottom-right)

- **FR 5.3** The P&L chart SHALL display cumulative P&L over time using smooth line interpolation.

- **FR 5.4** The discipline and agency charts SHALL use step interpolation (discrete values, not continuous lines).

- **FR 5.5** The dashboard SHALL include a header summary bar with:
  - Session P&L
  - Trade count
  - Win rate
  - Average Win Amount
  - Average Loss Amount
  - Session duration

- **FR 5.6** The P&L chart SHALL use green (#22c55e) for positive values and red (#ef4444) for negative values.

- **FR 5.7** The discipline and agency charts SHALL use blue (#3b82f6) for positive trends and amber (#f59e0b) for negative trends.

- **FR 5.8** The system SHALL provide a collapsible insights panel with a "peek" state showing one insight by default.

- **FR 5.9** The system SHALL use Recharts for dashboard visualizations.

### FR 6.0 Real-Time Updates

The system SHALL update the dashboard in real-time after each trade is logged without page refresh.

- **FR 6.1** The system SHALL use WebSocket connections for real-time updates.

- **FR 6.2** The system SHALL implement adaptive throttling:
  - Immediate updates during active trading (within 30 seconds of last trade)
  - Heartbeat every 10 seconds during idle state
  - Maximum 2 updates per second during fast market mode

- **FR 6.3** Chart updates SHALL use instant updates with 150ms transition for normal conditions.

- **FR 6.4** The most recent data point SHALL have a subtle pulse animation to indicate current state.

### FR 7.0 AI Insights Generation

The system SHALL generate actionable behavioral insights after each trade is logged.

- **FR 7.1** The system SHALL pass both raw trade records AND aggregated session stats to the insights agent (hybrid context).

- **FR 7.2** The system SHALL include the last 7 trades with full detail plus full-session aggregated statistics in the insights context.

- **FR 7.3** Insights SHALL be generated asynchronously and returned as a complete block (not streamed).

- **FR 7.4** Insights SHALL be generated using a structured `SessionSummary` interface containing:
  - pnl_statistics (total, average, largest_win, largest_loss)
  - outcome_distribution (wins, losses, breakeven counts and percentages)
  - discipline_trend (current score, rolling average, trajectory)
  - agency_trend (current score, rolling average, trajectory)
  - recent_trades (last 7 trades with full detail)

- **FR 7.5** The system SHALL prioritize insights in the following order:
  1. Tilt Risk Indicator (highest priority)
  2. Discipline Trajectory
  3. Agency Trend
  4. Outcome Patterns

- **FR 7.6** The system SHALL calculate a Tilt Risk Score using:
  - Consecutive losses (weighted x2)
  - Discipline decline rate
  - Agency decline rate

- **FR 7.7** The tilt risk thresholds SHALL be:
  - 0-1: No alert
  - 2-3: Yellow alert ("Consider taking a breath before next entry")
  - 4+: Red alert ("You may be tilted. Consider stepping away.")

- **FR 7.8** Insights SHALL differ based on session phase:
  - Mid-session (during active trading): Maximum 2-3 insights, processable in <2 seconds
  - Post-session: Up to 150 words, can reference multiple trades and historical data

- **FR 7.9** The system SHALL display a maximum of 3 insight items at a time.

- **FR 7.10** Generated insights SHALL be stored with the trade record to prevent regeneration on retry (idempotency).

### FR 8.0 Visual Warnings

The system SHALL provide visual alerts for behavioral warning patterns.

- **FR 8.1** The system SHALL trigger a yellow visual warning when:
  - 3 consecutive discipline -1 scores occur
  - Discipline score crosses below 0
  - Agency score crosses below 0

- **FR 8.2** The system SHALL trigger a red visual warning when:
  - 3+ consecutive losses AND average discipline score < 0
  - Cumulative discipline drops below -3
  - P&L drops below -$500 with negative discipline

- **FR 8.3** Visual warnings SHALL use subtle color tinting on chart areas, not intrusive blocking elements.

### FR 9.0 Positive Reinforcement

The system SHALL recognize and reinforce positive behavioral patterns.

- **FR 9.1** The system SHALL generate a "strengths highlight" when:
  - A trader maintains positive discipline through volatility
  - A trader demonstrates recovery after a loss (good agency)
  - Win rate exceeds 60% with positive discipline

- **FR 9.2** Positive insights SHALL use active, affirming language ("Your patience paid off" vs "Good discipline score").

### FR 10.0 Recovery Detection

The system SHALL detect and highlight behavioral recovery.

- **FR 10.1** The system SHALL detect behavioral recovery (positive discipline after 2+ consecutive negative scores) and highlight this in insights.

- **FR 10.2** Recovery insights SHALL be prioritized to reinforce successful self-regulation.

### FR 11.0 Session Management

The system SHALL support end-of-session rituals.

- **FR 11.1** The system SHALL provide an end-of-session summary when no trades occur for 30+ minutes during market hours.

- **FR 11.2** Session summary SHALL include:
  - Win rate
  - Discipline trend
  - One key insight
  - Comparison to previous sessions (optional)

### FR 12.0 Historical Data Access

The system SHALL provide access to historical trading sessions.

- **FR 12.1** The system SHALL provide a historical sessions list view showing past trading days with summary metrics.

- **FR 12.2** The system SHALL allow users to select a historical trading day to view its dashboard (read-only).

### FR 13.0 Data Export

The system SHALL enable data export for external analysis.

- **FR 13.1** The system SHALL provide JSON export of individual trading day data.

- **FR 13.2** The system SHALL provide CSV export of trading day summaries for external analysis.

### FR 14.0 Data Quality

The system SHALL validate incoming data to maintain data integrity.

- **FR 14.1** The system SHALL validate that P&L falls within reasonable bounds (|pnl| <= $100,000).

- **FR 14.2** The system SHALL compare extracted timestamps against server time and flag entries with >60 second drift.

- **FR 14.3** The system SHALL log score distribution and alert if >30% of entries receive 0 (ambiguous), indicating extraction may need tuning.

### FR 15.0 Database Schema

The system SHALL implement a well-defined database schema.

- **FR 15.1** The system SHALL create a `trades` table with the following schema:
  - `id`: UUID PRIMARY KEY
  - `trading_day_id`: UUID FOREIGN KEY
  - `timestamp`: TIMESTAMPTZ NOT NULL
  - `direction`: VARCHAR(5) NOT NULL
  - `outcome`: VARCHAR(10) NOT NULL
  - `pnl`: DECIMAL(12,2) NOT NULL
  - `setup_description`: TEXT
  - `discipline_score`: INTEGER NOT NULL
  - `agency_score`: INTEGER NOT NULL
  - `confidence_score`: DECIMAL(3,2)
  - `is_estimated_pnl`: BOOLEAN DEFAULT FALSE
  - `insight_text`: TEXT (stored for idempotency)

- **FR 15.2** The system SHALL create a `trading_days` table with the following schema:
  - `id`: UUID PRIMARY KEY
  - `date`: DATE NOT NULL UNIQUE
  - `total_pnl`: DECIMAL(14,2)
  - `win_count`: INTEGER DEFAULT 0
  - `loss_count`: INTEGER DEFAULT 0
  - `breakeven_count`: INTEGER DEFAULT 0
  - `discipline_sum`: INTEGER DEFAULT 0
  - `agency_sum`: INTEGER DEFAULT 0
  - `peak_pnl`: DECIMAL(14,2)
  - `trough_pnl`: DECIMAL(14,2)
  - `largest_win`: DECIMAL(12,2)
  - `largest_loss`: DECIMAL(12,2)
  - `consecutive_wins`: INTEGER DEFAULT 0
  - `consecutive_losses`: INTEGER DEFAULT 0

- **FR 15.3** The system SHALL configure `trades` as a TimescaleDB hypertable with time-based partitioning on `timestamp`.

- **FR 15.4** The system SHALL create a continuous aggregate `trades_hourly_agg` for hourly rollups after 90 days.

---

## Non-Functional Requirements

### NFR 1.0 Performance

The system SHALL meet strict latency requirements for real-time trading workflows.

- **NFR 1.1** Trade entry to confirmed database write SHALL complete in under 3 seconds under normal conditions.

- **NFR 1.2** The extraction LLM call SHALL timeout at 2.5 seconds with graceful fallback to user-facing error.

- **NFR 1.3** WebSocket updates SHALL deliver with <50ms latency.

- **NFR 1.4** Chart re-renders SHALL use requestAnimationFrame to sync with browser paint cycle.

- **NFR 1.5** Chart updates SHALL debounce at 100ms after last WebSocket message before re-rendering.

- **NFR 1.6** Insights generation prompt SHALL not exceed 2500 tokens including context.

### NFR 2.0 Reliability

The system SHALL handle errors gracefully without data loss.

- **NFR 2.1** The extraction pipeline SHALL retry up to 2 times on validation failure, using a refined prompt with additional context on the second attempt, before surfacing an error.

- **NFR 2.2** Failed extractions SHALL be logged for analysis and prompt refinement.

- **NFR 2.3** Extraction logs SHALL include prompt version identifier for analysis and iteration.

- **NFR 2.4** The system SHALL handle WebSocket disconnection gracefully with fallback to 2-second polling.

- **NFR 2.5** Partial success states SHALL be handled: if trade saves but insights fail, user SHALL see "Trade saved but insights unavailable. Try refreshing."

### NFR 3.0 Usability

The system SHALL provide a frictionless user experience optimized for busy traders.

- **NFR 3.1** Insights SHALL be displayable in under 2 seconds of glancing at the dashboard.

- **NFR 3.2** The system SHALL minimize cognitive load by using visual indicators (color coding, arrows) alongside text.

- **NFR 3.3** The system SHALL use neutral, action-oriented framing for warnings and positive reinforcement for good patterns (neither loss-framing nor gain-framing).

- **NFR 3.4** The system SHALL use observational tone in insights ("Discipline score declining" vs. "You're being undisciplined").

- **NFR 3.5** The system SHALL never make the trader feel judged or ashamed through shame-inducing language.

- **NFR 3.6** The dashboard SHALL support dark theme to reduce eye strain during extended sessions.

### NFR 4.0 Scalability

The system SHALL handle reasonable trading volumes efficiently.

- **NFR 4.1** The database SHALL use composite indexes on (trading_day_id, timestamp) for time-series queries.

- **NFR 4.2** The database SHALL use indexes for "most recent trade" lookup with (trading_day_id DESC, timestamp DESC).

- **NFR 4.3** Dashboard queries SHALL use denormalized session metrics for O(1) access to aggregate data.

### NFR 5.0 Data Retention

The system SHALL implement appropriate data retention policies.

- **NFR 5.1** Raw trade data SHALL be retained in hot storage for 90 days.

- **NFR 5.2** Raw trade data SHALL be moved to cold storage after 90 days, retained for 365 days total.

- **NFR 5.3** Daily aggregate summaries SHALL be retained for 2 years.

- **NFR 5.4** Monthly aggregate summaries SHALL be retained indefinitely.

### NFR 6.0 Privacy

The system SHALL protect user data and enable user control.

- **NFR 6.1** Insights personalization SHALL be session-only, with no cross-session behavioral profiles stored.

- **NFR 6.2** All LLM inference SHALL happen without storing conversation context.

- **NFR 6.3** The system SHALL provide users the ability to delete their data.

- **NFR 6.4** The system SHALL NOT share or sell behavioral data.

---

## Synthesis Notes

### Technology Stack Validation

All synthesized requirements have been validated against the established tech stack: Next.js, TypeScript,, Tailwind CSS Shadcn/ui, Better Auth, Drizzle ORM, CopilotKit, FastAPI, LangGraph, LangChain, OpenAI, TimescaleDB, Docker Compose.

Key architectural decisions aligned with stack:
- **LangGraph for extraction**: Uses LangGraph as required by stack
- **FastAPI backend**: LLM calls handled on backend, not in Next.js API routes
- **CopilotKit integration**: Insights panel integrates with CopilotKit for AI interaction
- **TimescaleDB**: Retention policies use TimescaleDB hyperchunks capability
- **Recharts**: Specified as charting library per Data Analytics SME recommendation

### Conflict Resolution

1. **Loss-Framing Conflict**: Behavioral Psychology SME identified that NFR 3.3 (loss-framing) contradicts behavioral science research. Resolved: Changed to neutral, action-oriented framing.

2. **Streaming vs Complete Block for Insights**: AI/NLP SME recommended complete block return. Behavioral SME's concern about latency is addressed by asynchronous generation after trade write. This prioritizes quality over perceived speed.

3. **Chart Animation**: Data Analytics SME recommended instant updates with 150ms transition. Behavioral SME recommended minimizing insights after 10 seconds. These are complementary: fast data updates with quick-dismiss UI.

4. **Color Scheme for Behavioral Scores**: Data Analytics SME correctly specified blue/amber (not red) for behavioral scores to mitigate loss aversion. This aligns with Behavioral SME's concern about avoiding "everything is red" spiral.

5. **Mobile Support**: HLRD excludes mobile, but Data Analytics SME recommended responsive design for "good enough" read-only access. Requirements reflect HLRD exclusion but note responsive design as enhancement.

6. **Insights Idempotency**: Added FR 7.10 to store generated insights with trade record, addressing AI/NLP SME concern about retry producing different insights.

### Changes Incorporated from Phase 4 Reviews

**AI/NLP SME:**
- Added FR 2.9: Behavioral scoring criteria in extraction prompt
- Added NFR 1.6: Token budget (2500 tokens max)
- Added NFR 2.1 revision: Refined prompt with additional context on retry
- Added NFR 2.3: Prompt version tracking
- Added FR 7.10: Insights idempotency

**Behavioral Psychology SME:**
- Revised NFR 3.3: Removed loss-framing, use neutral action-oriented framing
- Added FR 9.1-9.2: Positive reinforcement for good patterns
- Added FR 10.1-10.2: Recovery detection and highlighting
- Added FR 11.1-11.2: Session closure summary
- Enhanced FR 3.7: Added internal attribution on losses detection

**Data Analytics SME:**
- Added FR 4.5-4.6: Timezone handling (UTC storage, user timezone display)
- Added FR 5.5 revision: Average Win/Loss amounts in header
- Added FR 5.9: Recharts as charting library
- Added FR 12.1-12.2: Historical data access
- Added FR 13.1-13.2: Data export capabilities
- Added FR 15.1-15.4: Database schema specifications (trades, trading_days tables, TimescaleDB hypertable, continuous aggregates)

---

## Success Criteria Checklist

- [ ] Trade entry to confirmed database write completes in under 3 seconds
- [ ] Extraction accuracy is high enough that manual corrections are rare
- [ ] Discipline and agency scores feel fair and consistent
- [ ] AI insights feel relevant and specific, not generic
- [ ] UI stays out of the way during live trading (minimal clicks, no navigation required)
- [ ] Real-time dashboard updates without page refresh
- [ ] Visual warnings are actionable but not intrusive
- [ ] The system never makes the trader feel judged or ashamed
- [ ] Positive behavioral patterns are recognized and reinforced
- [ ] Recovery from negative patterns is highlighted and celebrated
- [ ] End-of-session summaries provide meaningful closure

---

*Requirements document finalized from Phase 4 SME reviews.*
*Established Tech Stack: Next.js, TypeScript, Shadcn/ui, Tailwind CSS, Better Auth, Drizzle ORM, CopilotKit, FastAPI, LangGraph, LangChain, OpenAI, TimescaleDB, Docker Compose*
