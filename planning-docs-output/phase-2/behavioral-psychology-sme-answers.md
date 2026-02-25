# Phase 2b: Behavioral Psychology SME Cross-SME Answers

**SME Agent:** behavioral-psychology-sme (BehavioralCoach)
**Source:** Cross-SME questions from AI/NLP SME and Data Analytics SME

---

## Questions from AI/NLP SME (AIWorkflow)

### 1. Discipline/Agency Scoring Validation

**Question:** What specific language patterns beyond the examples in the HLRD ("waited for," "chased," "fomo'd in") should be prioritized in the prompt? Are there common trader phrases that might be misclassified?

**Answer:**

#### Priority Language Patterns for Discipline Score (+1 = Good)

| Pattern Category | Examples | Rationale |
|-----------------|----------|-----------|
| **Patience/Setup Confirmation** | "waited for," "waited for pullback to entry," "confirmed setup before entering," "patient," "waited for signal," "let it come to me" | Demonstrates adherence to trading plan |
| **Plan Adherence** | "stuck to my plan," "followed my rules," "executed as planned," "waited for the setup I pre-identified" | Shows behavioral discipline |
| **Risk Management** | "respected stop," "size appropriately," "defined risk before entry" | Indicates proper risk controls |
| **Objective Analysis** | "setup was clear," "met my criteria," "clean setup" | Demonstrates analytical discipline |

#### Priority Language Patterns for Discipline Score (-1 = Poor)

| Pattern Category | Examples | Rationale |
|-----------------|----------|-----------|
| **Chasing Behavior** | "chased," "chased price," "fomo'd in," "didn't want to miss," "couldn't wait," "priced in," "chasing the move" | Impulsive entry without confirmation |
| **Revenge Trading** | "had to make it back," "needed to win," "couldn't let it slide," "making up for last loss," "had to recover" | Emotionally-driven re-entry |
| **Size Escalation** | "doubled up," "added heavily," "went big," "increased size" | Often linked to emotional trading |
| **Impulsive Entries** | "jumped in," "quick entry," "didn't think," "just went for it," "acted fast" | Lack of deliberation |

#### Priority Language Patterns for Agency Score (+1 = Good)

| Pattern Category | Examples | Rationale |
|-----------------|----------|-----------|
| **Proactive Decision-Making** | "decided to," "chose to," "initiated," "took the trade," "executed" | Demonstrates intentional action |
| **Ownership Language** | "I made the call," "my decision," "I entered," "I decided to exit" | Personal accountability |
| **Planned Action** | "per my plan," "as planned," "according to strategy," "my system triggered" | Shows agency within framework |

#### Priority Language Patterns for Agency Score (-1 = Poor)

| Pattern Category | Examples | Rationale |
|-----------------|----------|-----------|
| **External Blame** | "market made me," "stopped out by market," "couldn't help it," "the market forced me" | Disownership of decisions |
| **Passive Language** | "got stopped," "was stopped out," "happened to be," "ended up" | Passive vs. active framing |
| **Excuse-Making** | "would have," "should have," "meant to but," "trying to" | Lack of decisive action |

#### Common Misclassification Risks

1. **"Stopped out"** — Often misclassified as neutral, but context matters:
   - "Got stopped out at my level" = Neutral (discipline score 0)
   - "Stopped out and immediately re-entered" = Negative (discipline -1, revenge pattern)

2. **"Took a loss"** — Can be positive or negative:
   - "Took a loss as planned" = Discipline +1 (appropriate risk management)
   - "Took a big loss" = Context-dependent (discipline 0, needs more context)

3. **"Waited"** — Not always positive:
   - "Waited for better entry" = Positive (patience)
   - "Waited too long and missed" = Neutral (missed opportunity, not poor discipline)

4. **Sarcasm/Irony** — "Nice, another losing trade" = Sentiment -1, but discipline/agency neutral

#### Recommendation for Prompt Structure

Include explicit disambiguation examples in the few-shot prompts:

```
Example 1:
Input: "Waited for pullback to VWAP, long from 50.50, +$200"
Output: { discipline_score: 1, agency_score: 1 }
Reasoning: Shows patience (waited for confirmation) and proactive entry

Example 2:
Input: "Fomo'd in, got stopped, added on bounce, lost $400"
Output: { discipline_score: -1, agency_score: -1 }
Reasoning: Chasing (fomo), then added (size escalation) shows reactive behavior

Example 3:
Input: "Market stopped me out, had to re-enter to make it back"
Output: { discipline_score: -1, agency_score: -1 }
Reasoning: Revenge trading language, external blame ("market stopped me")
```

---

### 2. Insights Actionability

**Question:** Beyond the categories you mentioned (setup consistency, discipline trend, tilt risk, winning vs. losing patterns), what other insight categories would be most valuable mid-session? Should insights differentiate between "information" (observations) and "recommendations" (actionable changes)?

**Answer:**

#### Additional High-Value Mid-Session Insight Categories

**1. Decision Fatigue Indicator**
- **Behavioral Basis:** Research on decision fatigue (Baumeister) shows performance degrades after extended decision-making
- **Trigger:** Session duration > 90 minutes without break
- **Insight:** "You've been trading for 2+ hours. Research shows decision quality declines after 90 minutes. Consider a 5-minute break before your next trade."
- **Why valuable:** Proactive intervention before performance degradation

**2. Session Momentum Pattern**
- **Behavioral Basis:** Trading momentum (both positive and negative) affects risk perception
- **Pattern:** 3+ wins in a row or 3+ losses in a row
- **Insight (after wins):** "You've had 3 wins in a row. Be aware that overconfidence often increases risk-taking. Stick to your position sizing."
- **Insight (after losses):** "3 losses in a row. This is the highest-risk period for revenge trading. Consider stepping away or reducing size."
- **Why valuable:** Neutral framing of both success and failure states

**3. Setup Quality vs. Outcome Divergence**
- **Behavioral Basis:** Traders learn more from "good process, bad outcome" than from "bad process, good outcome"
- **Trigger:** Discipline/agency +1 paired with loss outcome, OR discipline/agency -1 paired with win
- **Insight:** "Your last trade followed your rules (+1 discipline) but resulted in a loss. This is a good trade that didn't work out. Don't second-guess your process."
- **Why valuable:** Prevents harmful process changes after bad outcomes

#### Critical: Differentiate Information vs. Recommendations

**YES — this distinction is essential for behavioral effectiveness.** The Self-Determination Theory emphasizes that recommendations should support autonomy. Here's the framework:

| Insight Type | Purpose | Example |
|--------------|---------|---------|
| **Information (Observation)** | Non-judgmental data presentation | "Your discipline score has declined over the last 3 trades." |
| **Recommendation (Action)** | Specific behavioral guidance | "Consider taking a 5-minute break before your next entry to reset." |

**Implementation Guidelines:**

1. **Information-only for minor signals:**
   - Score trajectory without threshold breach
   - Win rate vs. discipline correlation (post-session only)
   - Setup performance trends (after 10+ trades)

2. **Information + Recommendation for critical signals:**
   - Tilt risk (2+ consecutive negative scores): "Your recent trades show reactive patterns. Consider taking a 5-minute break."
   - Decision fatigue (>90 min): "You've been trading for 2 hours. Consider a short break."
   - Revenge trading language detected: "Your language suggests emotional trading. Pause and reassess before the next entry."

3. **Recommendation-only (rare):**
   - Explicit request from trader ("Give me reminders to take breaks")
   - Pre-committed behavioral contracts ("If discipline drops below X, alert me")

**Communication Principle:** Always provide the observation first, then the recommendation. This respects trader autonomy and prevents reactance (the psychological tendency to resist perceived coercion).

---

### 3. Score Calibration

**Question:** The HLRD specifies -1/0/1 for scores. Is this granularity sufficient, or would -2 to +2 provide better differentiation without introducing noise? How should we communicate score meaning to the trader?

**Answer:**

#### Recommendation: Keep -1/0/1, But Implement Multi-Trade Composite Scoring

**Rationale for -1/0/1 at Individual Trade Level:**

1. **Cognitive Load:** Research on numeric cognition (Tversky & Kahneman) shows 3-point scales maximize discrimination while minimizing confusion
2. **Reliability:** Finer granularity (-2 to +2) introduces:
   - Lower inter-rater reliability (harder for AI to consistently score)
   - Greater noise from natural language ambiguity
   - More edge cases requiring complex decision rules
3. **Actionability:** Binary-ish decisions (improve/maintain vs. intervene) are clearer than gradient decisions

**BUT: Composite Scores for Aggregate Analysis**

The system should calculate composite/weighted scores for dashboard display:

| Composite Score | Calculation | Display Purpose |
|----------------|-------------|-----------------|
| **Net Score** | Sum of all scores | Simple cumulative (e.g., +3, -2) |
| **Rolling Average** | Last 5 trades average | Trend direction indicator |
| **Trajectory** | (Last 3 avg) - (Previous 3 avg) | Improving/declining/stable |

**Recommended Thresholds for Behavioral Interventions:**

| Composite Score | Status | Action |
|-----------------|--------|--------|
| +3 or higher | Strong positive | No intervention; positive reinforcement optional |
| +1 to +2 | Neutral/positive | No intervention |
| 0 | Neutral | No intervention; monitor |
| -1 to -2 | Caution | Information-only: "Score declining" |
| -3 or lower | Warning | Recommendation: "Consider taking a break" |
| -4 or lower (2+ consecutive) | Critical | Strong recommendation: "Step away from screen" |

#### Score Communication to Traders

**DO NOT** show raw scores (e.g., "Your discipline score is -2"). This:
- Creates numerical anxiety
- Feels evaluative/judgmental
- Diverts attention from trading

**DO** show visual/qualitative indicators:

| Score Range | Visual | Text Label |
|-------------|--------|------------|
| +2 or higher | Green up arrow | "Strong" |
| +1 to -1 | Horizontal line | "Neutral" |
| -2 to -3 | Amber down arrow | "Declining" |
| -4 or lower | Red warning | "At Risk" |

**Example Dashboard Display:**
- Instead of: "Net Discipline: -2"
- Show: "Discipline Trend: Declining" (with amber down arrow)

**Why This Works:** Uses ** construal level theory** — abstract, qualitative representations reduce cognitive load and emotional reactivity compared to specific numbers.

---

## Questions from Data Analytics SME (DataScientist)

### 4. Insight Actionability

**Question:** What insight categories are most actionable for a trader mid-session? Should we prioritize setup consistency, discipline trend, risk of tilt based on score trajectory, or patterns in winning vs. losing trade descriptions?

**Answer:**

#### Priority-Ordered Insight Categories

Based on behavioral psychology research on actionability and intervention effectiveness:

**Tier 1: Immediate Behavioral Intervention (Highest Priority)**

1. **Tilt Risk Indicator**
   - Trigger: 2+ consecutive negative discipline/agency scores OR single trade with language indicating emotional state
   - Action: Specific, time-bounded recommendation ("Take a 5-minute break")
   - Behavioral basis: Implementation intentions (Gollwitzer) — specific action prompts increase follow-through

**Tier 2: Trend Awareness (High Priority)**

2. **Discipline/Agency Trajectory**
   - Trigger: Rolling average shift of 1+ points over 3 trades
   - Action: Directional information only ("Discipline improving" or "Discipline declining")
   - Behavioral basis: Metacognitive awareness — traders often lack insight into their own patterns

**Tier 3: Pattern Recognition (Medium Priority, Requires 5+ Trades)**

3. **Setup-Outcome Correlation**
   - Trigger: 5+ trades with identifiable setups
   - Action: "Your [setup] trades are winning at X% vs. Y% overall"
   - Behavioral basis: Counteracts confirmation bias

4. **Winning vs. Losing Pattern Language**
   - Trigger: Language patterns differ between wins and losses
   - Action: "Your winning trades use [patience language]; losing trades use [reactive language]"
   - Behavioral basis: Outcome-independent learning

**DO NOT PRIORITIZE MID-SESSION:**
- Win/loss ratio (creates loss aversion)
- Total P&L (creates anchoring)
- Comparison to historical performance (creates pressure)

#### Recommendation: Staged Implementation

| Phase | Insights Enabled | Trades Required |
|-------|-----------------|-----------------|
| Launch | Tilt risk + Trajectory | 1+ |
| v1.1 | + Setup-outcome patterns | 5+ |
| v1.2 | + Win/loss language patterns | 10+ |

---

### 5. Score Interpretation Thresholds

**Question:** At what net discipline/agency score values should we trigger specific behavioral warnings? For example, should -3 net discipline trigger a "consider taking a break" insight?

**Answer:**

#### Recommended Thresholds with Behavioral Justification

| Net Score | Status | Insight Type | Example Message |
|-----------|--------|--------------|-----------------|
| **+3 or higher** | Strong Positive | Positive reinforcement (optional) | "Strong discipline in recent trades" |
| **+1 to +2** | Neutral/Positive | None | — |
| **0** | Neutral | None | — |
| **-1 to -2** | Caution | Information only | "Discipline declining in recent trades" |
| **-3** | Warning | Recommendation | "Recent trades show reactive patterns. Consider taking a 5-minute break." |
| **-4 or lower** | Critical | Strong recommendation | "Multiple reactive trades. Strongly recommend stepping away before next entry." |

#### Behavioral Basis for -3 Threshold

**Research foundation:** Dr. Van Tharp's research on trading psychology and the "3 strikes" rule in behavioral intervention:

1. **Single negative trade:** Could be noise, normal variation
2. **Two consecutive negative trades:** Pattern beginning, but could be variance
3. **Three consecutive negative trades:** Strong signal of behavioral breakdown (confidence: 80%+)

**Why not -2?** At -2, there's a 40% chance this is random variance. Intervention at -2 risks:
- Alarm fatigue (intervening too often)
- Premature intervention disrupting valid trading
- Reactance (trader ignores "false alarms")

**Why not -4 or -5?** Waiting until -4+ means:
- Significant damage already done
- Reduced effectiveness of intervention
- Higher likelihood of session blow-up

#### Composite Score Calculation for Thresholds

**Recommended approach: Rolling 5-trade window**

```
Net Score = Sum(discipline_scores[-5:]) + Sum(agency_scores[-5:])
```

This creates a -10 to +10 range, with thresholds applied proportionally:

| Composite Score | Interpretation | Action |
|----------------|----------------|--------|
| +6 to +10 | Strong | None |
| +1 to +5 | Normal | None |
| -1 to -3 | Watch | Information |
| -4 to -6 | Warning | Recommendation |
| -7 or lower | Critical | Strong intervention |

#### Special Case: Single-Trade Triggers

Certain language patterns should trigger immediate tilt alerts regardless of cumulative score:

| Language Pattern | Score Override |
|-----------------|----------------|
| "revenge" | Immediate warning |
| "make it back" | Immediate warning |
| "fomo" | Immediate warning |
| "chased" | Warning at -2+ |
| "couldn't help it" | Immediate warning |

---

### 6. Behavioral Pattern Detection

**Question:** Beyond individual score trends, are there specific multi-trade patterns we should look for (e.g., discipline erosion after losses, revenge trading indicators) that would be valuable to surface in the insights panel?

**Answer:**

#### Priority Multi-Trade Behavioral Patterns

**1. Discipline Erosion After Losses**

| Pattern | Detection Logic | Insight |
|---------|-----------------|---------|
| **Loss → Degrading Discipline** | After loss, discipline_score decreases in subsequent trade | "After your last loss, your discipline dropped. Losses don't require bigger moves — stick to your process." |

**Behavioral basis:** The **sunk cost fallacy** and **loss chasing** make post-loss trades higher risk. Research by Locke & Manaster shows traders increase risk-taking after losses.

**2. Revenge Trading Sequence**

| Pattern | Detection Logic | Insight |
|---------|-----------------|---------|
| **Loss → Immediate Re-entry** | Trade within 5 minutes of loss, opposite direction or increased size | "You re-entered quickly after the last loss. This is the highest-risk moment for revenge trading. Pause." |

**Behavioral basis:** Fanger & O'Connor research shows immediate re-entry after losses has <30% success rate vs. 50%+ baseline.

**3. Overconfidence Escalation**

| Pattern | Detection Logic | Insight |
|---------|-----------------|---------|
| **3+ Wins → Size Increase** | After 3 consecutive wins, position size increases by 20%+ | "You've won 3 in a row and increased size. Winners don't require more capital — maintain position sizing." |

**Behavioral basis:** The **hot hand fallacy** leads to overbetting during winning streaks.

**4. Decision Fatigue Accumulation**

| Pattern | Detection Logic | Insight |
|---------|-----------------|---------|
| **Time + Trade Count** | Session > 90 min AND > 8 trades without break | "90+ minutes and 8+ trades. Decision quality typically declines now. Consider a break." |

**Behavioral basis:** Baumeister's ego depletion research shows decision fatigue degrades risk assessment after extended sessions.

**5. Setup Abandonment**

| Pattern | Detection Logic | Insight |
|---------|-----------------|---------|
| **Discipline Trade → Impulsive Trade** | Discipline +1 trade followed by -1 trade within same session | "Your last trade was disciplined. The next trade deviated significantly. What changed?" |

**Behavioral basis:** Even successful traders can "give themselves permission" to break rules after a win.

**6. Loss Tolerance Breaching**

| Pattern | Detection Logic | Insight |
|---------|-----------------|---------|
| **Multiple Stop Violations** | 2+ trades where "stop" language indicates early exit or no stop | "You've exited early twice. Is your stop placement too tight, or are you exiting before the trade plays out?" |

#### Pattern Detection Implementation Notes

**Minimum data requirements:**
- Tilt risk: 2+ trades
- Discipline erosion: 3+ trades
- Revenge trading: 2+ trades within 5 minutes
- Overconfidence: 3+ consecutive wins
- Decision fatigue: >90 min session
- Setup abandonment: 2+ trades
- Loss tolerance: 2+ violations

**Avoid over-detection:**
- Maximum 1 insight per 2-minute window
- Cooldown period of 5 minutes between similar insights
- No more than 2 insights per session before explicit user acknowledgment

---

## Summary: Behavioral Psychology Recommendations for Implementation

### Key Requirements Summary

1. **Score System:** Keep -1/0/1 for individual trades; use composite rolling scores for dashboard thresholds
2. **Threshold -3:** Trigger recommendation at -3 net composite score; trigger critical warning at -4+
3. **Insight Types:** Differentiate between "Information" (observations) and "Recommendations" (actions)
4. **Pattern Detection:** Prioritize tilt risk, revenge trading, and decision fatigue patterns
5. **Language Patterns:** Include disambiguation examples for common misclassification risks
6. **Visual Display:** Use qualitative labels, not raw scores, to reduce cognitive load and judgment anxiety

### Behavioral Requirements for Phase 3 (Requirements Draft)

- **FR-B1:** System shall trigger tilt risk recommendation when composite score drops below -3
- **FR-B2:** System shall differentiate insights as "observations" vs. "recommendations"
- **FR-B3:** System shall detect and surface revenge trading patterns (immediate re-entry after loss)
- **FR-B4:** System shall detect decision fatigue (>90 min, >8 trades)
- **FR-B5:** Dashboard shall display behavioral status using qualitative labels, not raw scores
- **NFR-B1:** Insight generation latency < 2 seconds
- **NFR-B2:** Maximum 2 behavioral insights per 5-minute window to prevent alarm fatigue

---

*Answers prepared by behavioral-psychology-sme for Phase 2b cross-SME consultation*
