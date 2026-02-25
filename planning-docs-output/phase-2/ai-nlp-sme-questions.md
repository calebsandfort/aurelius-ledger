# Cross-SME Questions for AI/NLP SME

**Target SME:** ai-nlp-sme (AIWorkflow)
**Source:** Phase 1 cross-SME questions from other SME analyses

---

## From Behavioral Psychology SME (BehavioralCoach)

### Context
The Behavioral Psychology SME analyzed actionable insight categories for mid-session trading and identified several questions about how the AI/NLP pipeline should handle behavioral scoring and insight generation.

### Questions

**1. Contradictory Signal Handling**
How should the insights agent handle contradictory signals? For example, when discipline_score is positive but agency_score is negative, how should the natural language insight weight and present these conflicting indicators?

*Reference: Section "Questions for Other SMEs" - Behavioral Psychology SME analysis*

---

**2. Context Window Optimization**
What is the optimal context window for the insights generation? Should it receive raw trade records, aggregated session statistics, or both? What are the trade-offs in terms of LLM token costs vs. insight quality?

*Reference: Section "Questions for Other SMEs" - Behavioral Psychology SME analysis*

---

**3. Timing of Insight Generation**
How should the system handle the timing of insight generation? Should insights be generated synchronously (blocking trade entry) or asynchronously (generated in background)? What are the behavioral implications of each approach?

*Reference: Section "Questions for Other SMEs" - Behavioral Psychology SME analysis*

---

**4. Prompt Structure for Consistent Score Interpretation**
What prompt structure would maintain consistency in behavioral score interpretation across different trade descriptions? For example, how should the agent handle descriptions that use different vocabulary to express similar concepts (e.g., "chased price" vs. "fomo'd in" vs. "got greedy")?

*Reference: Section "Questions for Other SMEs" - Behavioral Psychology SME analysis*

---

## From Data Analytics SME (DataScientist)

### Context
The Data Analytics SME analyzed dashboard organization and visualization, with questions about how the AI extraction and insights generation should handle data context.

### Questions

**5. Data Context for Insights Agent**
What context should be passed to the insights agent - raw trade records, aggregated session stats, or both? Should insights be streamed or returned as a complete block?

*Reference: Section "Questions for Other SMEs" - Data Analytics SME analysis*

---

**6. Score Calculation Edge Cases**
How should the AI handle ambiguous trade descriptions where discipline or agency cannot be determined? Should it default to 0, or attempt to infer from other signals in the description?

*Reference: Section "Questions for Other SMEs" - Data Analytics SME analysis*

---

**7. Extraction Reliability**
What's the expected extraction accuracy threshold? If extraction fails, should we allow manual entry correction or reject the trade entirely?

*Reference: Section "Questions for Other SMEs" - Data Analytics SME analysis*
