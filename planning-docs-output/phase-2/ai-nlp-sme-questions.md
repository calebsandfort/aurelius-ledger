# Questions for AI/NLP SME

*Cross-SME questions extracted from Phase 1 analyses*

---

## From Behavioral Psychology SME

### Context

The Behavioral Psychology SME has analyzed the requirements from a trading psychology perspective and requires clarification on several AI/NLP implementation details.

### Questions

**1. Extraction Reliability: Confidence Threshold**

What confidence threshold should the LLM return for discipline/agency scores? Should the system surface low-confidence scores differently to the user?

*Source: Behavioral Psychology SME Analysis - "Questions for Other SMEs > For AI/NLP SME"*

---

**2. Temporal Context in Insights**

How much session history should be included in the insights prompt? Should we include all trades, or only recent ones? What's the optimal trade count context window?

*Source: Behavioral Psychology SME Analysis - "Questions for Other SMEs > For AI/NLP SME"*

---

**3. Linguistic Pattern Detection**

Beyond explicit keywords ("chased," "waited"), can the model detect subtler linguistic patterns that indicate emotional state (sentence length, hedging language, causal attributions)?

*Source: Behavioral Psychology SME Analysis - "Questions for Other SMEs > For AI/NLP SME"*

---

**4. Insight Personalization vs. Privacy**

How can we tune insights to individual traders without storing potentially sensitive behavioral profiles? Is federated learning appropriate here?

*Source: Behavioral Psychology SME Analysis - "Questions for Other SMEs > For AI/NLP SME"*

---

**5. Ambiguous P&L Handling**

The HLRD mentions "small winner" type descriptions. What specific fallback logic should we use, and should we prompt the user for clarification instead of guessing?

*Source: Behavioral Psychology SME Analysis - "Questions for Other SMEs > For AI/NLP SME"*

---

## From Data Analytics SME

### Context

The Data Analytics SME has analyzed the data modeling and visualization requirements and requires clarification on AI/NLP extraction specifics.

### Questions

**1. Implicit P&L Signals**

How should the extraction agent handle implicit P&L signals when no dollar amount is provided (e.g., "took a small winner," "barely scratched," "big loser")? Should we:

- Map to approximate dollar thresholds (e.g., <$100 = small, >$500 = big)?
- Use a confidence score and default to requiring explicit amounts?
- Assign a special marker requiring manual review?

*Source: Data Analytics SME Analysis - "Questions for Other SMEs > For AI/NLP SME"*

---

**2. Few-Shot Examples Diversity**

For the few-shot examples in the system prompt, what is the recommended diversity of trading scenarios? Should we include:

- Edge cases (breakeven trades, exactly $0 P&L)?
- Ambiguous discipline/agency language for score calibration?
- Different writing styles (terse vs. verbose descriptions)?

*Source: Data Analytics SME Analysis - "Questions for Other SMEs > For AI/NLP SME"*

---

*File generated for Phase 2 of the Aurelius Ledger requirements elaboration workflow.*
