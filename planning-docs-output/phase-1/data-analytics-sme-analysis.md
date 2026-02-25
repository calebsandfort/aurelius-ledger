# Phase 1 SME Analysis: Data Scientist Perspective

## Question Analysis

### [SME:DataScientist] Dashboard Organization

**Question:** What would be an effective way to organize the dashboard to make it visually appealing, and ensure the trader can quickly assess their session state?

---

## Expert Analysis

### Dashboard Layout Recommendation

For a real-time trading dashboard during live sessions, the primary design principle should be **progressive disclosure** - giving the trader an immediate high-level status while allowing deeper exploration if needed. The layout should minimize cognitive load and support rapid decision-making.

#### Recommended Layout Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                        HEADER BAR                               │
│  [Session Time] [Total P&L] [Win/Loss] [Net Discipline]       │
├────────────────────────────────────┬────────────────────────────┤
│                                    │                            │
│       P&L TIME SERIES CHART        │      AI INSIGHTS PANEL    │
│       (Cumulative P&L over time)   │      (Latest Analysis)    │
│                                    │                            │
├─────────────────────┬──────────────┴────────────────────────────┤
│                     │                                           │
│   DISCIPLINE        │          AGENCY                           │
│   SCORE CHART      │          SCORE CHART                      │
│                     │                                           │
├─────────────────────┴───────────────────────────────────────────┤
│                    TRADE ENTRY INPUT                            │
│    [Natural language trade description input field]             │
└─────────────────────────────────────────────────────────────────┘
```

### Visual Hierarchy Strategy

**Tier 1 - Immediate Scan (Header):**
- Total P&L in large, high-contrast font (green for positive, red for negative)
- Win/Loss count as a ratio (e.g., "3-2")
- Net discipline score with color coding (green = positive, amber = neutral, red = negative)
- Session duration timestamp

**Tier 2 - Trend Assessment (Charts):**
- P&L chart as the largest visual element - this is the primary success metric
- Score charts side-by-side for behavioral correlation at a glance
- Charts should use consistent color encoding across all visualizations

**Tier 3 - Contextual Intelligence (Insights Panel):**
- Compact but scannable text insights
- Bullet-point format for quick comprehension
- Visual indicators for insight type (behavioral, performance, warning)

### Chart Design Specifications

#### P&L Time Series Chart
- **Type:** Area chart with gradient fill
- **X-axis:** Trade sequence number (1, 2, 3...) or timestamp
- **Y-axis:** Cumulative dollar P&L
- **Color:** Green fill above zero line, red fill below
- **Reference line:** Zero line prominently displayed
- **Interaction:** Hover tooltips showing individual trade P&L contribution

#### Discipline & Agency Score Charts
- **Type:** Line chart with markers
- **X-axis:** Trade sequence (matching P&L chart)
- **Y-axis:** Running sum of scores (-N to +N range)
- **Color encoding:**
  - Positive trend: Green line (#22c55e)
  - Neutral/flat: Amber line (#f59e0b)
  - Negative trend: Red line (#ef4444)
- **Zero reference line:** Subtle dashed line for baseline
- **Why running sum:** Shows trajectory and momentum - critical for behavioral patterns

### Color Scheme Recommendations

| Element | Color | Hex Code | Rationale |
|---------|-------|----------|-----------|
| Positive P&L | Green | #22c55e | Universal positive association |
| Negative P&L | Red | #ef4444 | Universal loss/warning |
| Positive Score | Emerald | #10b981 | Subtle green for behavioral metrics |
| Negative Score | Rose | #f43f5e | Subtle red for behavioral concerns |
| Neutral/Zero | Amber | #f59e0b | Attention without alarm |
| Background | Slate-950 | #020617 | Dark theme reduces eye strain during long sessions |
| Text Primary | Slate-50 | #f8fafc | High contrast for readability |
| Text Secondary | Slate-400 | #94a3b8 | Subtle labels and secondary info |

### Real-Time Update Considerations

- Charts should animate smoothly when new data points are added (Recharts supports this natively)
- Consider using optimistic UI updates - show the entry immediately while processing
- Implement connection status indicator if using WebSocket; for polling, show last-updated timestamp
- Dashboard should auto-scroll to show latest trade if list grows beyond viewport

### Data Presentation Best Practices

1. **Numeric formatting:**
   - P&L: `$+1,234.56` format with explicit sign for positives
   - Scores: Show as integers with sign (e.g., "+2", "0", "-1")
   - Percentages: One decimal place for win rate

2. **Empty state handling:**
   - Show placeholder charts with "No trades yet" message
   - Display input field prominently for first trade entry

3. **Responsive considerations:**
   - Charts should stack vertically on smaller screens
   - Maintain minimum chart heights (200px) for readability
   - Input field should remain accessible at all viewport sizes

### Recommended Tech Stack for Charts

- **Recharts** (already in project based on dependencies) - Good choice for React
- Key components: `AreaChart`, `LineChart`, `ComposedChart` for overlays
- Use `ResponsiveContainer` for fluid sizing

---

## Data Model Considerations

### Schema Recommendations

The `trades` table should include:

```typescript
interface Trade {
  id: string;
  direction: 'long' | 'short';
  outcome: 'win' | 'loss' | 'breakeven';
  pnl: number;           // Decimal stored as number
  timestamp: Date;       // Auto-populated
  setup_description: string;
  discipline_score: -1 | 0 | 1;
  agency_score: -1 | 0 | 1;
  trading_day_id: string;  // FK to trading_days
}
```

The `trading_days` table should maintain materialized aggregates:

```typescript
interface TradingDay {
  id: string;
  date: Date;             // Calendar date (UTC or local)
  total_pnl: number;      // Running sum
  win_count: number;
  loss_count: number;
  breakeven_count: number;
  net_discipline_score: number;  // Running sum
  net_agency_score: number;      // Running sum
  trade_count: number;
}
```

### Aggregation Strategy

- **At insert time:** Update `trading_days` aggregates in the same transaction as trade insert
- **Rationale:** This avoids recalculating on every dashboard load; the aggregates are pre-computed for real-time display
- **Indexing:** Composite index on `(trading_day_id, timestamp)` for efficient time-series queries

---

## Questions for Other SMEs

### For [SME:AIWorkflow]:

1. **Data context for insights agent:** What context should be passed to the insights agent - raw trade records, aggregated session stats, or both? Should insights be streamed or returned as a complete block?

2. **Score calculation edge cases:** How should the AI handle ambiguous trade descriptions where discipline or agency cannot be determined? Should it default to 0, or attempt to infer from other signals in the description?

3. **Extraction reliability:** What's the expected extraction accuracy threshold? If extraction fails, should we allow manual entry correction or reject the trade entirely?

### For [SME:BehavioralCoach]:

1. **Insight actionability:** What insight categories are most actionable for a trader mid-session? Should we prioritize setup consistency, discipline trend, risk of tilt based on score trajectory, or patterns in winning vs. losing trade descriptions?

2. **Score interpretation thresholds:** At what net discipline/agency score values should we trigger specific behavioral warnings? For example, should -3 net discipline trigger a "consider taking a break" insight?

3. **Behavioral pattern detection:** Beyond individual score trends, are there specific multi-trade patterns we should look for (e.g., discipline erosion after losses, revenge trading indicators) that would be valuable to surface in the insights panel?

---

## Summary

The dashboard should be organized with a clear visual hierarchy that places P&L as the primary metric, followed by behavioral score trends, then AI-generated insights. The layout should support rapid scanning during live trading while providing sufficient context for behavioral self-assessment. The dark theme with consistent color encoding (green=positive, red=negative, amber=neutral) provides immediate cognitive recognition of session state. Pre-computed aggregates in the database ensure sub-second dashboard load times, supporting the 3-second end-to-end requirement.
