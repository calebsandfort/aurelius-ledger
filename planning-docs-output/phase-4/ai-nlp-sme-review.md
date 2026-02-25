# AI/NLP Architecture SME Review - Phase 4

**Review Date:** 2026-02-25
**SME Agent:** ai-nlp-sme
**Input Document:** `/home/csandfort/Documents/source/repos/aurelius-ledger/planning-docs-output/phase-3/requirements-draft.md`

---

## Executive Summary

The requirements document provides a solid foundation for AI-powered trade extraction and behavioral insights. Most AI/NLP-related requirements are technically sound and reflect current best practices. However, there are several gaps, ambiguities, and potential conflicts that should be addressed before implementation.

---

## 1. Accuracy Review

### 1.1 Trade Extraction (FR 2.x)

| Requirement | Assessment | Issue |
|-------------|------------|-------|
| **FR 2.1** - Structured system prompt | ACCURATE | Well-specified. |
| **FR 2.2** - 4 few-shot examples | ACCURATE | Appropriate number; good variety coverage. |
| **FR 2.3** - Synonym clusters | ACCURATE | Valid pattern, but needs maintenance strategy. |
| **FR 2.4** - Tiered inference | ACCURATE | Solid approach for ambiguous P&L. |
| **FR 2.5** - LangGraph-style node | **NEEDS CLARIFICATION** | "LangGraph-style" is ambiguous. Is this actual LangGraph (Python/JS library) or a similar pattern? Should specify the implementation approach. |
| **FR 2.6** - Schema validation | ACCURATE | Correct approach. |
| **FR 2.7** - Retry logic | ACCURATE | 3 attempts is reasonable. |
| **FR 2.9** - Confidence score | **INCOMPLETE** | Returns confidence but doesn't specify: <br>- Calculation method (probability-based, heuristic, or LLM self-assessment)<br>- Per-field vs. overall confidence<br>- How low-confidence fields affect the composite |
| **FR 2.10** - Review scores UI | ACCURATE | Good UX pattern. |

### 1.2 Insights Generation (FR 12.x-15.x)

| Requirement | Assessment | Issue |
|-------------|------------|-------|
| **FR 12.1-12.3** - Context passing | **INCOMPLETE** | Specifies passing last 15 trades + aggregates, but missing: <br>- Data format (JSON structure)<br>- Token budget for large sessions<br>- Truncation strategy if context exceeds model limits<br>- Whether raw text or structured data is passed |
| **FR 12.6** - Non-streamed response | ACCURATE | Valid for UI consistency, but limits future UX improvement. |
| **FR 13.x** - Insight categories | ACCURATE | Good tiered prioritization. |
| **FR 14.4** - Rate limiting | **POTENTIAL CONFLICT** | 2 insights per 5-minute window may conflict with rapid trade entry. If user enters 5 trades in 5 minutes, they only get 2 insights. Consider sliding window or per-trade triggering. |

### 1.3 Performance & Model Selection (NFR 1.x-2.x)

| Requirement | Assessment | Issue |
|-------------|------------|-------|
| **NFR 1.1** - 1s extraction target | **AGGRESSIVE** | 500ms for Haiku + 200ms network = 700ms baseline. 1s target leaves little margin. Consider 1.2s target with 500ms SLA as stretch goal. |
| **NFR 1.3** - 2s insights target | ACCURATE | Reasonable for background task. |
| **NFR 2.1** - Haiku for extraction | **VAGUE** | "or Sonnet 4.5 if needed" lacks criteria. When should Sonnet be used? Consider: <br>- Auto-fallback on repeated failures<br>- Explicit threshold (e.g., confidence < 50%)<br>- User-configurable |
| **NFR 2.2** - Sonnet for insights | ACCURATE | Appropriate for synthesis tasks. |

---

## 2. Completeness Review

### 2.1 Missing Requirements

| Gap | Severity | Recommendation |
|-----|----------|----------------|
| **Prompt versioning** | HIGH | No strategy for managing prompt changes over time. Add: "The system SHALL implement prompt version tracking for debugging and A/B testing." |
| **Extraction failure logging** | MEDIUM | FR 2.7 mentions retries but not detailed logging. Add: "Failed extraction attempts SHALL log: input text, error type, retry count, and final output (if any)." |
| **Prompt injection prevention** | MEDIUM | Natural language input could contain malicious prompts. Add: "The system SHALL sanitize input to prevent prompt injection attacks." |
| **LLM API fallback** | HIGH | No strategy if OpenAI API is unavailable. Add: "When LLM API is unavailable, the system SHALL queue trades for later extraction with user notification." |
| **Confidence calibration** | MEDIUM | No mechanism to improve confidence scoring over time based on user corrections. Add: "The system SHALL track user corrections to calibrate confidence thresholds." |
| **Context window management** | MEDIUM | For sessions >50 trades, context may exceed limits. Add: "When session data exceeds model context limits, the system SHALL use sliding window (most recent trades) with aggregate history." |
| **Insights cache** | LOW | Same session state could regenerate insights unnecessarily. Consider caching insights for N seconds. |

### 2.2 Missing Technical Details

| Area | Missing Detail |
|------|-----------------|
| **Few-shot example management** | How are examples selected/rotated? Fixed set or dynamic? |
| **Synonym maintenance** | Where is synonym mapping stored? Hardcoded or database? |
| **Extraction output format** | Is it JSON string or structured object? How is validation performed? |
| **Insights input format** | Structured JSON vs. natural language summary? |
| **Rate limiting implementation** | Sliding window or fixed window? Per-session or global? |

---

## 3. Conflicts Review

### 3.1 Identified Conflicts

| Conflict | Description | Resolution |
|----------|-------------|-------------|
| **FR 14.4 vs. User Experience** | Rate limit of 2 insights per 5 minutes conflicts with rapid trade entry. A user entering 10 trades in 5 minutes would miss 8 potential insights. | Consider改为: "2 critical insights (tilt, revenge) per 5 min OR 1 observation per trade" |
| **FR 2.10 vs. NFR 1.1** | "Review scores" UI implies user intervention, but 1s SLA expects fully automated extraction. If user frequently corrects, extraction isn't actually reliable. | Clarify that review option is fallback, not norm. Add success metric: "<5% require review" |
| **NFR 1.1 vs. Real World** | 1s extraction target with 500ms Haiku + 200ms network is tight. OpenAI can have latency spikes. | Add: "95th percentile < 1.5s, 99th percentile < 3s" |

### 3.2潜在 Alignment Issues

| Issue | Description |
|-------|-------------|
| **Confidence threshold arbitrariness** | 70% threshold in FR 2.10 is not justified. Could be too high (many reviews needed) or too low (missed errors). Consider making it configurable with user feedback loop. |
| **Tilt detection threshold** | -3 composite score in FR 13.1 is arbitrary. Consider: adaptive threshold based on user's historical variance. |

---

## 4. Gaps Review

### 4.1 High-Priority Gaps

1. **Prompt Security**
   - No mention of input sanitization for prompt injection
   - No mention of output parsing safety (JSON injection)

2. **Extraction Reliability Metrics**
   - No success rate target defined
   - No accuracy measurement approach

3. **Model Cost Management**
   - No budget or rate limiting on API calls
   - No mention of caching extracted results

4. **Observability**
   - No logging of LLM inputs/outputs for debugging
   - No metrics on confidence score accuracy

### 4.2 Medium-Priority Gaps

1. **Multi-language support** - Not mentioned (assumes English)
2. **Edge cases** - No handling for trades with no description
3. **Partial extraction** - If some fields extract but not others?

---

## 5. Recommendations Summary

### 5.1 Must Fix (Before Implementation)

1. **Clarify LangGraph implementation** (FR 2.5) - Is this actual LangGraph library or pattern-based approach?

2. **Specify confidence scoring methodology** (FR 2.9) - How is confidence calculated? Per-field or overall?

3. **Add LLM API fallback strategy** - What happens when OpenAI is unavailable?

4. **Resolve rate limiting conflict** (FR 14.4) - Adjust insight rate limiting to account for rapid trade entry.

5. **Add prompt versioning** - How will prompts be tracked and improved over time?

### 5.2 Should Fix (Before Phase 1 Complete)

1. **Relax extraction SLA slightly** - 1.2s target with 95th percentile SLA
2. **Specify model selection criteria** - When to use Haiku vs. Sonnet
3. **Add context window management** - For sessions exceeding token limits
4. **Add extraction failure logging** - For debugging and prompt improvement

### 5.3 Consider Adding

1. **Confidence calibration feedback loop** - Track user corrections to improve thresholds
2. **Insights caching** - Avoid regeneration for same session state
3. **Extraction success metrics** - Target success rate (e.g., >95%)

---

## 6. Questions for Other SMEs

### For Product Manager:

1. **Clarification on FR 2.5:** Should "LangGraph-style" be interpreted as using the actual LangGraph library, or implementing a similar node-based validation architecture using standard code?

2. **Rate limiting UX:** In FR 14.4, if a user enters 10 trades in 5 minutes, which 2 insights should be shown? Most recent? Most critical? All critical + most recent observation?

3. **Extraction success metric:** What percentage of trades should extract successfully without user review? Is 95% acceptable, or should we target 99%+?

### For Technical Spec Agent:

1. **Structured output format:** Should the LLM return raw JSON string or structured object? OpenAI's structured output mode returns typed objects.

2. **Prompt storage:** Should prompts be stored in database, environment variables, or code? Database enables dynamic updates without deployment.

3. **Logging strategy:** What level of LLM input/output logging is acceptable? Full logging enables debugging but has privacy implications.

---

## 7. Overall Assessment

**Rating: 7/10**

The requirements are generally sound and reflect good AI/ML practices. The main issues are:

1. **Ambiguity** around LangGraph implementation and confidence scoring methodology
2. **Missing critical requirements** for fallback handling and prompt management
3. **Potential conflicts** between rate limiting and rapid trade entry

With the recommended fixes, this would be a strong 9/10 implementation-ready document.

---

*Review prepared by AI/NLP Architecture SME Agent*
