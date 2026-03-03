# Questions for Behavioral Psychology SME

*Cross-SME questions extracted from Phase 1 analyses*

---

## From AI/NLP SME

### Context

The AI/NLP SME has analyzed the prompt engineering and extraction architecture requirements and requires validation on behavioral psychology principles.

### Questions

**1. Discipline/Agency Scoring Heuristics**

Are the scoring heuristics defined for trade extraction aligned with trading psychology principles? Specifically:

- Does "waited for confirmation" universally indicate discipline, or are there scenarios where patience could be weakness (analysis paralysis)?
- How should we handle cases where discipline and agency conflict (e.g., "stuck to my plan even though I knew it was wrong")?

*Source: AI/NLP SME Analysis - "Questions for Other SMEs > For Behavioral Psychology SME"*

---

**2. Insights Actionability: Behavioral Pattern Priorities**

What behavioral patterns should take priority in the insights? Should we flag tilt risk based on:

- Consecutive losses?
- Discipline score dropping below threshold?
- Agency score trend (becoming more reactive)?

*Source: AI/NLP SME Analysis - "Questions for Other SMEs > For Behavioral Psychology SME"*

---

**3. Edge Case Handling: Self-Deprecating Language**

How should we interpret self-deprecating language like "I probably got lucky there" - does it indicate low agency or just trader humility?

*Source: AI/NLP SME Analysis - "Questions for Other SMEs > For Behavioral Psychology SME"*

---

## From Data Analytics SME

### Context

The Data Analytics SME has analyzed the dashboard and visualization requirements and requires guidance on behavioral pattern detection.

### Questions

**1. Visual Warning Patterns**

The dashboard shows cumulative discipline and agency scores over time. What patterns should trigger a visual warning to the trader? For example:

- Is a 3-trade decline in discipline score actionable?
- Should consecutive losses with negative discipline scores show a specific alert?

*Source: Data Analytics SME Analysis - "Questions for Other SMEs > For Behavioral Psychology SME"*

---

**2. Insight Categories: Mid-Session vs. Post-Session**

For the AI Insights, what insight categories have the highest actionability for mid-session correction vs. post-session reflection? Should the insights be different based on session phase (early vs. late in session)?

*Source: Data Analytics SME Analysis - "Questions for Other SMEs > For Behavioral Psychology SME"*

---

*File generated for Phase 2 of the Aurelius Ledger requirements elaboration workflow.*
