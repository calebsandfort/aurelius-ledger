# Behavioral Psychology SME Answers - Phase 2

## Overview

This document provides answers to questions from the AI/NLP SME and Data Analytics SME regarding behavioral psychology considerations for the Aurelius Ledger system. Each answer is grounded in established behavioral science research and includes practical implementation recommendations.

---

## From AI/NLP SME

### Question 1: Discipline/Agency Scoring Calibration

**Context:** The AI/NLP analysis proposes a scoring schema (-1, 0, +1) for discipline and agency based on textual analysis of trade descriptions.

**Question:** The current scoring schema (-1, 0, +1) is simple, but are there common trading behaviors that might be misclassified? For example, "scaling out" or "adding to a position" — should these be neutral, positive, or negative signals?

---

#### Answer

**Recommended Scoring for Position Management Behaviors:**

| Behavior | Discipline Score | Agency Score | Rationale |
|----------|-----------------|--------------|-----------|
| Scaling out (partial profit-taking) | +1 | +1 | Demonstrates discipline (taking profits per plan) and agency (intentional position management) |
| Adding to a winning position (pyramiding) | Context-dependent | +1 | Positive agency if following plan; discipline depends on position sizing rules |
| Adding to a losing position (averaging down) | -1 | -1 | Almost always reactive, not part of sound trading plans |
| Stop adjustment (moving stop further) | -1 | -1 | Violates risk management rules; reactive to avoid pain |
| Stop adjustment (trailing stop) | +1 | +1 | Intentional profit protection per plan |
| Time-based exit vs. signal-based exit | Context | +1 if intentional | Agency depends on whether exit was planned |

**Edge Case Handling Recommendations:**

1. **Scaling Out**: Default to **+1 for both scores** unless context suggests otherwise. The act of taking partial profits indicates planning and intentionality.

2. **Adding to Position**: This is the highest-risk behavior to classify. Recommend:
   - If the description includes "added" or "scaled in" without justification: **-1 discipline, -1 agency**
   - If description includes "per my plan" or "as planned": **+1 agency, +1 discipline**
   - If ambiguous: Default to **0** (neutral) with a flag for review

3. **Double Position Size**: If trader mentions doubling position size:
   - After loss: Strong **-1** for both (revenge trading indicator)
   - After win: Context-dependent (overconfidence risk)

4. **Quick Re-entry**: Entering immediately after a stop-out:
   - Within 5 minutes: Likely reactive, score as **-1** discipline
   - After analysis pause: Neutral or positive depending on justification

**Prompt Calibration Recommendation:**

Add specific guidance to the LLM prompt for position management:

```
### Position Management Scoring

For trades involving position changes:
- "scaled out", "took profit off table", "reduced size": +1 discipline, +1 agency
- "added", "bought more", "averaged down": -1 discipline, -1 agency (risky behavior)
- "moved stop", "adjusted stop": -1 unless explicitly part of trading plan
- "trailing stop": +1 (intentional profit protection)
```

---

### Question 2: Insight Actionability

**Context:** The AI/NLP analysis discusses how to generate AI insights from trade data and behavioral scores.

**Question:** What specific behavioral patterns would be most valuable to surface in the AI insights panel? Should the system warn about specific risk factors (e.g., "tilt risk elevated" based on recent loss streak)?

---

#### Answer

**Recommended Insight Categories (Prioritized by Actionability):**

#### Tier 1: Immediate Risk Alerts (Show Always)

1. **Tilt Risk Indicator**
   - Trigger: 2+ consecutive losses AND discipline score -1 on at least one
   - Message: "Two losses in a row — consider stepping back for 5 minutes"
   - Rationale: Research shows revenge trading peaks after 2-3 consecutive losses (Locke & Offenbacker, 1984)

2. **Overconfidence Warning**
   - Trigger: 3+ consecutive wins AND discipline score +1 on all
   - Message: "Three wins in a row — remember to size appropriately"
   - Rationale: Win streaks increase risk-taking (overconfidence bias, Svenson)

3. **Session Fatigue Alert**
   - Trigger: 90+ minutes active AND declining discipline trend
   - Message: "You've been trading for 90+ minutes — decision quality typically declines"
   - Rationale: Cognitive fatigue degrades performance (Wells & Holden)

#### Tier 2: Pattern Recognition (Show After 3+ Trades)

4. **Setup Deviation Alert**
   - Trigger: Trade description doesn't match pattern in winning trades
   - Message: "This setup differs from your winning trades today"
   - Rationale: Implementation intentions research shows deviation from plan reduces success (Gollwitzer)

5. **Discipline Trajectory**
   - Trigger: 3 consecutive discipline scores of -1
   - Message: "Discipline scores trending down — what's driving this?"
   - Rationale: Early intervention before full tilt

6. **Agency Breakdown**
   - Trigger: Agency score -1 without apparent reason
   - Message: "Recent trade felt reactive — what was the trigger?"
   - Rationale: Low agency precedes discipline failures

#### Tier 3: Positive Reinforcement (Show When Present)

7. **Streak Recognition**
   - Trigger: Any 3+ win streak OR 3+ disciplined trades
   - Message: "You're sticking to your plan — keep it up"
   - Rationale: Positive reinforcement sustains behavior (Skinner)

8. **Recovery Pattern**
   - Trigger: Positive discipline after recovering from loss
   - Message: "Good recovery after that loss — maintained discipline"
   - Rationale: Reinforces adaptive coping

**Warning Format Recommendations:**

- **Use conditional framing**: "Your discipline score has dropped" (observed fact) vs. "You're losing control" (judgment)
- **Offer action, not diagnosis**: "Consider a 5-minute break" vs. "You're tilting"
- **Keep under 10 words**: Traders scan, don't read paragraphs
- **Color code by severity**: Green (positive), Yellow (caution), Red (warning) — but use sparingly

---

### Question 3: Score Trajectory Interventions

**Context:** Behavioral psychology expertise is needed to determine appropriate interventions when patterns change.

**Question:** If a trader's discipline score starts positive and trends negative over a session, what interventions or insights would be most helpful? Is a warning appropriate, or would that be counterproductive during active trading?

---

#### Answer

**Intervention Framework: Graduated Response by Severity**

#### Phase 1: Early Detection (2 Consecutive -1 Scores)

**Recommended Action: Passive Observation (No Alert)**

- 2 consecutive -1 discipline scores is within normal variance
- Trader may self-correct without intervention
- System tracks but does not surface message

**Why:** Over-alerting creates "alert fatigue" — the trader learns to ignore warnings

#### Phase 2: Pattern Confirmation (3 Consecutive -1 OR 2+ Losses After Positive Start)

**Recommended Action: Subtle Indicator (Visual, Not Interruptive)**

- Show yellow indicator on discipline chart
- AI insight: "Discipline trending down — stay intentional"
- Do NOT use alert sounds or pop-ups

**Why:** Research on ego depletion (Baumeister) shows early intervention is most effective before full self-regulation failure

#### Phase 3: Risk State (3+ Consecutive Losses OR Clear Revenge Pattern)

**Recommended Action: Soft Prompt (If User Engaged)**

- Trigger ONLY if trader actively checks dashboard (not auto-popup)
- Message: "Three losses in a row. A short break often helps reset."
- Offer but don't insist

**Why:** Forced interventions during active trading can:
- Increase stress (counterproductive)
- Create reactance (trader does opposite)
- Disrupt focus (dangerous during live trading)

#### What NOT To Do During Active Trading

| Intervention | Why It's Counterproductive |
|--------------|---------------------------|
| Push notifications | Interrupts focus, increases stress |
| Large pop-up warnings | Causes shock/panic response |
| "Stop trading" commands | Removes autonomy, triggers reactance |
| Sound alerts | Creates anxiety, disrupts decision-making |
| Block trade entry | Removes control, increases frustration |

**Recommended Approach: Calm Technology**

1. **Passive by default**: Charts and scores update silently
2. **Visual only**: Color changes, subtle indicators
3. **On-demand insight**: Expandable insight panel (collapsed by default after session starts)
4. **Post-session review**: Full analysis available after market closes

**Specific Messages by Trajectory Type:**

| Trajectory | Message (If Any) | When to Show |
|------------|------------------|--------------|
| Start +, now declining | "Recent trades less disciplined than your start" | After 3+ trades, only on expand |
| Consistent negative | "Current streak: X losses" | Post-trade, if requested |
| Recovery after negative | "Good recovery — back on track" | Always OK to show positive |
| Volatile (alternating) | "Discipline fluctuating today" | Post-session summary |

**Key Principle:** The system should make invisible patterns visible WITHOUT creating new stress. The trader should feel supported, not policed.

---

## From Data Analytics SME

### Question 4: Visual Warning Thresholds

**Context:** The data analytics analysis discusses chart design and real-time updates for discipline and agency score visualizations.

**Question:** In the discipline and agency score charts, what time window or trade count threshold should trigger a visual warning (e.g., "tilting" indicator) when negative trends are detected?

---

#### Answer

**Recommended Thresholds for Visual Warnings**

#### Trade Count Thresholds (Primary)

| Metric | Threshold | Warning Type | Visual |
|--------|-----------|--------------|--------|
| Consecutive -1 discipline scores | 2 | None (observation) | No change |
| Consecutive -1 discipline scores | 3 | Yellow indicator | Subtle amber dot on chart |
| Consecutive -1 discipline scores | 4+ | Orange indicator | Pulsing amber, show on expand |
| 2+ losses after positive discipline start | Any | Yellow indicator | Warning stripe |
| Cumulative discipline below -3 | Any | Yellow indicator | Chart line turns amber |

#### Time-Based Thresholds (Secondary)

| Metric | Threshold | Warning Type |
|--------|-----------|--------------|
| Trade frequency < 2 minutes | 3+ rapid trades | Yellow (possible overtrading) |
| Session duration > 90 minutes | + declining scores | Orange (fatigue risk) |
| Time since last break > 60 minutes | + 2+ losses | Yellow (recovery reminder) |

#### Minimum Data Requirements

**Do NOT show warnings for sessions with fewer than 3 trades.**
- With 1-2 trades, there's no statistical pattern to detect
- Early-session warnings create false positives
- Wait for minimum sample size

**Recommended Logic:**

```
function shouldShowWarning(session):
    if session.tradeCount < 3:
        return NONE  # Insufficient data

    consecutiveNegatives = countConsecutiveNegativeDiscipline(session)
    if consecutiveNegatives >= 4:
        return ORANGE
    elif consecutiveNegatives >= 3:
        return YELLOW

    if session.recentLosses >= 2 AND session.startDiscipline > 0:
        return YELLOW

    if session.cumulativeDiscipline < -3:
        return YELLOW

    if session.durationMinutes > 90 AND session.disciplineTrend == DECLINING:
        return ORANGE

    return NONE
```

#### Visual Design for Warnings

1. **Subtle first**: Start with a small amber dot or dot on the chart edge
2. **Escalate only if pattern persists**: 3 consecutive becomes visible indicator
3. **Never red for behavioral warnings**: Red reserved for financial loss thresholds only
4. **Include "why" on hover**: Tooltip explains what triggered the indicator
5. **Fade when resolved**: Once discipline improves, remove warning gradually

---

### Question 5: Behavioral Recommendations in Insights

**Context:** The AI insights panel could include actionable behavioral recommendations.

**Question:** Should the AI insights panel include specific behavioral recommendations (e.g., "take a break"), and if so, what score thresholds should trigger such interventions?

---

#### Answer

**Yes — Include Behavioral Recommendations, But Implement Carefully**

Research supports that specific, actionable recommendations are more effective than general observations (Fogg Behavior Model: specific behavior = specific action).

#### Recommended Score Thresholds for "Take a Break" Intervention

| Condition | Threshold | Recommendation | Confidence |
|-----------|-----------|----------------|------------|
| 3+ consecutive losses | Any | "Consider a short break" | High |
| 3 consecutive -1 discipline | Any | "Your discipline is slipping — step back?" | Medium |
| 4+ trades in < 10 minutes | Any | "High frequency — verify intentionality" | Medium |
| Session > 90 min + declining scores | Any | "90+ minutes — decision quality typically declines" | High |
| Cumulative discipline < -4 | Session | "Today has been rough — consider ending early" | Medium |

#### Message Framing Guidelines

**Use Opt-In Framing:**
- "A short break often helps reset" (research-backed, not命令)
- "Would you like to pause before the next trade?" (offer choice)

**Avoid Command Framing:**
- "Stop trading now" (NO)
- "You need to take a break" (NO — creates reactance)
- "You're tilting" (NEVER — diagnostic language is harmful)

#### When NOT to Recommend Breaks

1. **During active price action**: Trader is focused, break recommendation disrupts flow
2. **Winning streak**: Positive momentum, break may break flow
3. **First 3 trades**: Insufficient data, premature to recommend
4. **Trader explicitly in "focus mode"**: Respect stated intent

#### Alternative Recommendations (Not Just Breaks)

| Situation | Alternative Recommendation |
|-----------|---------------------------|
| Overtrading pattern | "Review your setup criteria before next entry" |
| Revenge trading risk | "Next trade: wait for confirmation before entering" |
| After large loss | "Reset: What's your thesis for the next trade?" |
| Overconfidence (wins) | "Remember your position sizing rules" |
| Fatigue (long session) | "Stretch or hydrate — 2-minute break" |

#### Implementation: User Control

**CRITICAL:** Allow traders to:
1. **Disable behavioral recommendations** entirely (preference setting)
2. **Set sensitivity** (high/medium/low triggers)
3. **Customize messages** (some traders prefer direct language)
4. **Post-session only** (see recommendations in end-of-session summary)

---

### Question 6: Additional Behavioral Metrics

**Context:** The data analytics SME is considering what metrics to visualize beyond discipline and agency scores.

**Question:** Are there other behavioral metrics beyond discipline and agency that would be valuable to visualize on the dashboard? For example, patience (time between trades), sizing consistency, or setup diversity.

---

#### Answer

**Recommended Additional Behavioral Metrics**

#### High Value Metrics (Worth Implementing)

| Metric | How to Measure | Visualization | Value |
|--------|---------------|---------------|-------|
| **Trade Frequency/Patience** | Time between trade submissions | Mini heatmap or intervals | Detects overtrading, impulsive entries |
| **Position Sizing Consistency** | Variance in position size descriptions | Small bar chart or % consistency | Identifies deviation from plan |
| **Setup Diversity** | Number of unique setups described | Pie chart or tag cloud | Shows focus vs. scattered trading |
| **Win/Loss Sequencing** | Pattern of W/L outcomes | Sequence visualization | Reveals streak behavior |
| **Entry Timing** | Time of day distribution | Timeline or clock visualization | Identifies time-of-day patterns |

#### Implementation Recommendations

**1. Trade Frequency (Patience Metric)**

```
Calculation: Minutes between consecutive trade entries
- < 5 minutes: High frequency (potential overtrading)
- 5-15 minutes: Normal
- > 30 minutes: Low frequency (patience or no opportunities)

Visualization: Small sparkline showing inter-trade intervals
Alert: If 3+ trades < 5 minutes apart, show "rapid trading" indicator
```

**2. Position Sizing Consistency**

```
Calculation: Parse position size from descriptions
- "normal size", "standard" = baseline
- "half size", "small" = below baseline
- "double", "big" = above baseline

Visualization:
- Consistency score: % of trades at baseline size
- Alert: If < 50% consistency, show sizing deviation warning
```

**3. Setup Diversity**

```
Calculation: Extract setup types from descriptions
- Group by keywords: "resistance", "breakout", "reversal", "trend", etc.
- Count unique setups per session

Visualization:
- Setup diversity score: Unique setups / Total trades
- High diversity (>5 types): Scattered trading
- Low diversity (1-2 types): Focused trading
```

**4. Win/Loss Sequence**

```
Calculation: Track W/L pattern
- W-W-W: Win streak
- L-L-L: Loss streak
- W-L-W-L: Choppy
- L-W-L-W: Recovery pattern

Visualization: Color-coded sequence bar (green/red segments)
Insight: "You're on a 3-loss streak" = actionable self-awareness
```

#### Metrics to Avoid (Low Value / High Complexity)

| Metric | Why Not Worth It |
|--------|------------------|
| Emotional state (from text) | AI sentiment analysis unreliable for trading context |
| Risk/reward ratio (estimated) | Hard to extract accurately from descriptions |
| Confidence levels (self-reported) | Rarely included in trade descriptions |
| Market condition tagging | Requires external data, complex |

#### Recommended Priority Order

1. **Win/Loss Sequence** — Easiest to implement, highest actionability
2. **Trade Frequency** — Simple time calculation, valuable for overtrading detection
3. **Position Sizing Consistency** — Requires text parsing but important for risk management
4. **Setup Diversity** — More complex NLP, valuable for pattern recognition

---

## Summary

### Key Recommendations

1. **Scoring Calibration**: Position management behaviors (scaling out, adding) should be context-dependent but default to +1 for intentional profit-taking and -1 for reactive position increases

2. **Insight Actionability**: Prioritize tilt warnings, overconfidence alerts, and fatigue indicators — keep messages under 10 words

3. **Score Trajectory Interventions**: Use graduated response — silent observation at 2 consecutive -1, subtle visual at 3, soft prompt only at 4+ or after clear loss streak

4. **Visual Warning Thresholds**: Minimum 3 trades before any warning; escalate from yellow (amber) to orange based on consecutive count

5. **Behavioral Recommendations**: Include "take a break" recommendations at specific thresholds, but frame as offers not commands, and allow user control

6. **Additional Metrics**: Win/loss sequence and trade frequency are highest value additions; position sizing consistency and setup diversity are secondary

---

## Questions for Other SMEs

### For AI/NLP SME

1. **Confidence scoring for behavioral extraction**: Should the LLM provide confidence scores alongside discipline/agency scores? If the text is ambiguous, should we default to 0 or surface the uncertainty?

2. **Insight generation constraints**: What's the optimal token budget to generate behavioral recommendations while staying within the 3-second SLA? Should we limit insight length?

3. **Extraction edge cases**: How should the system handle trades where the description is too brief to score (e.g., just "long" or "short")? Default to 0 or ask for more detail?

### For Data Analytics SME

1. **Chart rendering for new metrics**: If we add win/loss sequence visualization, what's the recommended approach for a compact sequence display that doesn't clutter the dashboard?

2. **Historical comparison**: Should the dashboard show comparison to previous sessions' behavioral metrics (e.g., "your average discipline today is lower than last week")? What's the best visualization for this?

3. **Real-time calculation**: For trade frequency (time between entries), should this be calculated client-side or server-side? What's the performance impact of computing inter-trade intervals on each dashboard refresh?

---

*Answers prepared by: Behavioral Psychology SME*
*Date: 2026-03-02*
*Framework: Fogg Behavior Model, Ego Depletion Theory, Implementation Intentions, Habit Loop, Positive Reinforcement, Reactance Theory*
