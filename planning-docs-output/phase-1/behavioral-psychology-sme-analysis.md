# Behavioral Psychology SME Analysis - Phase 1

## Executive Summary

This analysis examines the Aurelius Ledger requirements from a behavioral psychology perspective, focusing on habit formation, cognitive bias mitigation, intervention design, and trading psychology. The system aims to support traders in real-time behavioral self-regulation during live trading sessions.

---

## Question 1: Actionable Insight Categories for Mid-Session Traders

**Question:** What insight categories are most actionable for a trader mid-session? Consider: setup consistency, discipline trend, risk of tilt based on score trajectory, patterns in winning vs. losing trade descriptions.

### Direct Answer

Based on behavioral science research in habit formation, self-regulation, and trading psychology, the following insight categories are ranked by actionability for mid-session traders:

#### Tier 1: High-Impact, Immediately Actionable

1. **Discipline Trajectory Alert**
   - Most critical insight category. When discipline scores trend negative over 2-3 consecutive trades, this signals the trader is entering a reactive state.
   - **Behavioral mechanism:** Loss of self-regulation follows a predictable pattern (see Baumeister's ego depletion research). Early detection allows intervention before full tilt.
   - **Recommendation:** Trigger visual alert when running discipline score drops below session average or shows 2+ consecutive -1 scores.

2. **Setup Adherence Pattern**
   - Compares described setups against the trader's stated trading plan (if available) or against patterns in their own successful trades.
   - **Behavioral mechanism:** Implementation intentions (Gollwitzer) — traders who deviate from their planned setups have lower success rates.
   - **Recommendation:** Display "setup consistency" metric showing what percentage of trades followed the trader's typical pattern.

3. **Win/Loss Sequence Context**
   - Identifies dangerous patterns: 3+ losses in a row, or a win followed immediately by overconfidence.
   - **Behavioral mechanism:** Gambler's fallacy and revenge trading are triggered by specific loss sequences. Knowing "I'm on a 3-loss streak" enables conscious intervention.
   - **Recommendation:** Display current streak status prominently (wins/losses) and flag when entering psychologically dangerous territory.

#### Tier 2: Moderately Actionable

4. **Agency Score Trend**
   - Tracks intentionality: are trades being executed with plan or reactively?
   - **Behavioral mechanism:** Low agency scores often precede discipline failures. This is a leading indicator.
   - **Recommendation:** Show as secondary chart alongside discipline. Correlate with outcomes to build personal awareness.

5. **Session P&L vs. Behavioral State**
   - Shows whether the trader is "playing with house money" (overconfidence risk) or "trying to make back losses" (revenge trading risk).
   - **Behavioral mechanism:** Mental accounting biases affect risk tolerance. Positive P&L can lead to increased risk-taking; negative P&L can trigger loss-chasing.
   - **Recommendation:** Provide gentle prompts when P&L crosses thresholds (e.g., "You're up $500 — reminder: stay with your plan size").

#### Tier 3: Informational/Retrospective

6. **Time-Based Fatigue Indicators**
   - Tracks performance degradation over session duration.
   - **Behavioral mechanism:** Cognitive fatigue reduces decision quality over time (Wills & Holden).
   - **Recommendation:** After 90+ minutes, suggest taking a break if discipline/agency scores are declining.

7. **Setup-Type Performance Correlation**
   - Breaks down win rate by described setup type.
   - **Behavioral mechanism:** Reinforces learning through outcome feedback (behavioral learning theory).
   - **Recommendation:** Display which setups are working vs. not working today — but only after minimum 5 trades.

---

### Theoretical Frameworks Supporting These Recommendations

**Fogg Behavior Model (B=MAP):**
- The system provides Motivation monitoring (P&L, win streaks) and Ability prompts (setup reminders, fatigue warnings)
- The Behavior trigger is the insight itself — making the invisible state visible

**Transtheoretical Model (Stages of Change):**
- Mid-session traders are in the "Action" stage
- Insights should support maintenance of positive behaviors and prompt self-correction when relapsing

**Self-Determination Theory:**
- Agency score directly maps to autonomy — are they acting volitionally?
- Insights should support competence (setup consistency) and relatedness (none applicable here)

**Habit Loop (Cue-Routine-Reward):**
- The persistent input is the "cue" after each trade
- The AI extraction and scoring provides immediate "reward" (structured feedback)
- The dashboard provides the "routine" of reflection

---

### Implementation Considerations

1. **Timing of Insights**
   - Generate insights after EACH trade, but weight recent trades more heavily
   - Early session (first 3 trades): Focus on setup consistency and initial trajectory
   - Mid session (4-10 trades): Add tilt risk alerts and sequence warnings
   - Late session (10+ trades): Add fatigue indicators

2. **Presentation Format**
   - Maximum 3 insights displayed at once to avoid cognitive overload
   - Use traffic-light color coding (green/yellow/red) for quick scanning during live trading
   - Insights should be 1-2 sentences max — no paragraphs

3. **Calibration Period**
   - The first 5-10 sessions should include calibration prompts ("Did this feel accurate?")
   - Individual differences in writing style affect score accuracy
   - Allow trader to manually adjust scores with feedback loop

4. **Calm Technology Principles**
   - Insights should be peripheral, not demanding attention
   - No push notifications or interrupts during live trading
   - Sound cues only if explicitly enabled (and disabled by default)

---

### Potential Pitfalls and Risks

1. **Over-Monitoring Bias**
   - Constant score-watching can become a compulsion
   - Mitigation: Add optional "focus mode" that hides scores temporarily

2. **Self-Fulfilling Prophecy**
   - Negative insights may cause the very behavior they warn about
   - Mitigation: Frame insights neutrally ("Discipline score trending down" not "You're losing control")

3. **Score Gaming**
   - Traders may write descriptions to manipulate scores rather than reflect honestly
   - Mitigation: Make scoring transparent after session ends, not during

4. **Analysis Paralysis**
   - Too many insights cause decision fatigue
   - Mitigation: Default to showing only top 1-2 insights, expand on demand

5. **Negative Reinforcement Loop**
   - Scoring itself can become punishing, leading to avoidance
   - Mitigation: Emphasize learning over judgment; scores are data, not criticism

---

## Domain-Specific Recommendations

### Behavioral Requirements (Proposed)

Based on my analysis, I recommend adding the following behavioral requirements to ensure the system supports healthy trading psychology:

**BR-1: Insight Fading**
- Insights should fade from prominence as the session progresses without issues
- Only surface alerts when patterns emerge, not for every trade
- Rationale: Reduces monitoring burden and prevents compulsive checking

**BR-2: Positive Reinforcement Bias**
- At least 40% of insights should highlight positive patterns when present
- System should not be perceived as "policing" the trader
- Rationale: Sustainable behavior change requires positive reinforcement (Skinner)

**BR-3: Graduated Response**
- Alert intensity should scale with severity of pattern
- Single negative score: No alert (noise)
- 2 consecutive negative scores: Yellow indicator
- 3+ consecutive negative scores or 2+ losses after discipline drop: Soft alert
- Rationale: Prevents alert fatigue and allows self-correction before intervention needed

**BR-4: Session Boundary Insights**
- First insight of session should be encouraging and set neutral expectations
- Last insight of session should summarize without judgment (e.g., "You executed 8 trades with mixed discipline — data for your review")
- Rationale: Primacy and recency effects amplify emotional impact of insights

**BR-5: Anonymous Benchmark Option (Future)**
- Allow trader to compare their session patterns against anonymized aggregate data
- Rationale: Social comparison can motivate, but only when voluntary and anonymized

---

### User Experience Recommendations

1. **Persistent Input Design**
   - Keep input at bottom, always accessible but not intrusive
   - Auto-focus after each submission enables rapid logging
   - Clear confirmation animation on successful write (green flash, not disruptive)

2. **Score Visualization**
   - Use cumulative line charts as specified, but add baseline reference
   - Show "neutral line" at y=0
   - Color-code segments: green for +1 scores, red for -1 scores, gray for 0

3. **Insight Panel Placement**
   - Right side or collapsible bottom panel
   - Collapsed by default after session establishes baseline
   - Expand button clearly visible but not attention-grabbing

4. **Error Handling for Behavioral Impact**
   - If AI extraction fails, show graceful message: "Couldn't parse that — add it manually when you have a moment"
   - Do not make trader feel their input was "wrong" — the system adapts, not them

---

## Questions for Other SMEs

### For AI/NLP SME:

1. **Prompt Calibration for Behavioral Scores:**
   - How should we structure the system prompt to ensure discipline and agency scoring is consistent across different writing styles?
   - Should we include few-shot examples of trades with known outcomes to calibrate the LLM's scoring behavior?
   - What retry mechanism should be used when scores come back as 0 repeatedly — is this a signal that the prompt needs adjustment?

2. **Insight Generation Constraints:**
   - What is the optimal token budget for the insights generation to ensure it completes within the 3-second SLA?
   - Should insights be generated asynchronously after the trade is committed to avoid blocking the UI?

3. **Score Validation:**
   - Should there be a confidence score alongside discipline/agency scores? If the LLM is uncertain, should we default to 0 or surface that ambiguity?

### For Data Analytics SME:

1. **Real-Time Aggregation:**
   - What database queries will efficiently compute running aggregates (discipline sum, P&L, win/loss count) after each trade insertion?
   - Should we use materialized views or computed columns for these aggregates?

2. **Visual Design Standards:**
   - What chart library/approach do you recommend for the time-series charts given the Next.js + Shadcn/ui + Tailwind stack?
   - How should we handle the "no data" state for early-session (1-2 trades) where trend analysis isn't meaningful yet?

3. **Data Retention:**
   - For Phase 1, how long should trade data be retained locally before considering archival?
   - Should we implement any data compression for older sessions (e.g., rolling up to daily summaries after 30 days)?

---

## Conclusion

The Aurelius Ledger has strong potential to support real-time behavioral self-regulation for traders. The key insight categories I recommend prioritizing are:

1. Discipline trajectory (most critical for tilt prevention)
2. Setup adherence patterns
3. Win/loss sequence context

The system should be designed to support calm technology principles — making invisible patterns visible without creating new compulsive behaviors. The scoring system, while powerful, must be presented carefully to avoid becoming punitive or gaming-prone.

The behavioral success of this system will depend less on the sophistication of the AI and more on the UX choices around how insights are presented, when they appear, and how they're framed.

---

*Analysis prepared by: Behavioral Psychology SME*
*Date: 2026-03-02*
*Framework: Fogg Behavior Model, Transtheoretical Model, Self-Determination Theory, Habit Loop Theory*
