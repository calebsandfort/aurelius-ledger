# AI/NLP SME Review: Requirements Draft (Phase 4)

## Overview

This review evaluates the requirements draft from the AI/NLP architecture domain perspective. The review checks for accuracy, completeness, conflicts, and gaps relative to the established tech stack (FastAPI + LangGraph + LangChain + OpenAI + CopilotKit).

---

## 1. Accuracy Review

### 1.1 Technical Details - CORRECT

| Requirement | Assessment | Notes |
|-------------|------------|-------|
| FR 2.1.1 | Correct | LangChain's `with_structured_output()` with Pydantic is the standard approach for OpenAI structured outputs |
| FR 2.1.2 | Correct | Retry logic with up to 2 retries is appropriate |
| FR 2.2.1 | Correct | 3-4 few-shot examples aligns with Phase 1 recommendation |
| FR 2.2.4 | Correct | JSON Schema via OpenAI structured output is accurate |
| FR 5.1.1-5.1.3 | Correct | Structured JSON payload format matches Phase 2 answer Q7 |
| FR 5.2.1 | Correct | Async generation aligns with Phase 2 answer Q5 |

### 1.2 Minor Technical Clarifications

**TIC 2.4** - The requirement states: "Backend endpoint SHALL use `add_langgraph_fastapi_endpoint` from `ag_ui_langgraph`"

**Clarification needed**: The package name may be incorrect. The standard LangGraph FastAPI integration is typically from `@langchain/langgraph` or `@langchain/community`. The reference `ag_ui_langgraph` should be verified in AGENTS.md to ensure correct package name.

**Recommendation**: Change to "from `@langchain/langgraph`" or verify the actual package name specified in AGENTS.md.

---

## 2. Completeness Review

### 2.1 Missing Requirements - AI/NLP Domain

| Gap | Severity | Description |
|-----|----------|-------------|
| Model Selection | HIGH | No requirement specifies which OpenAI model to use for extraction or insights |
| Timeout Handling | MEDIUM | No explicit timeout for AI extraction calls |
| API Fallback Strategy | MEDIUM | No requirement for what happens when OpenAI API is unavailable |
| Rate Limiting | LOW | No requirements about API rate limiting protection |
| Extraction Caching | LOW | No caching of identical trade descriptions |
| Output Validation | MEDIUM | Schema validation exists but no business logic validation (e.g., P&L reasonable range) |
| Observability | LOW | No requirements for logging extraction results for accuracy tracking |

### 2.2 Model Selection - CRITICAL MISSING REQUIREMENT

The requirements do not specify which OpenAI model to use for:
1. Trade extraction (FR 2.0)
2. Insights generation (FR 5.0)

**Current best practice recommendation**:
- **Extraction**: `gpt-4o-mini` - optimized for speed and cost, sufficient for simple structured extraction
- **Insights**: `gpt-4o` - better reasoning for complex behavioral analysis

**Proposed new requirement**:
> **FR X.X Model Selection**
> - The system SHALL use `gpt-4o-mini` for trade extraction to optimize for latency and cost.
> - The system SHALL use `gpt-4o` for insights generation to ensure accurate behavioral analysis.

---

## 3. Conflicts Review

### 3.1 CopilotKit Integration Architecture

**Potential conflict identified**:

| Requirement | Concern |
|-------------|---------|
| TIC 2.1 | "All CopilotKit traffic SHALL flow through the Next.js `/api/copilotkit` proxy" |
| TIC 2.3 | "The trade extraction agent SHALL be implemented as a LangGraph node within the backend" |
| FR 2.0 | Trade extraction via AI agent |

**Analysis**:
- CopilotKit is primarily designed for frontend chat UI integration (in-app copilot patterns)
- Trade extraction is specified as a LangGraph node on FastAPI backend (traditional API pattern)
- These are two different architectural patterns

**Resolution options**:
1. **Option A**: Use CopilotKit for the chat interface to query insights/history, but keep extraction as direct FastAPI call
2. **Option B**: Implement extraction as a CopilotKit action that proxies to the backend

**Recommendation**: The requirements should clarify that CopilotKit handles the insights panel and natural language queries, while extraction goes through direct API call (as per TIC 2.3). This is a valid hybrid approach.

### 3.2 Timing Requirements - CONSISTENT

The requirements are internally consistent:
- NFR 1.1: Trade entry to DB write < 3 seconds
- NFR 1.3: Insights generation async within 1-2 seconds
- FR 5.2.1: 3-second SLA applies to trade entry/dashboard only, not insights

This aligns with Phase 2 answer Q5 (async insights).

---

## 4. Gaps Review

### 4.1 Required New Requirements

#### Gap 1: Extraction Timeout

**Proposed new requirement**:
> **FR X.X Extraction Timeout**
> - The system SHALL implement a timeout of 5 seconds for trade extraction AI calls.
> - If timeout occurs, the system SHALL retry once, then surface a recoverable error.
> - The system SHALL NOT write partial data on timeout.

#### Gap 2: OpenAI API Fallback

**Proposed new requirement**:
> **FR X.X API Availability**
> - When OpenAI API is unavailable, the system SHALL display: "Trade saved. Analysis unavailable — check back later."
> - The trade SHALL be saved without extraction data.
> - The system SHALL queue extraction for retry when API recovers.

#### Gap 3: Extraction Result Validation

**Proposed new requirement**:
> **FR X.X Business Logic Validation**
> - The system SHALL validate extracted P&L is within reasonable range (-$10,000 to +$10,000 per trade).
> - The system SHALL validate direction is either "long" or "short".
> - Invalid extractions SHALL trigger retry before failing.

#### Gap 4: Observability

**Proposed new requirement**:
> **FR X.X Extraction Logging**
> - The system SHALL log all extraction inputs and outputs for accuracy monitoring.
> - The system SHALL track extraction success rate by confidence level.
> - The system SHALL flag recurring extraction patterns for prompt recalibration.

#### Gap 5: Prompt Security

**Proposed new requirement**:
> **FR X.X Input Sanitization**
> - The system SHALL sanitize trade descriptions before passing to LLM to prevent prompt injection.
> - The system SHALL remove or escape any system prompt instructions embedded in trade descriptions.

---

## 5. Summary of Changes

### 5.1 Recommendations for Modification

| Ref | Change Type | Description |
|-----|-------------|-------------|
| TIC 2.4 | Clarify | Verify package name for LangGraph FastAPI endpoint |
| New FR | Add | Model Selection - specify gpt-4o-mini for extraction, gpt-4o for insights |
| New FR | Add | Extraction Timeout - 5 second max with retry |
| New FR | Add | API Fallback - graceful degradation when OpenAI unavailable |
| New FR | Add | Business Logic Validation - validate extracted values are reasonable |
| New FR | Add | Extraction Logging - observability for accuracy tracking |
| New FR | Add | Input Sanitization - prevent prompt injection |

### 5.2 Requirements to Keep (No Changes)

- FR 2.1.1 - LangGraph node with validation (correct)
- FR 2.2.x - Prompt structure with few-shot examples (correct)
- FR 2.3.x - Ambiguous P&L handling (correct)
- FR 2.5.x - Error handling with user-friendly messages (correct)
- FR 5.1.x - Insights context format (correct)
- FR 5.2.x - Async generation timing (correct)
- FR 5.3.x - Regeneration strategy with debounce (correct)
- FR 5.4.x - Small session handling (correct)

---

## 6. Tech Stack Compliance

All requirements are compatible with the established tech stack:
- FastAPI + LangGraph + LangChain + OpenAI: Yes
- CopilotKit: Yes (with clarification needed on integration pattern)
- TimescaleDB + Drizzle ORM: Yes (data layer, not AI domain)
- Next.js + TypeScript: Yes (frontend)

**No conflicts with tech stack detected** - only the CopilotKit integration pattern needs clarification.

---

## Conclusion

The requirements draft is **largely accurate** and aligns well with the Phase 1/2 SME recommendations. However, there are **critical missing requirements** around model selection and **several important gaps** around reliability and observability that should be addressed before finalization.

The main areas requiring attention are:
1. **Model selection specification** (HIGH priority)
2. **Timeout and fallback handling** (MEDIUM priority)
3. **Integration pattern clarification for CopilotKit** (MEDIUM priority)

---

*Review prepared by: AI/NLP SME*
*Date: 2026-03-02*
*Sources: Requirements Draft, Phase 1 Analysis, Phase 2 Q&A, Tech Stack (AGENTS.md)*
