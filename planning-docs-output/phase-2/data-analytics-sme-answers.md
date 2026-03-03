# Data Analytics SME Answers: Cross-SME Questions

*Answers prepared for Phase 2 of the Aurelius Ledger requirements elaboration workflow.*

---

## From AI/NLP SME

### Question 1: Dashboard Layout

**For a trader during live sessions, what is the optimal chart arrangement? Should P&L be prominent with scores as secondary, or should behavioral metrics be equally visible?**

**Answer:**

I recommend a **P&L-prominent layout with behavioral metrics as secondary but equally visible**. Here's the optimal arrangement:

```
+------------------------------------------+----------------------------------+
|  HEADER BAR: Session P&L | Win Rate      |  Session Duration | Trade Count |
|  ($XXX.XX green/red)  | (XX% color)      |  (Xh Xm)          |  (X trades) |
+------------------------------------------+----------------------------------+
|                                          |                                  |
|     CUMULATIVE P&L CHART                 |     DISCIPLINE SCORE CHART       |
|     (Primary Focus - 60% width)          |     (Secondary - 40% width)      |
|     Green/red gradient fill area         |     Step chart, blue/amber      |
|                                          |                                  |
+------------------------------------------+----------------------------------+
|                                          |                                  |
|     AGENCY SCORE CHART                   |     AI INSIGHTS PANEL            |
|     (Tertiary - 40% width)              |     (Collapsible - 60% width)    |
|     Step chart, blue/amber              |     3 bullet points max          |
|                                          |                                  |
+------------------------------------------+----------------------------------+
```

**Rationale:**

1. **P&L primary**: Financial performance is the trader's primary concern during live sessions. The cumulative P&L chart should occupy 50-60% of viewport width and be positioned top-left.

2. **Behavioral secondary but visible**: Discipline and agency scores should NOT be hidden, but they should not compete with P&L for attention. The Behavioral Psychology SME correctly notes that loss aversion can be exacerbated by over-emphasizing P&L, but completely hiding it would ignore the trader's primary motivation.

3. **Side-by-side comparison**: Placing discipline and agency charts adjacent allows traders to visually correlate behavioral patterns with outcomes without switching views.

4. **Header bar for 1-second assessment**: Before charts load, the header provides immediate situational awareness with the six key metrics I defined in my Phase 1 analysis.

---

### Question 2: Real-Time Updates

**Should charts animate/transition smoothly when new data arrives, or is instant update preferable for "at a glance" assessment during fast markets?**

**Answer:**

**Use instant updates with subtle smooth transitions (150-200ms), NOT full animations.**

**Implementation Recommendation:**

```typescript
// Recommended chart update strategy
const chartUpdateConfig = {
  // For fast market conditions: instant update with no animation
  // For normal conditions: 150ms ease-out transition
  transitionDuration: isFastMarket ? 0 : 150,

  // Key behavior: new data point appears immediately
  // Previous line "jumps" to new value, no morphing
  animationType: 'jump', // not 'morph' or 'interpolate'

  // Pulse effect on most recent point (subtle, not distracting)
  latestPointHighlight: {
    enabled: true,
    duration: 800,
    opacity: 0.6
  }
};
```

**Why Instant Updates:**

| Factor | Analysis |
|--------|----------|
| **Cognitive load** | In fast markets, traders need instant feedback. Animation delays perception by 100-300ms |
| **Accuracy perception** | Traders trust instant updates more than animated transitions (which can feel like "spin") |
| **Performance** | Smooth animations at 60fps require more GPU; instant updates are lighter on low-end devices |
| **Noise reduction** | Rapid-fire animations create visual noise; instant updates are cleaner |

**Exception:** Use smooth 300ms transitions when:
- Session first loads (data hydrate)
- User returns after tab was inactive
- User explicitly requests "replay" of session

---

### Question 3: Insight Display Location

**Where in the UI should insights appear? A persistent sidebar takes space but provides constant reference; a collapsible panel keeps UI clean but requires action to view.**

**Answer:**

**Recommended: Collapsible panel with "peek" behavior**

```
Layout: Insights as right-side collapsible panel (320px width)

[Dashboard Charts Area]  |  [Insights Panel]
                         |  +----------------------+
                         |  | AI INSIGHTS     [_]  |  <- Header (always visible)
                         |  +----------------------+
                         |  | • Tilt risk: 2       |  <- Always visible (collapsed shows 1 line)
                         |  |   consecutive losses |
                         |  | • Discipline: -2     |  <- Always visible
                         |  |   trend declining    |
                         |  | • Your patient      |  <- Expandable
                         |  |   entries: 75% win   |
                         |  +----------------------+
                         |  [Expand for more]    |  <- Collapsed state
```

**Recommended Behaviors:**

1. **Default state: Peek (1 insight visible)**
   - Show only the highest-priority insight by default
   - Single line visible, e.g., "Tilt Risk: 2 consecutive losses"
   - Trader can process in <1 second without leaving the main view

2. **Expand on click (full panel)**
   - Click anywhere on insight header to expand
   - Shows up to 3 insights with brief descriptions
   - Auto-collapse after 30 seconds of inactivity

3. **Persistent but non-blocking**
   - Does NOT take focus away from charts
   - Can be read while watching price action
   - Does not interrupt natural scanning pattern (left-to-right, top-to-bottom)

4. **Mobile: Bottom sheet instead of sidebar**
   - Despite HLRD excluding mobile, responsive design should use bottom sheet
   - Swipe up to reveal, swipe down to dismiss

---

## From Behavioral Psychology SME

### Question 1: Real-Time Charting Performance

**What's the optimal polling interval or WebSocket approach for updating cumulative P&L and score charts without causing UI jank during active trading?**

**Answer:**

**Use WebSocket with adaptive throttling, not polling.**

**Recommended Architecture:**

```typescript
// WebSocket message types
interface TradeUpdate {
  type: 'trade_added' | 'trade_updated' | 'session_summary';
  payload: {
    tradeId: string;
    pnl: number;
    cumulativePnl: number;
    disciplineScore: number;
    agencyScore: number;
    timestamp: string;
  };
}

// Adaptive throttling strategy
const updateStrategy = {
  // During active trading (trade logged in last 30 seconds):
  // - Send every update immediately
  // - Batch multiple updates within 100ms window

  // Idle state (no trades for 30+ seconds):
  // - Reduce to heartbeat every 10 seconds

  // Fast market mode (detected by high trade frequency):
  // - Throttle to max 2 updates/second
};

function handleTradeUpdate(update: TradeUpdate) {
  if (isFastMarket) {
    // Throttle to prevent UI jank
    throttle(() => renderChart(update), 500);
  } else {
    // Immediate update
    renderChart(update);
  }
}
```

**WebSocket vs Polling Comparison:**

| Approach | Latency | Server Load | UI Jank Risk | Reliability |
|----------|---------|-------------|--------------|-------------|
| **WebSocket (recommended)** | <50ms | Low (persistent connection) | Low (controlled rendering) | High |
| Short polling (1s) | ~1000ms | High | Medium | Medium |
| Long polling | ~500ms | Very High | Medium | Medium |
| Server-Sent Events | <50ms | Low | Low | High |

**Technical Implementation:**

1. **Use requestAnimationFrame for chart updates** - Ensures updates sync with browser paint cycle
2. **Debounce chart re-renders** - Wait 100ms after last WebSocket message before re-rendering
3. **Separate data fetch from render** - Store updates in React state, render on next paint
4. **WebSocket fallback to polling** - If WebSocket fails, degrade to 2-second polling gracefully

---

### Question 2: Data Visualization Hierarchy

**Should the P&L chart be visually dominant (green/red colors), or should discipline/agency take equal visual weight? Research suggests color-based P&L reinforcement can exacerbate loss aversion.**

**Answer:**

**P&L should be visually prominent, but with behavioral psychology-informed design that mitigates loss aversion.**

**Recommended Hierarchy:**

| Element | Visual Weight | Color Strategy |
|---------|---------------|----------------|
| **Cumulative P&L** | Primary (largest chart, top position) | Green (#22c55e) / Red (#ef4444) |
| **Discipline Score** | Secondary (equal size, adjacent) | Blue (#3b82f6) / Amber (#f59e0b) - NOT red |
| **Agency Score** | Secondary (equal size, adjacent) | Blue (#3b82f6) / Amber (#f59e0b) - NOT red |

**Mitigation Strategies for Loss Aversion:**

1. **Use blue/amber for behavioral scores** - NOT red for negative. This prevents the "everything is red" spiral effect that amplifies loss aversion.

2. **P&L chart: Gradient area, not solid fill** - A subtle gradient (e.g., green fading to transparent) is less emotionally striking than solid blocks of red.

3. **Zero-line emphasis** - The y=0 reference line should be the most prominent visual element in the P&L chart. This frames the question as "above or below zero" rather than "how much red."

4. **Cumulative trend, not daily change** - Showing cumulative P&L (running total) rather than daily change focuses on the overall trajectory, which is more stable and less reactive to individual losses.

5. **Hide dollar amounts during active trading** - Show "$XXX" or "$+XXX" but avoid showing the exact delta on each trade update. Show cumulative total prominently, not the change from last trade.

**Anti-Patterns to Avoid:**
- Flashing red on every loss
- Large negative numbers in bold red text
- "Loss streak" visual indicators (red X's)
- Sound effects on losses (if ever considered)

---

### Question 3: Insight Panel Layout

**Should insights appear as a sidebar, overlay, or separate panel? What's the optimal information density for a trader who has 1-2 seconds to glance at the dashboard?**

**Answer:**

**Collapsible right panel with "peek" state - optimized for 1-2 second glances.**

**Information Density Guidelines:**

| Element | Content | Time to Process |
|---------|---------|-----------------|
| **Peek state** | 1 insight, 1 line | <1 second |
| **Expanded state** | 3 insights, 1 sentence each | <3 seconds |
| **Full panel** | 5+ insights, detailed | >5 seconds (post-session only) |

**Design Specifications:**

```tsx
// Peek state (default during trading)
<InsightPanel defaultCollapsed={false}>
  <InsightItem priority="high">
    <Icon>warning</Icon>
    <Text>Discipline: 2-trade decline</Text>  // 1 second to read
  </InsightItem>
</InsightPanel>

// Expanded state (on click)
<InsightPanel expanded={true}>
  <InsightItem priority="high">
    <Icon>warning</Icon>
    <Text>Discipline: 2-trade decline</Text>
    <Subtext>Consider pausing before next entry</Subtext>
  </InsightItem>
  <InsightItem priority="medium">
    <Icon>trending</Icon>
    <Text>Win rate: 67% on patient entries</Text>
  </InsightItem>
  <InsightItem priority="low">
    <Icon>info</Icon>
    <Text>Setup consistency: 80%</Text>
  </InsightItem>
</InsightPanel>
```

**Key Principles:**

1. **One insight visible by default** - The most critical insight should be viewable without any user action
2. **Icon + short text format** - Icons provide instant categorization, text provides context
3. **No paragraph text in peek mode** - Save detailed text for expanded view
4. **Color-coded priority** - High (amber), Medium (blue), Low (gray) - but avoid red for insights
5. **Auto-collapse after 30 seconds** - Return to peek state to reduce cognitive load

---

### Question 4: Mobile Considerations

**The HLRD explicitly excludes mobile. However, should the dashboard be designed responsively anyway? Traders may want to check from phone during breaks.**

**Answer:**

**Yes, design responsively but prioritize the desktop experience. Mobile should be "good enough" not "feature-complete."**

**Responsive Strategy:**

| Breakpoint | Layout | Features |
|------------|--------|----------|
| **Desktop (>1200px)** | Full 2x2 grid, sidebar insights | All features |
| **Tablet (768-1200px)** | Stacked charts (2 rows), bottom sheet insights | All features |
| **Mobile (<768px)** | Single column, collapsible sections | Read-only with basic summary |

**Mobile Implementation Notes:**

1. **Not for active trading** - Mobile should be read-only (view P&L, past trades, session summary). No trade entry on mobile.

2. **Simplified dashboard** - On mobile, show:
   - Session P&L (large, prominent)
   - Win rate
   - Trade count
   - Last 3 insights (collapsed by default)

3. **Do NOT implement:**
   - Real-time WebSocket updates on mobile (battery/data)
   - Full chart interactions (too small)
   - Full insights panel

4. **Use responsive, not adaptive** - Same components, rearranged. This reduces development cost while still providing basic mobile access.

5. **CSS Grid with media queries** - Much simpler than building separate mobile views:
```css
@media (max-width: 768px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
    grid-template-rows: auto;
  }

  .chart-container {
    min-height: 200px; /* Smaller charts on mobile */
  }
}
```

---

### Question 5: Data Retention Strategy

**How long should raw trade data be retained vs. aggregated? There's a tension between long-term pattern analysis and storage costs.**

**Answer:**

**Tiered retention strategy balancing analysis needs with storage costs:**

| Data Type | Retention | Storage | Use Case |
|-----------|-----------|---------|----------|
| **Raw trades** | 90 days hot, 365 days cold | Full resolution | Pattern analysis, AI insights |
| **Daily aggregates** | 2 years | ~1KB/day | Trend analysis, month-over-month |
| **Monthly aggregates** | Forever | ~30KB/year | Long-term performance tracking |
| **Session snapshots** | 1 year | ~500B/session | Year-over-year comparison |

**Recommended Implementation:**

```sql
-- Tiered storage strategy (TimescaleDB / PostgreSQL)

-- 1. Hot storage: Last 90 days of raw trades
-- Partition by trading_day, queryable with standard indexes
CREATE TABLE trades (
  id UUID PRIMARY KEY,
  trading_day_id UUID REFERENCES trading_days(id),
  description TEXT,
  pnl DECIMAL(12,2),
  discipline_score SMALLINT,
  agency_score SMALLINT,
  timestamp TIMESTAMPTZ
) PARTITION BY RANGE (timestamp);

-- 2. Cold storage: 91-365 days (TimescaleDB hyperchunks)
-- Automatically moves to cheaper storage after 90 days
SELECT add_retention_policy('trades', INTERVAL '90 days');

-- 3. Aggregated daily snapshots
CREATE TABLE daily_summaries (
  trading_day_id UUID PRIMARY KEY,
  date DATE UNIQUE,
  total_pnl DECIMAL(14,2),
  trade_count INT,
  win_rate DECIMAL(5,4),
  avg_discipline_score DECIMAL(4,2),
  avg_agency_score DECIMAL(4,2),
  largest_win DECIMAL(12,2),
  largest_loss DECIMAL(12,2),
  consecutive_wins INT,
  consecutive_losses INT
);

-- 4. Monthly rollups for long-term analysis
CREATE TABLE monthly_summaries (
  year_month VARCHAR(7) PRIMARY KEY,  -- "2025-03"
  total_pnl DECIMAL(14,2),
  total_trades INT,
  avg_daily_pnl DECIMAL(12,2),
  sessions_count INT,
  best_day DATE,
  worst_day DATE
);
```

**Rationale:**

1. **90 days hot** - Sufficient for:
   - Recent pattern analysis
   - Session-to-session comparison
   - AI insights generation (typically looks at last 5-20 trades)

2. **365 days cold** - Required for:
   - Year-over-year performance comparison
   - Tax reporting (if needed)
   - Long-term trend analysis

3. **Aggregates forever** - Monthly summaries are tiny (~30 bytes) and invaluable for:
   - Retirement/planning use cases
   - Multi-year performance tracking
   - No additional storage cost worth mentioning

**Cost Analysis:**

| Storage Tier | Est. Monthly Cost (10K trades/day) |
|--------------|-------------------------------------|
| Hot (RDS gp3) | ~$5/month |
| Cold (S3 Glacier) | ~$0.10/month |
| Aggregates | Negligible |

**Export Capability:**
- Provide JSON/CSV export for trades older than 90 days
- Users can store locally for unlimited historical access

---

## Summary of Recommendations

| Question | Recommendation |
|----------|----------------|
| Dashboard Layout | P&L prominent (60% width), behavioral charts secondary but equally visible |
| Real-Time Updates | Instant updates with 150ms max transition, pulse on latest point |
| Insight Location | Collapsible right panel with peek state (1 insight visible by default) |
| Charting Performance | WebSocket with adaptive throttling, requestAnimationFrame |
| Visualization Hierarchy | P&L prominent, behavioral in blue/amber (not red) to mitigate loss aversion |
| Insight Density | Peek: 1 line (<1s), Expanded: 3 items (<3s), Full: 5+ (post-session) |
| Mobile | Responsive yes, but read-only, simplified |
| Data Retention | 90d hot raw, 365d cold, aggregates forever |

---

*Answers prepared by Data Analytics SME for Phase 2 of the Aurelius Ledger requirements elaboration workflow.*
