# Behavioral Psychology SME Review - Requirements Draft

**Reviewed by:** SME:BehavioralCoach
**Date:** 2026-02-25
**Phase:** 4 - Requirements Review

---

## Executive Summary

The requirements draft demonstrates a solid foundation in behavioral psychology principles, correctly applying concepts such as loss aversion, ego depletion, and self-determination theory. However, there are several areas requiring clarification, some potential conflicts, and notable gaps that should be addressed to ensure the behavioral scoring system is both accurate and ethically sound.

---

## 1. Accuracy Assessment

### 1.1 Discipline Scoring (FR 3.0) - ACCURATE

The discipline score rubrics are well-grounded in behavioral science:

- **FR 3.1** correctly identifies implementation intention indicators (waiting for confirmation, respecting stop losses) as markers of deliberate execution.
- **FR 3.2** appropriately captures reactive behavioral patterns (chasing, FOMO, revenge trading) which align with System 1 thinking and diminished self-control.
- The use of -1/0/1 ternary scoring is appropriate given the inherent ambiguity in natural language signals.

**Recommendation:** Consider adding "scaled in" as a positive discipline indicator, as pyramid entries demonstrate patience and risk management.

### 1.2 Agency Scoring (FR 4.0) - PARTIALLY ACCURATE

- **FR 4.1** correctly maps to self-determination theory's autonomy construct.
- **FR 4.2** appropriately captures external locus of control language.

**CONCERN - FR 4.2 Issue:** "Got stopped" is listed as a negative agency indicator, but being stopped out is a normal mechanical aspect of trading - not an agency issue. This could create false negatives where disciplined traders who respect their stops are penalized.

**Recommendation:** Remove "got stopped" from FR 4.2 or clarify it should only trigger when accompanied by blame language (e.g., "got stopped out unfairly").

### 1.3 Composite Score Calculation (FR 5.0) - ACCURATE

- The rolling 5-trade window is appropriate for real-time intervention purposes, balancing responsiveness with statistical reliability.
- The trend calculation comparing last 3 vs. previous 3 trades with a 0.5 threshold is methodologically sound.

**Note:** The composite score ranges from -10 to +10. While the asymmetric intervention thresholds (see FR 15.0) are appropriate (more aggressive intervention for declining states), this should be explicitly justified in documentation.

---

## 2. Completeness Assessment

### 2.1 Tilt Risk Detection (FR 13.1-13.3) - ADEQUATE

- The composite score threshold of -3 is reasonable (approximately 30% of maximum negative score).
- The consecutive negative trades alternative trigger is well-designed - it captures immediate behavioral deterioration regardless of absolute score.
- The revenge trading detection (FR 13.3) correctly identifies the temporal pattern (immediate re-entry within 5 minutes) and behavioral markers (opposite direction or increased size).

**GAP IDENTIFIED:** The requirements do not address **size escalation** as a tilt indicator. Research on tilted trading shows that position size often increases after losses as traders seek to "make back" losses quickly. This should be added to FR 13.3.

### 2.2 Decision Fatigue (FR 13.5) - ACCURATE

- The 90-minute threshold aligns with ego depletion research (Baumeister et al.) showing decision fatigue onset around 90 minutes of continuous cognitive work.
- The 8-trade threshold is reasonable for active trading.

**GAP IDENTIFIED:** No consideration is given to **time of day effects**. Circadian rhythm research shows that decision quality degrades significantly after 3 PM ET for US market traders. Consider adding time-of-day as a modulating factor.

### 2.3 Insight Categories (FR 13.0) - INCOMPLETE

**MISSING INSIGHT TYPES:**

1. **Confirmation Bias Detection** - No requirement to identify when traders override their own analysis due to desire to be in a trade.

2. **Anchoring Effects** - No detection of traders anchoring to entry prices rather than thesis-invalidating levels.

3. **Sunk Cost Behavior** - No detection of traders holding losing positions longer than warranted to "avoid admitting failure."

4. **Overconfidence Trajectory** - No tracking of whether a trader becomes increasingly aggressive after a series of wins (the "hot hand" fallacy).

**Recommendation:** Add these as Tier 2 or Tier 3 insight types once sufficient data exists.

### 2.4 Intervention Design (FR 14.0) - ADEQUATE

- The separation of observation vs. recommendation insights (FR 14.1-14.2) respects trader autonomy - this aligns with motivational interviewing principles.
- The rate limiting (2 insights per 5-minute window - FR 14.4) prevents alarm fatigue and is well-designed.

---

## 3. Conflicts Identified

### 3.1 Win/Loss Display Inconsistency

**CONFLICT:**
- **FR 13.8** explicitly states: "The system SHALL NOT display win/loss ratio or total session P&L in mid-session insights (to avoid anchoring and loss aversion)."
- **FR 8.1** displays: "win/loss count as ratio (e.g., '3-2')" in the header bar.

**Analysis:** This creates a direct conflict. The win/loss ratio in the header will trigger the exact loss aversion behaviors FR 13.8 seeks to prevent. Behavioral research shows that even numerical displays of W/L ratio during active trading causes traders to become risk-averse after losses (trying to "get back to even") or risk-seeking after wins (feeling invincible).

**Recommendation:** Either:
1. Remove win/loss ratio from FR 8.1 header, OR
2. Change FR 13.8 to allow win/loss count but not ratio (counts are less anchoring than ratios), OR
3. Add a toggle in settings to show/hide W/L in header for traders who know they are loss averse.

### 3.2 Score Display Labels (FR 15.0)

The qualitative labels create potential confusion with the quantitative thresholds:

| Score Range | Label | Composite Score Range |
|-------------|-------|------------------------|
| +2 or higher | "Strong" | +4 to +10 |
| +1 to -1 | "Neutral" | -2 to +2 |
| -2 to -3 | "Declining" | -4 to -6 |
| -4 or lower | "At Risk" | -8 to -10 |

**CONCERN:** A composite score of -3 (which triggers tilt risk per FR 13.1) displays as "Declining" in FR 15.3, but the intervention threshold is labeled "At Risk" only at -4. This creates a gap where users at -3 receive a tilt warning but see a "Declining" label.

**Recommendation:** Adjust FR 15.3 to show "At Risk" at -3 to align with FR 13.1 tilt threshold.

---

## 4. Gaps Identified

### 4.1 Individual Calibration

**CRITICAL GAP:** The requirements assume universal scoring rubrics without individual calibration. Behavioral psychology research shows significant individual differences in:

- Baseline impulsivity and self-control
- Response to losses (some traders tilt after 1 loss, others after 5)
- Optimal intervention intensity

**Recommendation:** Add a requirement for:
- **NFR X.0** Individual Calibration (Phase 2): "The system SHALL support individual threshold adjustment based on user feedback on intervention appropriateness over 10+ sessions."

### 4.2 Pre-Trade Behavioral Context

**GAP:** The system only analyzes the trade description, not the trader's state entering the trade. Research shows:

- Fatigue from non-trading activities affects decisions
- Emotional state carries over between trades
- Recent life stressors impact risk tolerance

**Recommendation:** Add optional pre-trade mood/input field or correlation analysis with session timing.

### 4.3 Behavioral Intervention Effectiveness Tracking

**GAP:** No requirement exists to track whether behavioral interventions (recommendations) actually change trader behavior. Without this feedback loop, the system cannot improve its intervention timing.

**Recommendation:** Add:
- **FR XX.0** Intervention Effectiveness Tracking: "The system SHALL track whether traders follow tilt risk recommendations (e.g., take the suggested break) and adjust intervention thresholds based on compliance rates."

### 4.4 Ethical Considerations - Paternalism vs. Autonomy

**GAP:** The requirements lack explicit guidance on when the system should intervene vs. respect trader autonomy. With a composite score of -3, the system strongly recommends a break - but what if the trader is in a profitable zone-out trade?

**Recommendation:** Add:
- **NFR X.0** Autonomy Preservation: "The system SHALL ensure all behavioral interventions frame recommendations as suggestions rather than mandates, preserving trader agency to override recommendations when they have context the system lacks."

---

## 5. Specific Recommendations by Requirement

### FR 3.0 - Discipline Score

| Current | Issue | Recommendation |
|---------|-------|----------------|
| FR 3.2 | "got stopped" as negative indicator | Remove or clarify to only blame context |

### FR 4.0 - Agency Score

| Current | Issue | Recommendation |
|---------|-------|----------------|
| FR 4.2 | "got stopped" is not an agency issue | Remove from list |

### FR 5.0 - Composite Score

| Current | Issue | Recommendation |
|---------|-------|----------------|
| FR 5.1 | No documentation of asymmetry | Add comment explaining why intervention is score-dependent |

### FR 13.0 - Insight Categories

| Current | Issue | Recommendation |
|---------|-------|----------------|
| FR 13.3 | No size escalation detection | Add: "increased position size" as revenge trading indicator |
| Missing | No confirmation bias detection | Add as Tier 3 (requires 10+ trades) |
| Missing | No overconfidence after wins detection | Add as Tier 3 |

### FR 13.8 - Win/Loss Display

| Current | Issue | Recommendation |
|---------|-------|----------------|
| FR 13.8 | Conflicts with FR 8.1 header display | Resolve conflict per Section 3.1 |

### FR 15.0 - Score Display

| Current | Issue | Recommendation |
|---------|-------|----------------|
| FR 15.3 | "-2 to -3" shows "Declining" but -3 triggers tilt warning | Change "At Risk" threshold to -3 to match FR 13.1 |

---

## 6. Questions for Other SMEs

### For AI/NLP SME:

- **FR 2.3** mentions synonym clusters for mapping reactive language. What confidence level can be expected when detecting these patterns in informal trade descriptions? Specifically, can the system reliably distinguish between "I chased the trade" (negative discipline) vs. "I was chased out of the trade" (different meaning)?
- **FR 13.1** requires the system to detect "2+ consecutive trades with negative scores." How will the NLP handle cases where a trade description contains mixed signals (both disciplined and impulsive language)?

### For Data Analytics SME:

- **FR 5.1** uses a rolling 5-trade window. Is there sufficient data at session start (1-4 trades) to generate meaningful insights? Should there be different intervention thresholds for early-session vs. mid-session?
- **FR 7.0** pre-computes aggregates. What is the computational cost of adding larger rolling windows (10-trade, 20-trade) for more robust trend detection?

### For Product Manager:

- The conflict between FR 8.1 (showing W/L ratio in header) and FR 13.8 (hiding it in insights) needs resolution. Which approach aligns better with the product vision of "frictionless" vs. "behaviorally responsible" trading?

---

## 7. Summary

**Strengths:**
- Sound theoretical grounding in behavioral psychology concepts
- Appropriate use of loss aversion, ego depletion, and self-determination frameworks
- Good balance between intervention effectiveness and autonomy preservation
- Thoughtful rate limiting to prevent alarm fatigue

**Critical Issues:**
1. Win/loss display conflict (FR 8.1 vs. FR 13.8)
2. "Got stopped" incorrectly categorized as agency issue
3. Score threshold misalignment between tilt warning and display labels
4. Missing size escalation in revenge trading detection

**Recommended Priority:**
1. Resolve FR 8.1 / FR 13.8 conflict immediately
2. Fix FR 4.2 "got stopped" issue
3. Align FR 15.3 thresholds with FR 13.1
4. Add size escalation to FR 13.3

With these corrections, the behavioral psychology foundation will be strong and evidence-based.
