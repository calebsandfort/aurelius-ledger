# Behavioral Psychology SME Review

## Phase 4 Requirements Review

**SME:** Behavioral Psychology (Trading Psychology, Habit Formation, Behavioral Interventions)
**Document:** `/home/csandfort/Documents/source/repos/aurelius-ledger/planning-docs-output/phase-3/requirements-draft.md`

---

## Executive Summary

The requirements draft demonstrates strong foundational understanding of trading psychology, with well-designed behavioral scoring mechanisms and thoughtful non-functional requirements around user tone. However, several gaps and concerns exist that should be addressed to ensure the behavioral interventions are maximally effective and ethically sound.

**Overall Assessment:** Good with recommended improvements.

---

## Accuracy Review

### Correctly Implemented Behavioral Concepts

1. **Discipline & Agency Scores (FR 3.0-3.7):** These are well-defined constructs from trading psychology literature. Agency taking precedence over discipline (FR 3.6) is sound - when a trader lacks agency, behavioral interventions are less effective regardless of discipline level.

2. **Tilt Detection (FR 7.5-7.6):** The weighted scoring (consecutive losses x2) aligns with empirical findings that string losses are the primary tilt trigger. Thresholds (0-1: no alert, 2-3: yellow, 4+: red) are reasonable.

3. **Observational Tone (NFR 3.4):** Using "Discipline score declining" vs "You're being undisciplined" reflects motivational interviewing principles - this is excellent.

4. **Non-Shaming Language (NFR 3.5):** Critical for maintaining psychological safety and encouraging honest self-reporting.

5. **Subtle Visual Warnings (FR 8.3):** Using color tinting rather than blocking elements avoids inducing anxiety - this is behaviorally sound.

### Issues with Accuracy

**NFR 3.3 - Loss-Framing Concern:**
> "The system SHALL use loss-framing for tilt warnings and gain-framing for positive patterns."

**Concern:** This contradicts established behavioral science. Loss aversion is already over-represented in trading psychology - traders naturally focus on losses. Research shows loss-framing can increase anxiety and risk-averse behavior, potentially triggering the very tilt the system seeks to prevent.

**Recommendation:** Use neutral framing with action orientation:
- Instead of: "You're down $500 - don't revenge trade"
- Use: "Three consecutive losses detected. Consider taking a 5-minute break before your next entry."

**FR 3.7 - Self-Deprecating Language Detection:**
> "The system SHALL detect self-deprecating language patterns and assign agency_score = -1 for external attribution on wins (e.g., 'got lucky')."

**Concern:** This is a good insight but the example is weak. "Got lucky" on a win is external attribution, but the more behaviorally significant pattern is internal attribution on losses ("I messed up", "I'm so stupid") combined with external attribution on wins ("market gave me that one").

**Recommendation:** Add detection for:
- Internal attribution on losses: agency_score = -1
- External attribution on wins: agency_score = -1 (as currently specified)

---

## Completeness Review

### Missing Behavioral Requirements

1. **Positive Psychology Integration:**
   The system focuses entirely on negative patterns (tilt, lack of discipline, loss of agency). There is no requirement to recognize and reinforce positive behavioral patterns.

   **Proposed New Requirement:**
   > **FR X.X Positive Reinforcement**
   > - The system SHALL generate a "strengths highlight" when:
   >   - A trader maintains positive discipline through volatility
   >   - A trader demonstrates recovery after a loss (good agency)
   >   - Win rate exceeds 60% with positive discipline
   > - Positive insights SHALL use active, affirming language ("Your patience paid off" vs "Good discipline score")

2. **Implementation Intentions:**
   Research shows that specifying when/how to act (implementation intentions) improves behavior change. The system could prompt this after tilt detection.

   **Proposed New Requirement:**
   > **FR X.X Implementation Intention Prompt**
   > - When tilt risk score reaches yellow (2-3), the system SHALL offer a optional prompt: "What's your plan if you feel the urge to overtrade in the next 15 minutes?"

3. **Recovery Detection:**
   The system detects decline but not recovery - which is critical for building confidence.

   **Proposed New Requirement:**
   > **FR X.X Recovery Recognition**
   > - The system SHALL detect behavioral recovery (positive discipline after 2+ consecutive negative scores) and highlight this in insights
   > - Recovery insights SHALL be prioritized to reinforce successful self-regulation

4. **Session Closure Ritual:**
   Research on habit formation emphasizes end-of-routine cues. A session summary could serve as a closure ritual.

   **Proposed New Requirement:**
   > **FR X.X Session Summary**
   > - The system SHALL provide a end-of-session summary when no trades occur for 30+ minutes during market hours
   > - Summary SHALL include: win rate, discipline trend, one key insight, comparison to previous sessions (optional)

5. **Cognitive Load Management (NFR 3.2 partially addresses):**
   The requirement mentions visual indicators but does not specify information hierarchy.

   **Proposed New Requirement:**
   > **FR X.X Information Hierarchy**
   > - Primary metrics (P&L, tilt risk) SHALL be visually dominant
   > - Secondary metrics (discipline trend, agency trend) SHALL be visible but less prominent
   > - Historical context SHALL be accessible via interaction, not displayed by default

---

## Gaps Review

### Unincorporated SME Recommendations

From the synthesis notes, several SME concerns were addressed, but the following behavioral psychology recommendations appear unaddressed:

1. **Feedback Timing:**
   Behavioral research emphasizes immediate feedback for habit formation. The requirements specify asynchronous insights (FR 7.3), which is correct for AI quality, but no requirement exists for immediate acknowledgment of trade receipt.

   **Gap:** No requirement for instant "trade logged" confirmation with brief behavioral micro-feedback (e.g., "Discipline: +1" appears immediately, insights come asynchronously).

2. **Baseline Establishment:**
   The system calculates rolling averages but no requirement addresses establishing a personal baseline. A new trader needs different feedback than an experienced trader.

   **Gap:** No requirement for personalization based on session count or historical baseline.

3. **Attribution Training:**
   The system detects external attribution on wins but does not help the trader recognize and correct this pattern.

   **Gap:** No educational component or pattern explanation when attribution issues are detected.

4. **Choice Architecture for Breaks:**
   The tilt warnings suggest breaks but do not make taking a break easy.

   **Gap:** No "take break" one-click action that logs the break time and prompts return.

---

## Conflicts Review

### Internal Conflicts

1. **FR 7.4 vs. FR 7.8:**
   FR 7.4 prioritizes insight types (1. Tilt Risk, 2. Discipline Trajectory, 3. Agency Trend, 4. Outcome Patterns), but FR 7.8 limits display to "maximum of 3 insight items." If tilt risk is present, it takes one slot, leaving only 2 slots for other insights. This may not provide enough information post-session.

   **Resolution:** Consider differentiating mid-session (max 2-3 insights) from post-session (up to 4 insights with longer display time).

2. **FR 5.7 vs. NFR 3.3:**
   Blue/amber color scheme (FR 5.7) is good for avoiding loss aversion triggers, but loss-framing (NFR 3.3) works against this. The color scheme decision in Synthesis Notes correctly prioritizes avoiding loss aversion - the NFR 3.3 should be revised to match.

### Tech Stack Conflicts

No conflicts detected between behavioral requirements and the established tech stack (Next.js, TypeScript, Shadcn/ui, Tailwind CSS, Better Auth, Drizzle ORM, CopilotKit, FastAPI, LangGraph, LangChain, OpenAI, TimescaleDB, Docker Compose).

The LangGraph-based extraction pipeline is appropriate for the nuanced behavioral scoring required.

---

## Specific Recommendations

### Priority 1 (Critical)

| Ref | Issue | Recommendation |
|-----|-------|----------------|
| NFR 3.3 | Loss-framing may increase anxiety and trigger tilt | Replace with action-oriented neutral framing |
| NFR 3.5 | No explicit prohibition on shame-inducing language in AI prompts | Add requirement for prompt engineering guidelines document |

### Priority 2 (Important)

| Ref | Issue | Recommendation |
|-----|-------|----------------|
| FR 3.7 | Self-deprecating detection incomplete | Add internal attribution on losses detection |
| - | No positive reinforcement | Add FR for strengths recognition |
| - | No recovery detection | Add FR for behavioral recovery highlighting |

### Priority 3 (Enhancement)

| Ref | Issue | Recommendation |
|-----|-------|----------------|
| - | No implementation intention prompts | Add optional implementation intention after tilt |
| - | No session closure ritual | Add end-of-session summary |
| - | No choice architecture for breaks | Add one-click break logging |

---

## Conclusion

The requirements draft is solid from a behavioral psychology standpoint, with good theoretical grounding in trading psychology concepts. The key issues are:

1. **NFR 3.3 should be revised** to use neutral/action-oriented framing instead of loss-framing
2. **Several positive psychology elements are missing** that would improve effectiveness
3. **The system is well-aligned with the tech stack** - no conflicts

The synthesis notes correctly identified the color scheme decision as addressing loss aversion concerns. However, the loss-framing requirement in NFR 3.3 contradicts this and should be revised.

---

## Questions for Other SMEs

**For AI/NLP SME:**
- Can the extraction prompt be structured to detect both internal attribution on losses AND external attribution on wins simultaneously?
- What is the expected accuracy ceiling for detecting subtle self-deprecating language patterns?

**For Data Analytics SME:**
- The denormalized session metrics (FR 4.4) include consecutive_wins and consecutive_losses - is the calculation logic defined for detecting the 3+ consecutive threshold used in FR 8.2?
