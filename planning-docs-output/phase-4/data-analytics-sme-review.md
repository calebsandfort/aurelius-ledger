# Data Analytics SME - Requirements Review

## Executive Summary

The requirements draft is well-structured and covers most data analytics concerns. However, there are several gaps and ambiguities that should be addressed before finalization. The majority of concerns relate to incomplete data model specifications, missing visualization details, and undefined data pipeline behaviors.

---

## 1. Data Model Review

### 1.1 Accuracy Issues

**FR 3.1 (Trade Persistence)** - The requirements specify storing trades in a `trades` table but do not define the exact schema. This is a significant gap.

- **Issue**: Missing data types for each field
- **Recommendation**: Add explicit data types:
  - `pnl` should be DECIMAL(10,2) or NUMERIC to handle precision correctly (never use FLOAT for currency)
  - `setup_description` should specify VARCHAR with appropriate length (suggest VARCHAR(2000))
  - `direction` should use ENUM or VARCHAR(10)
  - `outcome` should use ENUM or VARCHAR(20)
  - Timestamps should be TIMESTAMPTZ (timezone-aware)

**FR 3.1.3 (O(1) Aggregates)** - States "pre-computed columns" but does not specify implementation approach.

- **Issue**: Ambiguous whether this means database columns updated via triggers, application-level caching, or materialized columns
- **Recommendation**: Specify that session aggregates should be stored as columns on the `sessions` table, updated atomically via database triggers or application transaction logic

**FR 3.1.4 (Index Strategy)** - Only specifies indexing by (session_id, sequence_number).

- **Issue**: Missing indexes for common query patterns
- **Recommendation**: Add indexes for:
  - `(session_id, created_at)` for time-range queries within sessions
  - `(created_at)` for cross-session analytics queries
  - Consider composite index on `(user_id, session_date)` for multi-session queries in future phases

### 1.2 Completeness Issues

**Missing: Raw Input Storage**

- **Gap**: FR 2.0 extracts structured data but does not require storing the original natural language input
- **Recommendation**: Add FR 3.1.5: "The system SHALL store the original raw input text in a separate column for audit purposes and future re-processing"

**Missing: Data Retention Policy**

- **Gap**: NFR 4.1 states "no archival required for Phase 1" but lacks specifics
- **Recommendation**: Add explicit retention requirements:
  - Active session data: Immediate availability
  - Historical data: Indefinite storage for Phase 1
  - Consider adding FR 3.1.6: "The system SHALL support data export in JSON/CSV format for trader backup"

**Missing: TimescaleDB-Specific Optimizations**

- **Gap**: Using TimescaleDB but not leveraging hypertable partitioning
- **Recommendation**: Add FR 3.1.7: "The trades table SHALL be created as a TimescaleDB hypertable partitioned by time for optimal time-series performance"

---

## 2. Visualization Review

### 2.1 Accuracy Issues

**FR 4.1.4 (Tooltips)** - Specifies showing "trade number, timestamp, and cumulative total" but is incomplete.

- **Issue**: Missing critical tooltip data
- **Recommendation**: Tooltips should also include:
  - Individual trade P&L (not just cumulative)
  - Direction (long/short)
  - Discipline and agency scores for that trade

**FR 4.1.2 (Dynamic Coloring)** - States "green when above zero and red when below zero"

- **Issue**: This creates ambiguity at exactly zero (breakeven)
- **Recommendation**: Specify handling at exactly zero (suggest neutral gray or split green/red gradient)

### 2.2 Completeness Issues

**Missing: Chart Responsiveness**

- **Gap**: No requirements for responsive behavior on different screen sizes
- **Recommendation**: Add FR 4.1.6: "The P&L chart SHALL maintain aspect ratio and remain readable on screens as small as 768px width"

**Missing: Animation Specifications**

- **Gap**: FR 4.6.2 specifies "300-500ms smooth transitions" but lacks easing function specification
- **Recommendation**: Add specific easing (e.g., "ease-out-cubic") to ensure consistent feel across browsers

**Missing: Empty State Chart Rendering**

- **Gap**: FR 4.5 covers message states but not actual chart rendering behavior
- **Recommendation**: Specify that charts should render with empty state (axes visible, no data line) rather than hiding completely

**Missing: Data Point Limit**

- **Gap**: NFR 4.2 mentions data windowing for 50+ trades but doesn't specify implementation
- **Recommendation**: Add FR 4.2.6: "When session exceeds 50 trades, charts SHALL display rolling window of last 50 trades with option to view full history"

---

## 3. Data Pipeline Review

### 3.1 Accuracy Issues

**FR 5.1.1 (Session Summary)** - Specifies fields but some calculations are ambiguous.

- **Issue**: `avg_trade_interval_minutes` is potentially misleading
- **Recommendation**: Specify calculation method: is it mean time between trades, or median? Should it exclude gaps (e.g., lunch breaks)?

**FR 5.3.3 (Insights Cache)** - Specifies caching by "session ID + trade count"

- **Issue**: This cache key is insufficient - should also include hash of recent trades
- **Recommendation**: FR 5.3.3 should be: "cache by session ID + trade count + hash(last 3 trades)" to prevent stale insights

### 3.2 Completeness Issues

**Missing: Data Quality Validation**

- **Gap**: No explicit data quality checks at ingestion
- **Recommendation**: Add FR 3.2.1: "The system SHALL validate P&L values are within reasonable bounds (±$100,000 per trade) and flag outliers"

**Missing: Outlier Handling**

- **Gap**: No specification for handling statistical outliers in visualization
- **Recommendation**: Add FR 4.1.7: "Extreme P&L values (±3 standard deviations) SHALL be flagged in tooltips but still displayed"

---

## 4. Conflict Analysis

### 4.1 Potential Conflicts

**NFR 1.1 vs NFR 1.3 (Latency Requirements)**

- **Observation**: Trade entry must complete in under 3 seconds (including AI extraction), but FR 5.2.1 explicitly says insights generation is outside the SLA
- **Resolution**: This is correctly handled - no conflict, but worth noting the explicit exclusion

**FR 4.4.1 vs FR 5.5 (Warning Thresholds)**

- **Observation**: Behavioral warnings require minimum 3 trades (FR 4.4.1), but some Tier 1 alerts (FR 5.5.1) trigger on "2+ consecutive losses"
- **Resolution**: This is correctly handled - FR 4.4.1 applies to visual warnings, FR 5.5.1 applies to insight messages. However, clarify that Tier 1 alerts should also require minimum 3 trades

---

## 5. Additional Recommendations

### 5.1 Recommended New Requirements

**Data Export**
> FR 3.3.1: "The system SHALL support exporting session data as JSON for backup purposes"
> FR 3.3.2: "The system SHALL support exporting all trades as CSV for spreadsheet analysis"

**Data Privacy**
> FR 3.4.1: "P&L data SHALL be stored with encryption at rest using TimescaleDB encryption features"
> FR 3.4.2: "Setup descriptions SHALL be stored with encryption at rest as they may contain sensitive trading information"

**Cross-Session Analytics**
> FR 3.5.1: "The system SHALL support querying historical sessions for trend analysis (future Phase 2)"
> FR 3.5.2: "Session aggregates SHALL be computed using consistent methodology to enable cross-session comparison"

### 5.2 Suggested Wording Changes

**FR 3.1.1** - Change from:
> "The system SHALL store and update: total P&L, win count, loss count..."

To:
> "The system SHALL store and update: total_pnl (NUMERIC), win_count (INTEGER), loss_count (INTEGER), breakeven_count (INTEGER), net_discipline_score (INTEGER), net_agency_score (INTEGER), trade_count (INTEGER)"

**FR 4.1.4** - Change from:
> "The chart SHALL display tooltips on hover showing trade number, timestamp, and cumulative total"

To:
> "The chart SHALL display tooltips on hover showing: trade sequence number, timestamp (HH:MM:SS), individual trade P&L, cumulative P&L, direction (long/short), discipline score, and agency score"

---

## 6. Summary of Findings

| Category | Count |
|----------|-------|
| Accuracy Issues | 5 |
| Completeness Issues | 8 |
| Potential Conflicts | 2 (resolved) |
| Recommended New FRs | 6 |
| Recommended Wording Changes | 2 |

### Priority Items

1. **Critical**: Define exact database schema with data types (FR 3.1)
2. **Critical**: Add raw input storage requirement
3. **High**: Specify session aggregate implementation approach
4. **High**: Enhance tooltip data specification (FR 4.1.4)
5. **Medium**: Add data windowing implementation details (NFR 4.2)
6. **Medium**: Add TimescaleDB hypertable specification
7. **Low**: Add data export capabilities
8. **Low**: Consider data encryption requirements

---

## Questions for Other SMEs

**For AI/NLP SME:**
- How should the system handle trades where P&L extraction confidence is "low"? Should these trades be excluded from behavioral score calculations in insights?

**For Behavioral Psychology SME:**
- Should the warning system (FR 4.4) also apply to agency scores, or is discipline the primary indicator for visual warnings?

---

*Review prepared by: Data Analytics SME Agent*
*Date: 2026-03-02*
