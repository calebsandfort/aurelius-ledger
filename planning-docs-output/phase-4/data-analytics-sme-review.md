# Data Analytics SME Review: Requirements Draft

**Review Date:** 2026-03-02
**Phase:** 4 - SME Requirements Review
**SME Domain:** Data Modeling, Visualization, Analytics, Time-Series

---

## Executive Summary

The requirements draft is well-structured and incorporates most of the Data Analytics SME recommendations from Phase 1. However, there are several gaps related to database schema specifics, historical data access, and visualization implementation details that should be addressed before finalization.

---

## Accuracy Assessment

### Correctly Implemented Recommendations

| Phase 1 Recommendation | Status | Notes |
|------------------------|--------|-------|
| 2x2 grid dashboard layout | **IMPLEMENTED** | FR 5.2 specifies layout correctly |
| P&L top-left, behavioral charts surrounding insights | **IMPLEMENTED** | Correct quadrant placement |
| Green positive / red negative P&L | **IMPLEMENTED** | FR 5.6 uses exact colors (#22c55e, #ef4444) |
| Blue positive / amber negative behavioral | **IMPLEMENTED** | FR 5.7 correctly avoids red for behavioral |
| Step interpolation for discipline/agency | **IMPLEMENTED** | FR 5.4 explicitly states this |
| Summary header with KPIs | **IMPLEMENTED** | FR 5.5 includes session P&L, trade count, win rate, duration |
| Denormalized session metrics | **IMPLEMENTED** | FR 4.4 specifies all recommended fields |
| Composite indexing strategy | **IMPLEMENTED** | NFR 4.1, 4.2 match recommendations |
| P&L bounds validation | **IMPLEMENTED** | FR 9.1 validates <= $100,000 |
| Timestamp drift detection | **IMPLEMENTED** | FR 9.2 flags >60 second drift |
| Score distribution monitoring | **IMPLEMENTED** | FR 9.3 alerts if >30% receive 0 |
| Dark theme support | **IMPLEMENTED** | NFR 3.6 specifies dark theme |
| Pulse animation for current state | **IMPLEMENTED** | FR 6.4 |
| Retention policies | **IMPLEMENTED** | NFR 5.1-5.4 match recommendations |

**Accuracy Verdict:** The requirements that were incorporated are accurate and correctly specified.

---

## Completeness Assessment

### Missing Requirements

#### 1. Database Schema Specification (CRITICAL)

**Issue:** The requirements mention TimescaleDB but do not specify the actual schema structure.

**Missing Requirements:**
- No explicit `trades` table schema with column definitions
- No `trading_days` table schema beyond aggregate fields
- No TimescaleDB hypertable configuration
- No continuous aggregates for automatic data rollup

**Recommended Additions:**
```
FR X.X: The system SHALL create a `trades` table with the following schema:
  - id: UUID PRIMARY KEY
  - trading_day_id: UUID FOREIGN KEY
  - timestamp: TIMESTAMPTZ NOT NULL
  - direction: VARCHAR(5) NOT NULL
  - outcome: VARCHAR(10) NOT NULL
  - pnl: DECIMAL(12,2) NOT NULL
  - setup_description: TEXT
  - discipline_score: INTEGER NOT NULL
  - agency_score: INTEGER NOT NULL
  - confidence_score: DECIMAL(3,2)
  - is_estimated_pnl: BOOLEAN DEFAULT FALSE

FR X.X: The system SHALL configure `trades` as a TimescaleDB hypertable with time-based partitioning on `timestamp`.

FR X.X: The system SHALL create a continuous aggregate `trades_hourly_agg` for hourly rollups after 90 days.
```

#### 2. Historical Data Access (MEDIUM PRIORITY)

**Issue:** The requirements focus exclusively on current-day display (FR 5.1) with no mechanism for historical analysis.

**Current Gap:** Users cannot view past trading sessions, trends, or perform week-over-week analysis.

**Recommended Addition:**
```
FR X.X: The system SHALL provide a historical sessions list view showing past trading days with summary metrics.

FR X.X: The system SHALL allow users to select a historical trading day to view its dashboard (read-only).
```

#### 3. Chart Library Specification (MEDIUM PRIORITY)

**Issue:** No specification of which charting library will be used.

**Impact:** Cannot verify compatibility with animation, theming, and real-time update requirements.

**Recommended Addition:**
```
FR X.X: The system SHALL use Recharts for dashboard visualizations.
```

#### 4. Average Win/Loss Metrics (LOW PRIORITY)

**Issue:** Phase 1 recommended avg win and avg loss in the summary header, but only trade count and win rate were included.

**Current:** FR 5.5 specifies: Session P&L, Trade count, Win rate, Session duration

**Recommended Addition:**
```
FR 5.5 (revision): The dashboard SHALL include a header summary bar with:
  - Session P&L
  - Trade count
  - Win rate
  - Average Win Amount
  - Average Loss Amount
  - Session Duration
```

#### 5. Timezone Handling (MEDIUM PRIORITY)

**Issue:** No specification of timezone handling for timestamps.

**Recommended Addition:**
```
FR X.X: The system SHALL store all timestamps in UTC.

FR X.X: The system SHALL display timestamps in the user's configured timezone.
```

#### 6. Data Export Capability (LOW PRIORITY)

**Issue:** Phase 1 mentioned export functionality for Phase 2+ but no requirements were added.

**Recommended Addition:**
```
FR X.X: The system SHALL provide JSON export of individual trading day data.

FR X.X: The system SHALL provide CSV export of trading day summaries for external analysis.
```

---

## Gaps Assessment

### Phase 1 Recommendations Not Incorporated

1. **Average Win/Loss Display** - Not in FR 5.5 summary bar
2. **Structured Session Summary for AI** - FR 7.2 mentions raw records + stats but doesn't specify the `SessionSummary` interface structure
3. **Export Functionality** - Deferred but no roadmap
4. **Historical Access** - Not addressed at all
5. **TimescaleDB Hypertable Configuration** - Mentioned in stack but no schema requirements

### Questions for Other SMEs (Cross-Domain Concerns)

**For AI/NLP SME:**
- How should the structured session summary be formatted for the insights agent? Should we use the `SessionSummary` interface format with pnl statistics, outcome distribution, discipline/agency trends, and recentTrades?

**For Behavioral Psychology SME:**
- Should historical session comparison be included (e.g., "This week's discipline is 20% lower than last week")?

---

## Conflicts Assessment

### No Major Conflicts Found

The requirements are consistent with the tech stack. Minor observations:

1. **TimescaleDB Usage:** The requirements mention TimescaleDB but don't fully leverage its features. This is a gap, not a conflict - the implementation will naturally use TimescaleDB capabilities.

2. **Real-Time Updates:** The WebSocket + polling fallback (NFR 2.3) is well-designed and doesn't conflict with other requirements.

3. **Color Scheme:** Correctly uses blue/amber for behavioral to avoid loss aversion triggers, as recommended.

---

## Best Practices Assessment

### Data Engineering Standards

| Aspect | Status | Notes |
|--------|--------|-------|
| Indexing strategy | **GOOD** | Composite indexes properly specified |
| Denormalization | **GOOD** | Session metrics for O(1) queries |
| Retention policy | **GOOD** | Tiered approach (hot/cold/monthly) |
| Data validation | **GOOD** | P&L bounds, timestamp drift, score distribution |
| Real-time optimization | **GOOD** | Adaptive throttling, debouncing |

### Recommendations for Phase 5 (Tech Spec)

The following should be added to the technical specification:

1. **Complete DDL for all tables** (trades, trading_days, insights)
2. **TimescaleDB hypertable creation scripts**
3. **Continuous aggregate definitions** for automatic hourly/daily rollups
4. **Recharts component specifications** with proper typing
5. **API response schemas** for dashboard endpoints

---

## Summary of Required Changes

### Critical (Must Fix)
1. Add database schema specifications (tables, columns, types)
2. Specify TimescaleDB hypertable configuration

### Medium Priority (Should Fix)
3. Add historical sessions access requirements
4. Specify chart library (Recharts recommended)
5. Add average win/loss to summary header
6. Add timezone handling requirements

### Low Priority (Nice to Have)
7. Add data export requirements
8. Specify structured SessionSummary interface for AI context

---

## Conclusion

The requirements draft is **85% complete** from a data analytics perspective. The core recommendations from Phase 1 have been correctly incorporated, and the data model design is sound. The main gaps are in schema specification and historical data access, which should be addressed before moving to technical specification.

**Recommendation:** Approve with the additions noted above for Phase 5 technical specification.

---

*Reviewed by: Data Analytics SME*
*Tech Stack: Next.js, TypeScript, TimescaleDB, Drizzle ORM*
