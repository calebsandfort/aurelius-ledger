# Cross-SME Questions for Data Analytics SME

**Target SME:** data-analytics-sme (DataScientist)
**Source:** Phase 1 cross-SME questions from other SME analyses

---

## From AI/NLP SME (AIWorkflow)

### Context
The AI/NLP SME analyzed the extraction pipeline and insights generation, with questions about visualization requirements and aggregation strategies.

### Questions

**1. Visualization Recommendations**
For the P&L time series, discipline trend, and agency trend charts - what chart types and visual patterns would be most immediately readable during live trading? Should there be reference lines (e.g., "at zero" for cumulative scores)?

*Reference: Section "Questions for Other SMEs" - AI/NLP SME analysis*

---

**2. Aggregation Window**
The trading_days table maintains running aggregates. What aggregation granularity beyond daily is needed for the insights agent? Should we track rolling windows (last 5 trades, last 10 trades)?

*Reference: Section "Questions for Other SMEs" - AI/NLP SME analysis*

---

**3. Outlier Handling**
How should the system handle outlier trades (e.g., +$5000 winner vs. typical +$200 winners) in the insights? Should P&L be normalized for context, or shown as-is?

*Reference: Section "Questions for Other SMEs" - AI/NLP SME analysis*

---

## From Behavioral Psychology SME (BehavioralCoach)

### Context
The Behavioral Psychology SME analyzed behavioral indicators and tilt detection, with questions about visualization approaches for score trajectories.

### Questions

**4. Score Trajectory Visualization**
How should the dashboard visualize score trajectories to make trends immediately apparent without requiring numerical literacy? What chart types and visual encodings would be most effective?

*Reference: Section "Questions for Other SMEs" - Behavioral Psychology SME analysis*

---

**5. Trend Direction Calculation**
What aggregation functions and time windows are appropriate for the "trend direction" calculation? Should we use simple moving averages, exponential moving averages, or linear regression slopes?

*Reference: Section "Questions for Other SMEs" - Behavioral Psychology SME analysis*

---

**6. Tilt Risk Indicator Visualization**
How should we handle the visualization of the "tilt risk indicator" to ensure it catches attention without creating alarm fatigue? What color coding and placement strategies would be most effective?

*Reference: Section "Questions for Other SMEs" - Behavioral Psychology SME analysis*

---

**7. Minimum Trades for Setup Consistency Insights**
What is the minimum number of trades needed before generating setup consistency insights? How should we communicate confidence levels to the trader?

*Reference: Section "Questions for Other SMEs" - Behavioral Psychology SME analysis*
