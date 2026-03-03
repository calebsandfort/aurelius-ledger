# Questions for AI/NLP SME (Phase 2)

## Overview

This file contains questions from other SMEs that require AI/NLP expertise to answer.

---

## From Behavioral Psychology SME

**Source:** `/home/csandfort/Documents/source/repos/aurelius-ledger/planning-docs-output/phase-1/behavioral-psychology-sme-analysis.md`

### Question 1: Prompt Calibration for Behavioral Scores

**Context:** The behavioral psychology analysis discusses discipline and agency scoring (-1, 0, +1) for trading behavior analysis.

**Question:** How should we structure the system prompt to ensure discipline and agency scoring is consistent across different writing styles? Should we include few-shot examples of trades with known outcomes to calibrate the LLM's scoring behavior?

**Reference:** Section "Questions for Other SMEs > For AI/NLP SME" (lines 189-194)

---

### Question 2: Retry Mechanism for Zero Scores

**Context:** The scoring system relies on the LLM to extract behavioral signals from trade descriptions.

**Question:** What retry mechanism should be used when scores come back as 0 repeatedly — is this a signal that the prompt needs adjustment?

**Reference:** Section "Questions for Other SMEs > For AI/NLP SME" (lines 189-194)

---

### Question 3: Insights Generation Token Budget

**Context:** The HLRD specifies a 3-second SLA for trade entry to dashboard update. Insights are part of this flow.

**Question:** What is the optimal token budget for the insights generation to ensure it completes within the 3-second SLA? Should insights be generated asynchronously after the trade is committed to avoid blocking the UI?

**Reference:** Section "Questions for Other SMEs > For AI/NLP SME" (lines 196-198)

---

### Question 4: Score Confidence Handling

**Context:** The behavioral scoring system assigns discrete values (-1, 0, +1) based on textual analysis of trade descriptions.

**Question:** Should there be a confidence score alongside discipline/agency scores? If the LLM is uncertain, should we default to 0 or surface that ambiguity?

**Reference:** Section "Questions for Other SMEs > For AI/NLP SME" (lines 200-201)

---

### Question 5: Insight Generation Async vs Sync

**Context:** Discussion of trade entry latency requirements.

**Question:** Should insights be generated asynchronously after the trade is committed to avoid blocking the UI? If so, what should the UI show while insights are generating?

**Reference:** Section "Questions for Other SMEs > For AI/NLP SME" (lines 196-198)

---

### Question 6: Few-Shot Examples for Scoring Calibration

**Context:** The behavioral psychology SME is concerned with consistency of discipline/agency scoring.

**Question:** Should we include few-shot examples of trades with known outcomes to calibrate the LLM's scoring behavior? What examples would be most valuable for distinguishing between positive, negative, and neutral behavioral signals?

**Reference:** Section "Questions for Other SMEs > For AI/NLP SME" (lines 192-194)

---

## From Data Analytics SME

**Source:** `/home/csandfort/Documents/source/repos/aurelius-ledger/planning-docs-output/phase-1/data-analytics-sme-analysis.md`

### Question 7: Insights Data Format

**Context:** The data analytics analysis discusses dashboard data requirements and real-time updates.

**Question:** What data format should be passed to the insights generation agent — raw trade records with all fields, pre-aggregated session statistics, or a structured combination? Should the agent receive the data as a JSON object or as a formatted text summary?

**Reference:** Section "Questions for Other SMEs > For AI/NLP SME" (lines 227-229)

---

### Question 8: Insights Regeneration Strategy

**Context:** Real-time dashboard updates need to balance freshness with performance.

**Question:** For real-time dashboard updates, should insights be regenerated after every trade, or should there be a debounce/throttle mechanism? What's the expected latency for insights generation?

**Reference:** Section "Questions for Other SMEs > For AI/NLP SME" (lines 231-232)

---

### Question 9: Edge Case Handling for Small Sessions

**Context:** Early in a trading session, there may be insufficient data for pattern detection.

**Question:** How should the insights agent handle edge cases like sessions with only 1-2 trades (insufficient data for pattern detection)?

**Reference:** Section "Questions for Other SMEs > For AI/NLP SME" (lines 233-234)

---

## Summary

The AI/NLP SME is asked to provide guidance on:

1. Prompt structure and few-shot calibration for behavioral scoring
2. Confidence scoring and retry mechanisms
3. Token budgets and async vs sync insights generation
4. Data format for insights generation
5. Debounce/throttle strategies for real-time updates
6. Edge case handling for minimal data scenarios
