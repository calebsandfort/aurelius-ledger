# Questions for Behavioral Psychology SME (Phase 2)

## Overview

This file contains questions from other SMEs that require behavioral psychology expertise to answer.

---

## From AI/NLP SME

**Source:** `/home/csandfort/Documents/source/repos/aurelius-ledger/planning-docs-output/phase-1/ai-nlp-sme-analysis.md`

### Question 1: Discipline/Agency Scoring Calibration

**Context:** The AI/NLP analysis proposes a scoring schema (-1, 0, +1) for discipline and agency based on textual analysis of trade descriptions.

**Question:** The current scoring schema (-1, 0, +1) is simple, but are there common trading behaviors that might be misclassified? For example, "scaling out" or "adding to a position" — should these be neutral, positive, or negative signals?

**Reference:** Section "Questions for Other SMEs > For Behavioral Psychology SME" (lines 312-314)

---

### Question 2: Insight Actionability

**Context:** The AI/NLP analysis discusses how to generate AI insights from trade data and behavioral scores.

**Question:** What specific behavioral patterns would be most valuable to surface in the AI insights panel? Should the system warn about specific risk factors (e.g., "tilt risk elevated" based on recent loss streak)?

**Reference:** Section "Questions for Other SMEs > For Behavioral Psychology SME" (lines 315-316)

---

### Question 3: Score Trajectory Interventions

**Context:** Behavioral psychology expertise is needed to determine appropriate interventions when patterns change.

**Question:** If a trader's discipline score starts positive and trends negative over a session, what interventions or insights would be most helpful? Is a warning appropriate, or would that be counterproductive during active trading?

**Reference:** Section "Questions for Other SMEs > For Behavioral Psychology SME" (lines 317-318)

---

## From Data Analytics SME

**Source:** `/home/csandfort/Documents/source/repos/aurelius-ledger/planning-docs-output/phase-1/data-analytics-sme-analysis.md`

### Question 4: Visual Warning Thresholds

**Context:** The data analytics analysis discusses chart design and real-time updates for discipline and agency score visualizations.

**Question:** In the discipline and agency score charts, what time window or trade count threshold should trigger a visual warning (e.g., "tilting" indicator) when negative trends are detected?

**Reference:** Section "Questions for Other SMEs > For Behavioral Psychology SME" (lines 237-238)

---

### Question 5: Behavioral Recommendations in Insights

**Context:** The AI insights panel could include actionable behavioral recommendations.

**Question:** Should the AI insights panel include specific behavioral recommendations (e.g., "take a break"), and if so, what score thresholds should trigger such interventions?

**Reference:** Section "Questions for Other SMEs > For Behavioral Psychology SME" (lines 239-240)

---

### Question 6: Additional Behavioral Metrics

**Context:** The data analytics SME is considering what metrics to visualize beyond discipline and agency scores.

**Question:** Are there other behavioral metrics beyond discipline and agency that would be valuable to visualize on the dashboard? For example, patience (time between trades), sizing consistency, or setup diversity.

**Reference:** Section "Questions for Other SMEs > For Behavioral Psychology SME" (lines 241-242)

---

## Summary

The Behavioral Psychology SME is asked to provide guidance on:

1. Scoring calibration for edge cases (scaling, adding to positions)
2. Actionable insight categories for the AI panel
3. Appropriate interventions when scores trend negatively
4. Visual warning thresholds for behavioral charts
5. Score thresholds for behavioral recommendations (e.g., take a break)
6. Additional behavioral metrics worth tracking and visualizing
