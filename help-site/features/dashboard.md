# Dashboard Guide

Your dashboard shows everything about your trading session in one screen. No clicking around, no navigating to different pages. Here is what you are looking at.

## The Layout

The dashboard has four main sections:

1. **P&L Chart** — The largest chart, at the top
2. **Discipline Score** — Smaller chart, left side
3. **Agency Score** — Smaller chart, right side
4. **Session Insights** — Panel at the bottom

There is also a warning bar that appears at the top when the system detects potentially problematic patterns.

## P&L Chart (Cumulative Profit/Loss)

This is the biggest chart on your dashboard. It shows your running total P&L over the session.

**What you see:**

- A line chart with the X-axis showing trade sequence (Trade #1, Trade #2, etc.)
- The Y-axis showing dollar amounts
- A dashed horizontal line at $0 — the breakeven reference
- A gray dotted line showing your average P&L per trade

**How to read it:**

- **Green line:** You are in profit overall
- **Red line:** You are down overall
- **Blue line:** Mixed — some wins, some losses

**Hovering over any point** shows a tooltip with:

- Trade number
- Timestamp
- Individual trade P&L
- Cumulative P&L
- Direction (long or short)
- Your discipline and agency scores for that trade

**A note on extreme values:** If a trade P&L is unusually large (way above or below normal), the tooltip flags it so you can see what drove big swings.

:::tip Watch the Slope
The angle of the line tells you a lot. A steep upward slope means you are hitting winners. A flat or downward slope means the session is tough. Use this to gauge how the day is going at a glance.
:::

## Discipline Score Chart

This chart tracks your trading discipline over time.

**What you see:**

- A step chart (it looks like stairs going up or down)
- Green dots for +1 scores
- Red dots for -1 scores
- Gray dots for 0 scores
- A dashed horizontal line at 0

**What it measures:**

- **+1:** You followed your rules, waited for your setup, traded your plan
- **0:** Neutral — the trade was neither especially disciplined nor undisciplined
- **-1:** You deviated — chased, overtraded, ignored your rules

The chart shows a running sum, not individual scores. So if you get +1, -1, +1, your line goes up, down, then up again.

**Toggle the 3-Trade Average:**

There is a button above the chart that lets you overlay a 3-trade moving average. This smooths out the noise and shows you the trend in your discipline. Turn it on to see if you are generally getting more or less disciplined as the session progresses.

## Agency Score Chart

This chart tracks whether you are trading with intention or reacting emotionally.

**What you see:**

- Same format as the Discipline chart — step chart with colored dots
- Green for +1, red for -1, gray for 0

**What it measures:**

- **+1:** You made an intentional decision — you chose to enter, you chose to exit
- **0:** Neutral
- **-1:** You reacted emotionally — revenge trading, FOMO, fear, frustration

**Why this matters:**

Agency is about control. A trade can be disciplined (you followed your rules) but still lack agency (you took the trade because you were angry about the last loss). Both scores matter.

## Session Insights Panel

This panel shows summary stats and, after enough trades, AI-generated insights.

**Before 5 trades:**

- It shows a message encouraging you to keep logging trades
- Basic stats: total trades, win rate, net discipline

**After 5 trades:**

- Full stats appear: total trades, win rate, net discipline
- AI insights start showing up (see the [AI Insights](./ai-insights) guide for details)

## Warning Bar

Above the charts, you might see a colored warning bar.

**Amber warning (yellow):**

- Appears after 3 consecutive discipline -1 scores OR 3 consecutive agency -1 scores
- The bar is yellow with a warning icon
- It tells you which trades triggered the warning

**Orange warning:**

- Appears after 4+ consecutive discipline -1 scores OR 4+ consecutive agency -1 scores
- The bar is orange
- This is a stronger signal that you might be tilted

**What to do:**

The warning is not a punishment. It is a mirror. If you see it, take a breath. Step back. The system is not judging you — it is just pointing out a pattern.

:::warning The Warning Is Not Interrupting
The warning appears at the top of your dashboard but does not stop you from logging more trades. You decide whether to keep trading or take a break.
:::

## Empty States

When you first log in with no trades:

- The P&L chart shows a placeholder encouraging you to log trades
- The Discipline and Agency charts show the same
- The Insights panel asks you to log trades to unlock insights

This is normal. Once you log your first trade, the charts start populating.

## Session Stats Summary

At a glance, you can see:

- **Total Trades:** How many trades you have logged this session
- **Win Rate:** Percentage of winning trades
- **Net Discipline:** Sum of all discipline scores (positive = more disciplined than not)
- **Net Agency:** Sum of all agency scores (positive = more intentional than reactive)

These update in real time as you log trades.

## Viewing Past Sessions

In the current version, the dashboard shows only today's session. If you want to review past days, look for the session history feature or export your data for analysis.

---

That is your dashboard. At a glance, you can see how much money you are making, how disciplined you are being, and whether you are trading with intention. Use it to stay aware throughout your session.
