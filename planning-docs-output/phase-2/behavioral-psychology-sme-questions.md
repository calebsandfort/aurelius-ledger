# Cross-SME Questions for Behavioral Psychology SME

**Target SME:** behavioral-psychology-sme (BehavioralCoach)
**Source:** Phase 1 cross-SME questions from other SME analyses

---

## From AI/NLP SME (AIWorkflow)

### Context
The AI/NLP SME analyzed prompt engineering for trade extraction and insights generation, with questions about behavioral scoring validation and insight categories.

### Questions

**1. Discipline/Agency Scoring Validation**
What specific language patterns beyond the examples in the HLRD ("waited for," "chased," "fomo'd in") should be prioritized in the prompt? Are there common trader phrases that might be misclassified?

*Reference: Section "Questions for Other SMEs" - AI/NLP SME analysis*

---

**2. Insights Actionability**
Beyond the categories you mentioned (setup consistency, discipline trend, tilt risk, winning vs. losing patterns), what other insight categories would be most valuable mid-session? Should insights differentiate between "information" (observations) and "recommendations" (actionable changes)?

*Reference: Section "Questions for Other SMEs" - AI/NLP SME analysis*

---

**3. Score Calibration**
The HLRD specifies -1/0/1 for scores. Is this granularity sufficient, or would -2 to +2 provide better differentiation without introducing noise? How should we communicate score meaning to the trader?

*Reference: Section "Questions for Other SMEs" - AI/NLP SME analysis*

---

## From Data Analytics SME (DataScientist)

### Context
The Data Analytics SME analyzed dashboard visualization and aggregation strategies, with questions about behavioral score interpretation and thresholds.

### Questions

**4. Insight Actionability**
What insight categories are most actionable for a trader mid-session? Should we prioritize setup consistency, discipline trend, risk of tilt based on score trajectory, or patterns in winning vs. losing trade descriptions?

*Reference: Section "Questions for Other SMEs" - Data Analytics SME analysis*

---

**5. Score Interpretation Thresholds**
At what net discipline/agency score values should we trigger specific behavioral warnings? For example, should -3 net discipline trigger a "consider taking a break" insight?

*Reference: Section "Questions for Other SMEs" - Data Analytics SME analysis*

---

**6. Behavioral Pattern Detection**
Beyond individual score trends, are there specific multi-trade patterns we should look for (e.g., discipline erosion after losses, revenge trading indicators) that would be valuable to surface in the insights panel?

*Reference: Section "Questions for Other SMEs" - Data Analytics SME analysis*
