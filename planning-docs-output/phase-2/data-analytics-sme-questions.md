# Questions for Data Analytics SME (Phase 2)

## Overview

This file contains questions from other SMEs that require data analytics expertise to answer.

---

## From AI/NLP SME

**Source:** `/home/csandfort/Documents/source/repos/aurelius-ledger/planning-docs-output/phase-1/ai-nlp-sme-analysis.md`

### Question 1: Dashboard Real-Time Updates

**Context:** The AI/NLP analysis discusses trade extraction and insights generation that feed into the dashboard.

**Question:** What's the recommended approach for handling rapid trade submissions (e.g., a trader logging multiple trades quickly)? Should updates be debounced, or is immediate refresh acceptable?

**Reference:** Section "Questions for Other SMEs > For Data Analytics SME" (lines 320-322)

---

### Question 2: Chart Visualization for Scores

**Context:** The HLRD specifies "running sum" for discipline and agency, but there may be better visualizations.

**Question:** The requirements specify "running sum" for discipline and agency. Would a moving average or trend line be more informative? Should the charts show individual trade scores alongside the running sum?

**Reference:** Section "Questions for Other SMEs > For Data Analytics SME" (lines 323-324)

---

### Question 3: Insights Caching Strategy

**Context:** Insights are regenerated after each trade, but caching could improve performance.

**Question:** Since insights are regenerated after each trade, what's the recommended cache invalidation strategy? Should insights be cached by trade count (e.g., regenerate only when trade count changes)?

**Reference:** Section "Questions for Other SMEs > For Data Analytics SME" (lines 325-326)

---

## From Behavioral Psychology SME

**Source:** `/home/csandfort/Documents/source/repos/aurelius-ledger/planning-docs-output/phase-1/behavioral-psychology-sme-analysis.md`

### Question 4: Real-Time Aggregation Queries

**Context:** The behavioral psychology analysis discusses computing running aggregates for the dashboard.

**Question:** What database queries will efficiently compute running aggregates (discipline sum, P&L, win/loss count) after each trade insertion? Should we use materialized views or computed columns for these aggregates?

**Reference:** Section "Questions for Other SMEs > For Data Analytics SME" (lines 205-207)

---

### Question 5: Chart Library Recommendations

**Context:** The tech stack specifies Next.js + Shadcn/ui + Tailwind for the frontend.

**Question:** What chart library/approach do you recommend for the time-series charts given the Next.js + Shadcn/ui + Tailwind stack?

**Reference:** Section "Questions for Other SMEs > For Data Analytics SME" (lines 209-210)

---

### Question 6: No Data State Handling

**Context:** Early in a trading session, there is minimal data for visualization.

**Question:** How should we handle the "no data" state for early-session (1-2 trades) where trend analysis isn't meaningful yet?

**Reference:** Section "Questions for Other SMEs > For Data Analytics SME" (lines 211-212)

---

### Question 7: Data Retention Policy

**Context:** Trade data accumulates over time and needs a retention strategy.

**Question:** For Phase 1, how long should trade data be retained locally before considering archival? Should we implement any data compression for older sessions (e.g., rolling up to daily summaries after 30 days)?

**Reference:** Section "Questions for Other SMEs > For Data Analytics SME" (lines 213-215)

---

### Question 8: Materialized Views vs Computed Columns

**Context:** Performance optimization for real-time dashboard updates.

**Question:** Should we use materialized views or computed columns for the running aggregates (discipline sum, P&L, win/loss count)? What are the trade-offs?

**Reference:** Section "Questions for Other SMEs > For Data Analytics SME" (lines 206-207)

---

## Summary

The Data Analytics SME is asked to provide guidance on:

1. Debounce/refresh strategies for rapid trade submissions
2. Chart visualization options (running sum vs moving average vs individual scores)
3. Insights caching and invalidation strategies
4. Database query optimization for running aggregates
5. Chart library recommendations for Next.js + Shadcn/ui + Tailwind
6. Handling "no data" states for early sessions
7. Data retention and archival policies
8. Materialized views vs computed columns trade-offs
