# Behavioral Psychology SME Review - Requirements Draft

**Review Date:** 2026-03-02
**SME:** Behavioral Psychology (Trading Psychology, Habit Formation, Intervention Design)
**Document:** `/home/csandfort/Documents/source/repos/aurelius-ledger/planning-docs-output/phase-3/requirements-draft.md`

---

## Executive Summary

The requirements draft demonstrates strong foundational understanding of behavioral psychology principles. The core design decisions around frictionless trade entry, behavioral score visualization, and non-intrusive insights are well-aligned with established frameworks (Fogg Behavior Model, habit loops, self-determination theory). However, several areas require refinement to prevent potential psychological harms and optimize behavioral outcomes.

**Overall Assessment:** Good with targeted corrections needed.

---

## 1. Accuracy Review

### 1.1 Behavioral Concepts - Correctly Represented

| Requirement | Assessment | Notes |
|-------------|------------|-------|
| FR 2.2 (Discipline Scoring) | **Accurate** | Correctly identifies discipline as adherence to plan, patience, waiting for confirmation. |
| FR 2.3 (Agency Scoring) | **Accurate** | Correctly frames agency as intentionality vs. reactive behavior. |
| FR 2.4 (Position Management) | **Accurate** | Scoring aligns with behavioral psychology - averaging down penalizes appropriately. |
| FR 4.4 (Warning System) | **Accurate** | Graduated response model is evidence-based. |
| FR 5.5 (Insight Tiers) | **Accurate** | Risk alerts > Pattern > Positive reinforcement hierarchy is correct. |
| FR 5.6 (Insight Tone) | **Accurate** | Conditional framing, action-orientation, non-judgmental language all correct. |

### 1.2 Theoretical Frameworks - Appropriately Applied

- **Fogg Behavior Model** - Well-applied to trade entry design (motivation=trading, ability=frictionless entry, prompt=persistent input)
- **Habit Formation (Hook Model)** - Cue-routine-reward loop properly implemented through persistent input + visual feedback
- **Self-Determination Theory** - Autonomy supported through non-intrusive design; competence supported through fair scoring; relatedness through insights

### 1.3 Potential Accuracy Issues

**Issue 1: FR 5.6.6 - 40% Positive Insight Quota**
- **Problem:** Mandating 40% positive insights when present creates pressure for false positives
- **Risk:** Undermines trust when trader perceives inauthentic praise
- **Recommendation:** Remove specific percentage; use guidance "ensure meaningful positive reinforcement when patterns warrant"

---

## 2. Completeness Review

### 2.1 Missing Behavioral Requirements

| Gap | Severity | Description |
|-----|----------|-------------|
| Cognitive Bias Mitigation | Medium | No requirements address anchoring bias in P&L chart, confirmation bias in insights |
| Loss Aversion Handling | Medium | P&L visualization (FR 4.1.2) uses red/green but doesn't account for asymmetric loss aversion |
| Cognitive Load Management | Medium | No explicit requirement limiting simultaneous chart interactions |
| Self-Efficacy Calibration | Low | No mechanism to prevent score gaming or ensure scores remain meaningful |
| Recovery State Support | Low | No explicit support for post-incident reflection (e.g., after 3+ consecutive losses) |

### 2.2 Missing Requirements

**NEW REQUIREMENT - Cognitive Bias Mitigation:**
> The system SHALL implement the following bias mitigation strategies:
> - FR X.X.1 The P&L chart SHALL display cumulative values, not percentage changes, to reduce relative thinking bias
> - FR X.X.2 Insights SHALL explicitly frame neutral information as such, avoiding language that implies pattern significance when statistical significance is uncertain
> - FR X.X.3 The system SHALL NOT highlight "near misses" or "almost wins" that could trigger recency bias

**NEW REQUIREMENT - Loss Aversion Calibration:**
> The system SHALL account for loss aversion in visualization:
> - FR X.X.1 The P&L chart y-axis SHOULD use asymmetric scaling if losses exceed wins by 2:1
> - FR X.X.2 Warnings SHOULD trigger at lower thresholds for consecutive losses than for consecutive wins (asymmetric alert thresholds)

---

## 3. Conflicts Review

### 3.1 Potential Conflicts with Behavioral Best Practices

| Requirement | Conflict | Resolution |
|-------------|----------|------------|
| FR 4.4.3 (Warning at 3 consecutive -1) | May be too sensitive; normal variance can produce 3 consecutive discipline lapses without tilt | Keep requirement but add FR 4.4.3.1: "Warning SHOULD require at least 2 of 3 trades to have explicit negative behavioral language in the trade description" |
| FR 4.1.2 (Dynamic red/green coloring) | Can amplify loss aversion - red triggers emotional response | Add guidance: "Color transitions SHOULD use smooth gradients rather than abrupt switches to reduce emotional reactivity" |
| FR 5.5.1 (Tilt Warning at 2 losses + -1) | Appropriate threshold but message "consider stepping back" may conflict with trader's agency | Keep but add FR 5.5.1.1: "Tilt warnings SHOULD offer options rather than directives (e.g., 'Consider: [take break] [reduce size] [log why]')" |

### 3.2 Internal Consistency

- FR 2.5.1 ("Couldn't parse that — add it manually") - Good non-judgmental error message
- FR 5.6.2 ("conditional framing rather than judgment") - Good, but could conflict with FR 5.5.1's directive language
- All warning/insight requirements are internally consistent with the non-intrusive design philosophy

---

## 4. Gaps Review

### 4.1 Behavioral Gaps to Address

**Gap 1: Feedback Timing**
- Current: Real-time updates (FR 4.6)
- Missing: Delayed feedback for certain metrics to prevent overreaction
- **Recommendation:** Add FR X.X.X: "Behavioral trend insights (not P&L) SHOULD have a minimum 2-trade confirmation before alerting, to reduce false positives from normal variance"

**Gap 2: Self-Report Calibration**
- Current: AI infers scores from trade descriptions
- Missing: No mechanism for trader to correct/override scores
- **Recommendation:** Add FR X.X.X: "The system SHALL provide a mechanism for traders to manually adjust discipline and agency scores with a reason field, and SHOULD log AI/trader score discrepancies for model calibration"

**Gap 3: Anchoring to Session Start**
- Current: Cumulative P&L starts from first trade
- Risk: Anchoring bias - trader judges session success entirely relative to first trade
- **Recommendation:** Add FR X.X.X: "The P&L chart SHOULD display a horizontal reference showing the average P&L per trade as a subtle guide, not prominently"

**Gap 4: Habit Stacking Opportunities**
- Current: Standalone persistent input
- Missing: No pre-trade routine integration
- **Recommendation:** Add FR X.X.X: "The system MAY support a configurable pre-trade 'readiness check' prompt (e.g., 'Any external factors affecting today?') that integrates into the trade entry flow"

---

## 5. Specific Recommendations

### 5.1 High-Priority Fixes

1. **FR 5.6.6** - Remove 40% positive insight quota; replace with quality-based guidance
2. **FR 4.4.3** - Add confirmation requirement for warnings (not just count-based)
3. **Add New Requirement** - Cognitive bias mitigation (Section 2 above)

### 5.2 Medium-Priority Additions

1. Self-report calibration mechanism
2. Loss aversion asymmetric scaling guidance
3. Smooth color transitions for P&L chart

### 5.3 Low-Priority Enhancements

1. Pre-trade readiness check (habit stacking)
2. Session summary benchmark (vs. personal average)

---

## 6. Cross-Domain Considerations

### For AI/NLP SME
- **Q1:** Are the discipline/agency scoring prompts sufficiently robust to handle sarcasm, self-deprecation, and humble-bragging in trade descriptions?
- **Q2:** Can the model distinguish between "I knew better but didn't follow" (low agency) and "I decided to take the trade despite my rules" (could be high agency if part of adaptive trading)?

### For Data Analytics SME
- **Q1:** Is 3 trades sufficient for meaningful pattern detection, or should the 5+ threshold from FR 4.5.4 apply to behavioral insights more broadly?
- **Q2:** Can we implement asymmetric warning thresholds (lower for consecutive losses than wins) in the chart system?

---

## 7. Summary Assessment

| Dimension | Score | Notes |
|-----------|-------|-------|
| Accuracy | 8/10 | Core behavioral concepts correct; minor issues with 40% quota |
| Completeness | 7/10 | Major gaps addressed (bias mitigation, loss aversion); minor gaps remain |
| Conflicts | 9/10 | Few conflicts; easily resolved with suggested modifications |
| Feasibility | 9/10 | All requirements are realistic and implementable |

**Final Recommendation:** APPROVE with modifications. The requirements are well-grounded in behavioral psychology and will likely produce positive behavioral outcomes if implemented as specified with the recommended corrections.

---

*Review prepared by: Behavioral Psychology SME*
*Phase 4 Review - Requirements Draft*
