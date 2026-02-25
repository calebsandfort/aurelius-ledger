# Behavioral Psychology SME Analysis: Aurelius Ledger

## Overview

This analysis addresses the behavioral psychology considerations for the Aurelius Ledger trading journal application. The system aims to provide real-time behavioral feedback to traders during live sessions, which presents unique opportunities and challenges from a behavioral science perspective.

---

## Question 1: Actionable Insight Categories for Mid-Session Trading

**Question:** What insight categories are most actionable for a trader mid-session? Suggestions to consider: setup consistency, discipline trend, risk of tilt based on score trajectory, patterns in winning vs. losing trade descriptions.

### Expert Analysis

From a behavioral psychology standpoint, mid-session insights must balance **actionability** with **cognitive load management**. A trader in a live session operates under high cognitive load and emotional arousal, making overly complex or numerous data points counterproductive. The following framework organizes insights by priority and timing.

### Recommended Insight Categories (Priority-Ordered)

#### 1. Tilt Risk Indicator (Highest Priority)

**Behavioral Basis:** The **availability heuristic** and **loss aversion** make it difficult for traders to objectively assess their emotional state mid-session. Research in trading psychology (including work by Dr. Van Tharp and Dr. Brett Steenbarger) demonstrates that after 2-3 consecutive losses, traders are significantly more likely to make impulsive decisions.

**Implementation Approach:**
- Trigger alert when discipline_score or agency_score drops below -1 in a single trade, OR
- Flag when 2+ consecutive trades have negative cumulative scores
- Provide specific, non-judgmental language: "Your recent trades show patterns of reactive decision-making. Consider taking a 5-minute break before the next entry."

**Why This Works:** This aligns with **implementation intentions** research (Gollwitzer) — giving the trader a specific action ("take a break") increases the likelihood of behavioral correction.

#### 2. Discipline/Agency Trend Direction (High Priority)

**Behavioral Basis:** The **status quo bias** makes it easy for traders to continue patterns without recognition. A simple trend indicator (improving, declining, stable) provides the metacognitive awareness crucial for self-regulation.

**Implementation Approach:**
- Compare rolling average of last 3 discipline scores vs. previous 3
- Visual indicator: upward arrow (improving), downward arrow (declining), horizontal line (stable)
- Avoid numerical scores in this view — traders need direction, not math

**Why This Works:** This leverages **feedback干预** (feedback intervention) theory — specific, timely, and task-relevant feedback improves performance more than general feedback.

#### 3. Setup Consistency Pattern (Medium Priority)

**Behavioral Basis:** **Confirmation bias** causes traders to remember wins and forget losses, particularly when using inconsistent setups. Highlighting setup-outcome patterns counteracts this bias.

**Implementation Approach:**
- Track which setups (extracted from setup_description) correlate with wins vs. losses
- After 5+ trades, surface: "Your [setup name] entries are winning at [X]% vs. [Y]% overall"
- This allows traders to identify which setups to prioritize or avoid

**Why This Works:** This provides **outcome-independent learning** — even a losing trader can learn which decisions were structurally sound vs. lucky.

#### 4. P&L-Behavior Correlation (Lower Priority, Later Phase)

**Behavioral Basis:** The **illusion of control** and **self-attribution bias** lead traders to credit skill for wins and blame luck for losses. Showing the relationship between behavioral scores and P&L creates accountability.

**Note:** This should NOT be surfaced mid-session (creates anchoring). Best reserved for post-session review.

### Insights That Should NOT Be Included Mid-Session

- **Win/Loss ratio** — Creates loss aversion-driven decision making
- **Total P&L for the session** — Anchoring effect on remaining trades
- **Comparison to historical performance** — Creates pressure, not improvement
- **Generic motivational statements** — Lack specificity, reduce trust in the system

### Phased Implementation Recommendation

**Phase 1 (Initial Launch):**
- Tilt risk indicator (simple threshold-based)
- Discipline/Agency trend direction

**Phase 2 (After sufficient data exists):**
- Setup consistency patterns
- Win/loss breakdown by discipline score

### Theoretical Frameworks Applied

1. **Fogg Behavior Model (BJ Fogg):** Insights must increase motivation, ability, or trigger at the right moment. Tilt alerts serve as effective triggers when paired with specific action prompts.

2. **Self-Determination Theory (Deci & Ryan):** Insights should support autonomy (not prescriptive), competence (actionable guidance), and relatedness (non-judgmental language).

3. **Feedback Intervention Theory (Kluger & DeNisi):** Insights must be specific, timely, and task-relevant to avoid diverting attention from the primary task (trading).

---

## Questions for Other SMEs

### For AI/NLP SME [SME:AIWorkflow]

1. **How should the insights agent handle contradictory signals?** For example, when discipline_score is positive but agency_score is negative, how should the natural language insight weight and present these conflicting indicators?

2. **What is the optimal context window for the insights generation?** Should it receive raw trade records, aggregated session statistics, or both? What are the trade-offs in terms of LLM token costs vs. insight quality?

3. **How should the system handle the timing of insight generation?** Should insights be generated synchronously (blocking trade entry) or asynchronously (generated in background)? What are the behavioral implications of each approach?

4. **What prompt structure would maintain consistency in behavioral score interpretation** across different trade descriptions? For example, how should the agent handle descriptions that use different vocabulary to express similar concepts (e.g., "chased price" vs. "fomo'd in" vs. "got greedy")?

### For DataScientist SME [SME:DataScientist]

1. **How should the dashboard visualize score trajectories** to make trends immediately apparent without requiring numerical literacy? What chart types and visual encodings would be most effective?

2. **What aggregation functions and time windows** are appropriate for the "trend direction" calculation? Should we use simple moving averages, exponential moving averages, or linear regression slopes?

3. **How should we handle the visualization of the "tilt risk indicator"** to ensure it catches attention without creating alarm fatigue? What color coding and placement strategies would be most effective?

4. **What is the minimum number of trades needed** before generating setup consistency insights? How should we communicate confidence levels to the trader?

---

## Summary of Behavioral Requirements

Based on this analysis, the following behavioral requirements should be incorporated:

1. **FR-B1:** The system shall provide a tilt risk indicator when 2+ consecutive trades have negative cumulative behavioral scores.

2. **FR-B2:** The system shall display discipline and agency trend direction (improving/declining/stable) using non-numerical visual indicators.

3. **FR-B3:** Insights shall use non-judgmental, specific language that includes actionable recommendations.

4. **FR-B4:** The system shall NOT display win/loss ratio or total session P&L in the mid-session insights panel.

5. **NFR-B1:** Insight generation shall complete within 2 seconds to maintain the frictionless workflow requirement.

6. **NFR-B2:** The dashboard shall require no more than 2 seconds of attention to assess current session state (per success criteria).
