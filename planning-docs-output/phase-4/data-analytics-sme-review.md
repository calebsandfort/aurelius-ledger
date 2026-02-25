# Data Analytics SME Review - Requirements Draft

**Review Date:** 2026-02-25
**Phase:** 4 - Requirements Review
**Analyst:** DataScientist SME

---

## Executive Summary

The requirements document provides a solid foundation for the Aurelius Ledger application. However, there are several areas requiring clarification, correction, or enhancement from a data analytics perspective. The primary concerns relate to rolling window logic ambiguity, missing data model fields, and incomplete visualization specifications.

---

## 1. Data Model Review

### 1.1 Trades Table (FR 6.0)

**Assessment:** Mostly sound with minor issues.

**Strengths:**
- Proper use of CHECK constraints for enumerated values (direction, outcome, discipline_score, agency_score)
- Nullable `pnl` field correctly handles ambiguous cases
- Foreign key reference to `trading_days(id)` supports relational integrity
- Composite index on `(trading_day_id, timestamp)` is appropriate for time-series queries

**Issues Identified:**

| Requirement | Issue | Recommendation |
|-------------|-------|----------------|
| FR 6.2 | Outlier flag is referenced but **not defined in the schema** | Add `is_outlier BOOLEAN` column to the trades table schema |
| FR 6.1 | Missing single-column index on `timestamp` | Add index for single-field time ordering queries |
| Confidence fields | TEXT type with string values ('high'/'medium'/'low') lacks formal constraint | Add CHECK constraint: `CHECK (confidence_discipline IN ('high', 'medium', 'low'))` |

---

### 1.2 Trading Days Table (FR 7.0)

**Assessment:** Conceptually correct but with significant logic ambiguity.

**Strengths:**
- Pre-computed aggregates are excellent for dashboard performance
- Rolling window columns (last_3, last_5) reduce query computation at display time
- Transactional update (FR 7.2) ensures data consistency

**Critical Issue - Rolling Window Ambiguity:**

There is a **fundamental conflict** between FR 5.1 (session-based rolling score) and FR 7.3 (day-based rolling window updates):

- **FR 5.1** states: "rolling 5-trade composite score: Sum(discipline_scores[-5:])" - this is **session-based** (last 5 trades in the current trading session)
- **FR 7.3** states: "update rolling window columns (last 3, last 5) at trade insert time" - stored in **trading_days** table
- The application is described as a "session-level" tool (Project Goal line 5), not a multi-day analytics platform

**Recommendation:**
- The rolling window columns in `trading_days` should be either:
  1. Removed (if sessions are truly single-day and FR 5.1 computation is sufficient), OR
  2. Clarified as "day's last 5 trades" for multi-day analysis (but this contradicts Phase 1 scope per FR 8.0 line 347: "Multi-day historical views" are out of scope)

**Suggested Schema Update:**

```sql
ALTER TABLE trades ADD COLUMN is_outlier BOOLEAN DEFAULT FALSE;
CREATE INDEX idx_trades_timestamp ON trades(timestamp);
CREATE INDEX idx_trades_discipline ON trades(discipline_score);
CREATE INDEX idx_trades_agency ON trades(agency_score);
```

---

## 2. Visualization Requirements Review

### 2.1 P&L Time Series Chart (FR 9.0)

**Assessment:** Well-specified with one performance concern.

| Requirement | Assessment | Notes |
|-------------|------------|-------|
| FR 9.1 (Area chart with gradient) | Good | Clear specification |
| FR 9.2 (Cumulative P&L) | Good | Correct metric choice |
| FR 9.3 (X-axis: trade sequence) | Good | Appropriate for session view |
| FR 9.6 (Green/red gradient) | Good | Intuitive coloring |
| FR 9.7 (Trade markers) | Good | Clear visual encoding |

**Performance Concern:**

Cumulative P&L must be computed from the trades table on each dashboard load. For a session with N trades, this requires O(N) computation. While acceptable for small N (typical trading session: 5-20 trades), this should be documented.

**Recommendation:** Consider adding a `cumulative_pnl` column to the trades table, computed at insert time:

```sql
ALTER TABLE trades ADD COLUMN cumulative_pnl DECIMAL(14,2);
-- Computed as: previous cumulative_pnl + new trade pnl
```

This would reduce dashboard load time from O(N) to O(1).

---

### 2.2 Discipline and Agency Score Charts (FR 10.0, FR 11.0)

**Assessment:** Generally good with one unclear requirement.

**FR 10.6 Issue - Ambiguous Combo Chart:**

> "The chart SHALL display a combo bar + line showing individual trade contributions as bars and cumulative trajectory as a line."

This requirement is unclear:
- What are "individual trade contributions" for discipline/agency scores?
- The scores are -1, 0, or +1 per trade - bar heights would be trivial
- If this means showing each trade's score as a bar with a running sum line, this is redundant with FR 10.1-10.3

**Recommendation:** Either clarify FR 10.6 to specify exactly what the bars represent, or simplify to just show the line chart with markers (as specified in FR 10.1).

**Suggested Rewording:**
> "The chart SHALL display individual trade scores as markers with a connected line showing the cumulative trajectory. Bar overlays MAY be used to show discrete trade-level scores if desired."

---

### 2.3 Dashboard Layout (FR 8.0)

**Assessment:** Sound visual hierarchy.

The layout correctly prioritizes:
1. Header KPIs (FR 8.1) - immediate session state assessment
2. P&L chart (FR 8.2) - primary success metric gets largest area
3. Behavioral score charts side-by-side (FR 8.3) - enables correlation assessment
4. AI Insights panel (FR 8.4) - secondary but accessible
5. Trade input (FR 8.5) - always accessible

This aligns with the NFR 5.2 requirement: "2 seconds to assess current session state."

---

## 3. Aggregates and Pre-Computation

### 3.1 Current Pre-Computation Strategy (FR 7.0)

The trading_days table pre-computes:
- Total P&L
- Win/loss/breakeven counts
- Net discipline and agency scores
- Rolling 3-trade and 5-trade sums (ambiguous - see section 1.2)

**Assessment:** Good foundation but incomplete.

**Missing Pre-Computed Aggregates:**

| Metric | Use Case | Recommendation |
|--------|----------|----------------|
| Session high P&L | Dashboard header display | Add `session_high_pnl` |
| Session low P&L | Risk assessment | Add `session_low_pnl` |
| Consecutive wins | Pattern recognition | Add `consecutive_wins` |
| Consecutive losses | FR 13.1 tilt detection | Add `consecutive_losses` |
| Average win size | Win rate analysis | Add `avg_win` |
| Average loss size | Risk analysis | Add `avg_loss` |

---

### 3.2 Composite Score Logic (FR 5.0)

**FR 5.1 - Rolling 5-Trade Composite:**
> Sum(discipline_scores[-5:]) + Sum(agency_scores[-5:])

**Edge Case Not Addressed:** What happens with fewer than 5 trades?
- Option A: Use available trades (e.g., 3 trades = sum of 3)
- Option B: Require minimum 5 trades before displaying

**Recommendation:** Explicitly specify behavior. For a session-based tool, Option A is more appropriate.

**FR 5.2 - Trend Direction:**
> Compare last 3 trades' average to previous 3 trades' average with threshold of 0.5

**Issue:** This requires 6+ trades to compute. What shows before then?
**Recommendation:** Add: "If fewer than 6 trades exist, display 'Insufficient data' or compare available trades to baseline."

---

## 4. Gaps and Missing Requirements

### 4.1 Data Quality

| Gap | Severity | Recommendation |
|-----|----------|----------------|
| No data validation rules for P&L magnitude | Medium | Add check: P&L should be within reasonable bounds (e.g., -$100,000 to +$100,000) |
| No duplicate detection | Low | Consider checking for near-duplicate timestamps (potential data entry errors) |
| No audit trail | Low | For Phase 1: acceptable. For future: add `updated_by`, `version` fields |

### 4.2 Query Performance

| Gap | Severity | Recommendation |
|-----|----------|----------------|
| No query timeout specifications | Low | Add NFR for query timeout (suggest: 500ms max) |
| No pagination for trade list | N/A | Out of scope for Phase 1 |

### 4.3 Visualization Completeness

| Gap | Severity | Recommendation |
|-----|----------|----------------|
| No specification for chart animations | Low | FR 16.2 mentions "animate smoothly" - specify animation duration (suggest: 300ms) |
| No responsive behavior specified | Medium | FR 8.5 mentions "all viewport sizes" but layout doesn't specify responsive breakpoints |
| No data export | N/A | Out of scope per line 353 |

---

## 5. Conflicts and Inconsistencies

### 5.1 Conflicting Requirements

**Conflict 1: Session vs. Day Rolling Windows**
- FR 5.1: Session-based rolling (last 5 trades)
- FR 7.3: Day-based rolling windows in trading_days
- Resolution needed: Either clarify scope or remove day-level rolling from trading_days

**Conflict 2: Outlier Detection Reference**
- FR 6.2: References "outlier flag computed at insert time"
- FR 6.0 Schema: No outlier column exists
- Resolution: Add `is_outlier` column to schema

**Conflict 3: Confidence Score vs. Confidence Level**
- FR 2.9: "return a confidence score" (numerical)
- FR 6.0 Schema: `confidence_discipline TEXT` ('high'/'medium'/'low')
- Resolution: Specify mapping from numerical score to categorical level

---

## 6. Recommendations Summary

### High Priority

1. **Add missing outlier column to trades table** (FR 6.2)
2. **Clarify rolling window logic** - session vs. day scope (FR 5.1, FR 7.3)
3. **Add CHECK constraints** for confidence fields
4. **Clarify FR 10.6** combo chart specification

### Medium Priority

5. **Add single-column indexes** on timestamp, discipline_score, agency_score
6. **Add additional pre-computed aggregates** (consecutive wins/losses, session high/low)
7. **Specify behavior for edge cases** (fewer than 5 trades for rolling score)
8. **Define confidence score to level mapping**

### Low Priority

9. **Add animation duration specification** (FR 16.2)
10. **Document cumulative P&L computation approach** for dashboard loads
11. **Consider pre-computing cumulative_pnl** in trades table for performance

---

## 7. Questions for Other SMEs

**For AI/NLP SME:**
- How is the confidence score (FR 2.9) calculated? What threshold determines 'high'/'medium'/'low'?
- What is the expected format for the "full session's trade data" passed to the insights agent (FR 12.2)?

**For Product Manager:**
- Is the trading_days table's rolling window meant for session use or multi-day analysis?
- Should the outlier flag (FR 6.2) be computed based on session statistics or all-time statistics?

**For Architect:**
- What is the expected data volume growth rate? This affects indexing and pre-computation strategy.
- Is there a plan to migrate from SQLite to a different database? (Pre-computed aggregates are more valuable in PostgreSQL with materialized views)

---

## Conclusion

The requirements document demonstrates good understanding of the user needs and technical constraints. The pre-computation strategy for the trading_days table is sound, and the visualization specifications generally align with best practices. However, the rolling window ambiguity and missing outlier field require resolution before implementation.

**Overall Assessment:** Acceptable with required corrections noted above.
