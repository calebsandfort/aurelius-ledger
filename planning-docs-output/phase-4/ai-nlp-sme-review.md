# AI/NLP SME Review: Requirements Draft

## Overview

This review evaluates the requirements draft for accuracy, completeness, gaps, and conflicts within the AI/NLP domain. The requirements draft is generally well-structured and aligned with the established tech stack. However, several enhancements and clarifications are recommended.

---

## Accuracy Assessment

### Correct and Feasible Requirements

| FR | Assessment |
|-----|------------|
| FR 2.2 | **Correct** - LangGraph-based extraction with validation step aligns with stack |
| FR 2.3 | **Correct** - 3-5 few-shot examples is optimal for few-shot learning without excessive token consumption |
| FR 2.4 | **Correct** - Heuristic mapping for ambiguous P&L phrases is a practical hybrid approach |
| FR 2.5-2.6 | **Correct** - Confidence score handling with display thresholds is well-specified |
| FR 2.7-2.8 | **Correct** - Error handling for extraction failures is appropriate |
| FR 3.1-3.7 | **Correct** - Behavioral scoring criteria are well-defined |
| FR 7.1-7.8 | **Correct** - Insights generation with hybrid context and prioritization is sound |
| NFR 1.2 | **Aggressive but feasible** - 2.5s LLM timeout requires optimized prompts |

---

## Completeness Analysis

### Missing Requirements

1. **Prompt Integration for Behavioral Scoring**
   - **Gap**: FR 3.x behavioral scoring criteria are not explicitly tied to the extraction prompt design
   - **Recommendation**: Add FR 2.x requirement that extraction prompt includes behavioral scoring instructions as system prompt content

2. **Prompt Versioning**
   - **Gap**: No mechanism for iterating on extraction prompts based on failure analysis
   - **Recommendation**: Add requirement for prompt version tracking in extraction logs

3. **Insights Idempotency**
   - **Gap**: FR 7.3 generates insights asynchronously; if trade save succeeds but insight generation fails, retry could produce different insights
   - **Recommendation**: Add requirement that insights generation is idempotent or stores generated insight hash

4. **Token Budget Management**
   - **Gap**: No explicit requirement for token budget in insights context
   - **Recommendation**: Add NFR for maximum token count in insights prompt (e.g., 2000 tokens)

5. **Extraction Retry Strategy**
   - **Gap**: NFR 2.1 mentions "retry up to 2 times" but doesn't specify strategy
   - **Recommendation**: Clarify if retry uses same prompt, refined prompt, or escalation to different model

---

## Gap Analysis

### SME Recommendations Not Incorporated

From the requirements draft synthesis notes (lines 287-295), several SME recommendations were addressed, but the following were not explicitly included:

1. **Chain-of-Thought for Behavioral Scores**
   - Not incorporated: Requirement for extraction LLM to provide reasoning for behavioral scores
   - Rationale: May increase latency beyond NFR 1.2 threshold

2. **Dynamic Few-Shot Selection**
   - Not incorporated: Using retrieval-augmented example selection based on trade description similarity
   - Rationale: Adds complexity; static few-shot is acceptable baseline

3. **Confidence Calibration Feedback Loop**
   - Not incorporated: Using user corrections to calibrate confidence thresholds
   - Rationale: Out of scope for v1; can be enhancement

---

## Conflict Analysis

### Potential Conflicts with Tech Stack

| Item | Assessment | Resolution |
|------|------------|------------|
| CopilotKit + Insights Panel | **No conflict** - FR 5.8 and 7.x specify insights panel, compatible with CopilotKit integration | Already aligned |
| FastAPI + LLM calls | **No conflict** - All LLM calls on backend per stack | Already aligned |
| LangGraph + validation | **No conflict** - FR 2.2 specifies LangGraph with validation | Already aligned |

### Internal Conflicts

1. **NFR 1.2 (2.5s timeout) vs. FR 2.3 (5 few-shot examples)**
   - Potential conflict: More few-shot examples increase latency
   - Mitigation: 3-5 examples is acceptable; monitor latency in practice

2. **FR 7.2 (7 trades context) vs. NFR 1.1 (3s total latency)**
   - Potential conflict: Insufficient context for good insights
   - Clarification: Insights generated asynchronously (FR 7.3), so NFR 1.1 applies to trade entry, not insights

---

## Recommendations

### High Priority

1. **Add FR 2.x System Prompt Requirement**
   ```markdown
   - **FR 2.9** The extraction system prompt SHALL include behavioral scoring criteria (FR 3.1-3.7) as part of the extraction instructions to enable single-pass extraction of all fields.
   ```

2. **Add NFR for Token Budget**
   ```markdown
   - **NFR 1.6** Insights generation prompt SHALL not exceed 2500 tokens including context.
   ```

3. **Clarify Extraction Retry Strategy**
   ```markdown
   - **NFR 2.1 (revised)** The extraction pipeline SHALL retry up to 2 times on validation failure, using a refined prompt with additional context on the second attempt, before surfacing an error.
   ```

### Medium Priority

4. **Add Prompt Versioning Log**
   ```markdown
   - **NFR 25** Extraction logs SHALL include prompt version identifier for analysis and iteration.
   ```

5. **Add Insights Idempotency**
   ```markdown
   - **FR 7.9** Generated insights SHALL be stored with the trade record to prevent regeneration on retry.
   ```

### Low Priority (Future Enhancement)

6. Consider adding CoT reasoning for behavioral scores in v2
7. Consider dynamic few-shot retrieval in v2
8. Consider confidence calibration feedback loop in v2

---

## Summary

**Overall Assessment**: The requirements draft is **strong** with respect to AI/NLP. Key strengths:
- Well-specified extraction pipeline with confidence handling
- Comprehensive behavioral scoring criteria
- Appropriate insights prioritization
- Correct alignment with tech stack (LangGraph, FastAPI backend)

**Action Items**:
1. Add FR 2.9 to explicitly tie behavioral scoring to extraction prompt
2. Add NFR 1.6 for token budget management
3. Clarify retry strategy in NFR 2.1
4. Add insights idempotency in FR 7.9

With these minor additions, the requirements will be complete and feasible for implementation.

---

## Questions for Other SMEs

**For Data Analytics SME:**
- Are the denormalized session metrics (FR 4.4) sufficient for the insights calculations, or are there additional aggregates needed for the Tilt Risk Score?

**For Behavioral Psychology SME:**
- Is the 7-trade context window (FR 7.2) sufficient for detecting meaningful behavioral patterns, or should it be configurable?

---
