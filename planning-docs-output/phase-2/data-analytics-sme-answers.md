# Phase 2b: Data Analytics SME Answers

**Target SME:** data-analytics-sme (DataScientist)
**Source:** Cross-SME questions from AI/NLP SME and Behavioral Psychology SME
**Output:** `/home/csandfort/Documents/source/repos/aurelius-ledger/planning-docs-output/phase-2/data-analytics-sme-answers.md`

---

## Questions from AI/NLP SME (AIWorkflow)

### Question 1: Visualization Recommendations for P&L and Score Charts

**Asked by:** AI/NLP SME

**Answer:**

For live trading visualization, the key principle is **instant pattern recognition** - traders should be able to assess session state in under 2 seconds. Here's my recommendation:

#### Chart Types

| Chart | Recommended Type | Rationale |
|-------|------------------|------------|
| **P&L Time Series** | Area chart with gradient fill | Shows momentum and cumulative position at a glance |
| **Discipline Score** | Line chart with markers | Shows individual trade contributions + trajectory |
| **Agency Score** | Line chart with markers | Mirrors discipline chart for correlation assessment |

#### Reference Lines

**Yes, absolutely include reference lines:**

- **Zero line** for P&L: Prominently displayed as a dashed white line (#94a3b8 at 50% opacity)
- **Zero line** for cumulative scores: Same treatment - running sum crossing zero is a significant behavioral signal
- **Moving average overlay** (optional): 3-trade simple moving average as a subtle dotted line to smooth noise

#### Visual Patterns That Work

1. **Gradient fill on P&L area chart:**
   - Above zero: Green gradient (#22c55e to transparent)
   - Below zero: Red gradient (#ef4444 to transparent)

2. **Color transitions:**
   - When crossing zero, the fill color should transition smoothly

3. **Trade markers:**
   - Circles at each trade point
   - Color-coded by outcome (green dot for win, red for loss, gray for breakeven)

4. **Last point highlight:**
   - Emphasize the most recent data point with a larger marker and tooltip

**Implementation with Recharts:**

```typescript
// P&L Area Chart
<AreaChart>
  <defs>
    <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
      <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
    </linearGradient>
  </defs>
  <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
  <Area type="monotone" dataKey="cumulativePnl" stroke="#22c55e" fill="url(#pnlGradient)" />
</AreaChart>

// Score Line Charts
<LineChart>
  <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
  <Line type="monotone" dataKey="disciplineScore" stroke="#10b981" dot={{r: 4}} />
</LineChart>
```

---

### Question 2: Aggregation Window for Insights Agent

**Asked by:** AI/NLP SME

**Answer:**

The insights agent needs **both** session-level aggregates and rolling window metrics. Here's the recommended approach:

#### Recommended Aggregation Strategy

**Tier 1: Session-Level Aggregates** (computed at query time)
- Total trades, wins, losses, breakeven
- Total P&L, average win, average loss
- Net discipline score (sum), net agency score (sum)
- Win rate percentage

**Tier 2: Rolling Windows** (pre-computed or computed on-demand)

| Window | Purpose | Use Case |
|--------|---------|----------|
| Last 3 trades | Immediate feedback | Tilt detection, recent pattern |
| Last 5 trades | Short-term trend | Setup consistency |
| Last 10 trades | Session momentum | Trend direction calculation |

#### Implementation Approach

**Pre-compute in `trading_days` table:**

```sql
-- Add rolling window columns to trading_days
ALTER TABLE trading_days ADD COLUMN last_3_discipline_sum INT;
ALTER TABLE trading_days ADD COLUMN last_5_discipline_sum INT;
ALTER TABLE trading_days ADD COLUMN last_10_discipline_sum INT;
-- Same for agency scores
ALTER TABLE trading_days ADD COLUMN last_3_pnl DECIMAL;
ALTER TABLE trading_days ADD COLUMN last_5_pnl DECIMAL;
```

**Update rolling windows at trade insert time** (same transaction):

```typescript
// Pseudocode for trade insert
async function insertTrade(trade) {
  await db.transaction(async (tx) => {
    // Insert trade
    await tx.trades.insert(trade);

    // Update session aggregates
    await tx.trading_days.update({
      total_pnl: sql`total_pnl + ${trade.pnl}`,
      trade_count: sql`trade_count + 1`,
      // ... other fields
    });

    // Update rolling windows (recompute last N from trades table)
    const last3 = await tx.trades.findMany({
      where: { trading_day_id: trade.trading_day_id },
      orderBy: { timestamp: 'desc' },
      limit: 3
    });
    await tx.trading_days.update({
      last_3_discipline_sum: sum(last3.map(t => t.discipline_score))
    });
  });
}
```

#### Context Structure for Insights Agent

Pass this to the insights LLM:

```typescript
interface InsightsContext {
  sessionStats: {
    totalTrades: number;
    wins: number;
    losses: number;
    totalPnl: number;
    netDiscipline: number;
    netAgency: number;
    winRate: number;
  };
  recentWindows: {
    last3: { disciplineSum: number; agencySum: number; pnl: number };
    last5: { disciplineSum: number; agencySum: number; pnl: number };
    last10: { disciplineSum: number; agencySum: number; pnl: number };
  };
  trendDirection: 'improving' | 'declining' | 'stable'; // Based on last3 vs last5
}
```

**Rationale:** Rolling windows allow the insights agent to detect momentum shifts and provide contextually relevant advice (e.g., "Your last 3 trades show declining discipline - consider taking a moment before your next entry").

---

### Question 3: Outlier Handling in Insights

**Asked by:** AI/NLP SME

**Answer:**

Outliers require **dual presentation** - show the raw value for accuracy, but provide context to prevent misinterpretation.

#### Recommended Approach

**1. Always show P&L as-is (raw value)**
- Traders need accurate records
- Hiding or normalizing values erodes trust
- Example: "+$5,000" displayed as "+$5,000"

**2. Add contextual annotations in insights**

When outliers are detected, include language like:

```
"Notable trade: +$5,000 winner (largest this session, +$4,800 above average win)"
```

**3. Statistical flagging in the data model**

Add an outlier flag computed at insert time:

```typescript
interface Trade {
  // ... existing fields
  isOutlier: boolean;
  outlierReason?: 'large_win' | 'large_loss' | 'streak_breaker';
}

// Compute at insert
const avgWin = sessionStats.totalPnl / sessionStats.winCount;
const stdDev = computeStdDev(sessionWins);
trade.isOutlier = Math.abs(trade.pnl - avgWin) > (2 * stdDev);
```

**4. Visualization treatment**

- In the P&L chart: Normal outlier doesn't need special visual treatment
- If 3+ standard deviations: Consider a star marker or annotation
- **Do NOT** exclude outliers from cumulative calculations - this would create false P&L

**5. Insights generation guidance**

In the prompt for the insights agent:

```
When mentioning unusually large wins or losses:
- Acknowledge them as notable without judgment
- Provide context (how it compares to typical results)
- Do NOT suggest the trader "should have" done anything differently
- Focus on behavioral patterns, not outcome magnitude
```

**Why this matters:** From a behavioral psychology perspective, outliers can trigger both overconfidence (after big wins) and revenge trading (after big losses). The insight should contextualize rather than amplify the emotional response.

---

## Questions from Behavioral Psychology SME (BehavioralCoach)

### Question 4: Score Trajectory Visualization

**Asked by:** Behavioral Psychology SME

**Answer:**

For traders who may not have strong numerical literacy, the visualization must rely on **pre-attentive visual features** - patterns the brain processes before conscious thought.

#### Recommended Visual Encodings

**1. Color as Primary Signal**
- Positive trajectory: Green fill/line
- Negative trajectory: Red fill/line
- Neutral/flat: Amber/yellow fill/line

**2. Shape as Direction Indicator**
- Upward trending line: Gentle positive slope
- Downward trending line: Gentle negative slope
- Flat line: Horizontal

**3. Position Relative to Reference**
- Above zero = net positive behavior
- Below zero = net negative behavior

#### Chart Type Recommendation

**Combo chart: Bar + Line**

```typescript
<ComposedChart>
  {/* Bars show individual trade contributions */}
  <Bar dataKey="individualScore" fill="#475569" opacity={0.5} />

  {/* Line shows running sum (trajectory) */}
  <Line
    type="monotone"
    dataKey="cumulativeScore"
    stroke={getTrajectoryColor(lastValue)}
    strokeWidth={3}
    dot={{ r: 5, fill: getTrajectoryColor(lastValue) }}
  />

  {/* Zero reference line */}
  <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
</ComposedChart>
```

#### Why This Works

| Visual Element | What It Conveys | Processing Type |
|---------------|-----------------|------------------|
| Bar height | Individual trade contribution | Analytical |
| Line direction | Trajectory/momentum | Pre-attentive |
| Line color | Positive/negative/neutral | Pre-attentive |
| Position relative to zero | Overall behavioral standing | Pre-attentive |

**The "2-second test":** A trader should be able to glance at the chart and know:
- "I'm doing well" (green, above zero, trending up)
- "I'm slipping" (red, below zero, trending down)
- "I'm neutral" (amber, near zero, flat)

#### Alternative: Sparkline + Status Indicator

For maximum simplicity, consider a **sparkline** in the header with an icon:

```
[Discipline: ↑ Green arrow] [sparkline迷你图]
```

This is scannable without any chart-reading skills.

---

### Question 5: Trend Direction Calculation

**Asked by:** Behavioral Psychology SME

**Answer:**

For trend direction calculation, I recommend **comparing short-term vs. medium-term rolling averages**. Here's the detailed approach:

#### Recommended Method: SMA Crossover

```typescript
type TrendDirection = 'improving' | 'declining' | 'stable';

function calculateTrendDirection(scores: number[]): TrendDirection {
  if (scores.length < 5) {
    return 'stable'; // Not enough data
  }

  const last3 = scores.slice(-3);
  const previous3 = scores.slice(-6, -3);

  const shortTermAvg = last3.reduce((a, b) => a + b, 0) / last3.length;
  const mediumTermAvg = previous3.reduce((a, b) => a + b, 0) / previous3.length;

  const threshold = 0.5; // Minimum difference to consider significant

  if (shortTermAvg - mediumTermAvg > threshold) {
    return 'improving';
  } else if (mediumTermAvg - shortTermAvg > threshold) {
    return 'declining';
  } else {
    return 'stable';
  }
}
```

#### Why SMA Over Alternatives

| Method | Pros | Cons | Recommendation |
|--------|------|------|----------------|
| **Simple Moving Average (SMA)** | Easy to explain, stable | Lagged signal | **Recommended** |
| Exponential Moving Average (EMA) | More responsive | Less intuitive | Use for advanced mode |
| Linear Regression Slope | Most mathematically rigorous | Overkill for 3-5 data points | Not recommended |
| Raw comparison | Most responsive | Too noisy | Not recommended |

#### Window Configuration

- **Short window:** 3 trades (recent momentum)
- **Medium window:** 6 trades (comparative baseline)
- **Threshold:** 0.5 points difference (meaningful change)

#### Edge Cases

1. **Fewer than 5 trades:** Return 'stable' - no trend calculable
2. **All same scores:** Return 'stable' - flat is flat
3. **Oscillating pattern:** The 3-vs-6 comparison smooths this out

#### Visual Representation

In the UI, show the trend as:

```
Discipline: ↑ Improving   (or: → Stable, ↓ Declining)
```

With color coding:
- Improving = Green
- Stable = Amber
- Declining = Red

---

### Question 6: Tilt Risk Indicator Visualization

**Asked by:** Behavioral Psychology SME

**Answer:**

The tilt risk indicator must **catch attention without creating alarm fatigue**. This requires careful design of visibility, persistence, and messaging.

#### Design Principles

1. **Graduated Response:** Not all tilt is equal
2. **Persistent but Not Intrusive:** Visible until addressed
3. **Action-Oriented:** Tell the trader what to do, not just what is wrong

#### Tilt Risk Levels

| Level | Trigger | Visual | Message |
|-------|---------|--------|---------|
| **Low** | 1 trade with negative score | Subtle amber dot | None (informational only) |
| **Medium** | 2 consecutive negative OR single score of -2 | Amber banner, persistent | "Recent trades show reactive patterns" |
| **High** | 3 consecutive negative OR net score <-3 | Red banner, pulsing | "Consider taking a 5-minute break" |

#### Implementation

**1. Visual Placement**

- **Primary location:** Top of insights panel, below header stats
- **Secondary location:** Small indicator in header (dot or small icon)
- **NOT:** Modal popups (too intrusive, disrupts flow)

**2. Color Coding**

```typescript
const tiltColors = {
  low: { bg: 'bg-amber-900/20', border: 'border-amber-600', text: 'text-amber-400' },
  medium: { bg: 'bg-amber-900/40', border: 'border-amber-500', text: 'text-amber-300' },
  high: { bg: 'bg-red-900/40', border: 'border-red-500', text: 'text-red-300' }
};
```

**3. Animation for High Risk**

```css
/* Gentle pulse for high-risk tilt */
@keyframes tiltPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.tilt-high {
  animation: tiltPulse 2s ease-in-out infinite;
}
```

**4. Dismissible vs. Persistent**

- Low/Medium tilt: Auto-clears after 2 positive trades
- High tilt: Requires trader acknowledgment (click "I'm taking a break") OR auto-clears after 5-minute pause
- **Never** auto-dismiss without action for high risk

**5. Message Language**

```typescript
const tiltMessages = {
  medium: [
    "Your recent trades show some reactive decision-making patterns.",
    "Consider pausing briefly before your next entry."
  ],
  high: [
    "Multiple recent trades show impulsive patterns.",
    "Recommendation: Take a 5-minute break before continuing."
  ]
};
```

**Why this prevents alarm fatigue:**
- Low risk is invisible (just data)
- Medium risk is noticeable but not alarming
- High risk is visible but offers a clear action (break)
- The graduated approach means traders learn to recognize early signs

---

### Question 7: Minimum Trades for Setup Consistency Insights

**Asked by:** Behavioral Psychology SME

**Answer:**

Setup consistency insights require sufficient sample size to be meaningful and statistically valid. Here's the recommended approach:

#### Minimum Thresholds

| Metric | Minimum Trades | Rationale |
|--------|----------------|-----------|
| **Setup consistency** | 5 trades per setup | Minimum for meaningful win rate |
| **Cross-setup comparison** | 3 trades per setup, 2+ setups | Need comparison data |
| **Pattern confidence** | 10+ total trades | For statistical significance |

#### Confidence Level Communication

**Display confidence to the trader:**

```typescript
interface SetupInsight {
  setupName: string;
  winRate: number;
  sampleSize: number;
  confidence: 'low' | 'medium' | 'high';
  message: string;
}

// Confidence levels
function getConfidence(sampleSize: number): 'low' | 'medium' | 'high' {
  if (sampleSize < 5) return 'low';
  if (sampleSize < 10) return 'medium';
  return 'high';
}

// Message construction
function getSetupMessage(setup: SetupInsight): string {
  if (setup.confidence === 'low') {
    return `${setup.setupName}: ${setup.winRate}% win rate (${setup.sampleSize} trades - limited data)`;
  }
  if (setup.confidence === 'medium') {
    return `${setup.setupName}: ${setup.winRate}% win rate (${setup.sampleSize} trades)`;
  }
  return `${setup.setupName}: ${setup.winRate}% win rate based on ${setup.sampleSize} trades`;
}
```

#### UI Display

**In the insights panel:**

```
SETUP PERFORMANCE
━━━━━━━━━━━━━━━━━━━━━━━
Pullback to EMA        67% ★★★ (9 trades)
Breakout continuation  40% ★★☆ (5 trades)
Reversal at support   --    (2 trades - need more data)
```

#### What NOT to Show

- Win rate percentages for setups with < 3 trades
- Comparative insights between setups unless each has 5+ trades
- "Best setup" recommendations with low confidence

#### Behavioral Rationale

From a behavioral psychology standpoint:
- **Low confidence** insights may reinforce **confirmation bias** (trader selects what agrees with their belief)
- **High confidence** insights provide **actionable feedback** that builds trust in the system
- Communicating sample size explicitly promotes **realistic expectations**

---

## Summary of Recommendations

| Question | Key Recommendation |
|----------|-------------------|
| Visualization | Area chart for P&L, Line chart for scores, prominent zero reference lines |
| Aggregation | Rolling windows (3, 5, 10 trades) pre-computed; pass to insights agent |
| Outliers | Show raw values, add contextual annotations, flag in data model |
| Trajectory | Color + shape + position convey trend; combo bar/line chart |
| Trend Calculation | SMA comparison (last 3 vs. previous 3), threshold 0.5 |
| Tilt Visualization | 3-tier system (low/medium/high), amber→red, action-oriented messages |
| Setup Confidence | Minimum 5 trades, display confidence levels, show sample size |

---

*Answers prepared by data-analytics-sme for Phase 2 Requirements Elaboration*
