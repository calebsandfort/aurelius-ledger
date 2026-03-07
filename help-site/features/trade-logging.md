# Trade Logging

The trade entry box lives at the bottom of your screen. It is always there, fixed in place, so you can log a trade at any time without navigating away from your dashboard.

## How to Log a Trade

1. **Type your trade description** in the text box at the bottom of the screen
2. **Press Enter** or click the "Log Trade" button
3. **The input flashes green** to confirm success
4. **The box clears and refocuses** automatically, ready for your next trade

That is it. No forms, no dropdowns, no friction.

## What to Type

The system understands plain English. Describe what happened in whatever way makes sense to you.

### Good Examples

> "Longed NQ at 17500, hit target at 17600 for +$500"

> "Short ES at 4825, stopped out for -$250"

> "Chased the morning spike, knew it was wrong, lost $300"

> "Waited all morning for the pullback, got it, nice +$600 winner"

> "Scratched the trade, no harm done"

> "Revenge traded after the loss, -$400, not following my plan"

### What the AI Figures Out

The system reads your description and pulls out:

| Field | What It Means |
|-------|---------------|
| Direction | Long or short |
| Outcome | Win, loss, or breakeven |
| P&L | Dollar amount (or approximation) |
| Discipline Score | +1, 0, or -1 based on how you describe the trade |
| Agency Score | +1, 0, or -1 based on whether you sound in control |

You do not need to include all details. The AI is smart enough to understand context.

:::tip Be Honest
The system works best when you are honest in your descriptions. If you chased a trade, say so. If you waited patiently, say that too. The score is for you, not for judgment.
:::

## Understanding the Scores

### Discipline Score

- **+1 (Green):** You waited for your setup, followed your rules, traded your plan
- **0 (Gray):** Neutral — the trade was neither especially disciplined nor undisciplined
- **-1 (Red):** You deviated from your plan — chased, overtraded, ignored your rules

### Agency Score

- **+1 (Green):** You made an intentional decision — you chose to enter, you chose to exit
- **0 (Gray):** Neutral — unclear whether the trade was intentional
- **-1 (Red):** You reacted emotionally — revenge trading, FOMO, fear, frustration

### Confidence Level

Each score comes with a confidence indicator:

- **High confidence:** The AI is sure about the score based on your description
- **Medium confidence:** Reasonable certainty
- **Low confidence:** Not enough information to be sure

If the confidence is low, you might see "insufficient signal" — meaning the description was too vague for the AI to make a solid call. That is fine. Just be more descriptive next time.

## Tips for Better Logging

- **Log between trades.** The best time to log is after you close a trade, while the details are fresh.
- **Be specific about intent.** Say "I waited for the EMA bounce" rather than "took a long." The more context, the better the score.
- **Own your mistakes.** "Chased the move" or "revenge traded" gives the AI useful information. It is not about judging you — it is about showing you your patterns.
- **Describe outcomes you know.** If you are not sure of the exact dollar amount, approximate: "small winner," "decent loss," "about $200 up."

## What Happens After You Submit

1. The trade is added to your session immediately (the charts update right away)
2. The AI processes your description and extracts the details
3. Your P&L chart, discipline chart, and agency chart all update
4. After 5 trades, the Insights panel starts showing AI-generated observations

The whole process takes a second or two. No page reload, no waiting.

## Common Questions

**What if I make a typo?**
Just resubmit. The system processes each submission independently.

**Can I edit a trade after logging it?**
Not in the current version. If you made a mistake, log a correction as a new trade or contact support.

**What if the AI gets the score wrong?**
The scores are starting points, not definitive judgments. Use them as a mirror. If you disagree with a score, it is still useful information — it might tell you something about how you described the trade.

**How long is a "session"?**
A session lasts as long as you are actively trading. If you stop logging trades for more than 30 minutes, the next trade starts a new session.
