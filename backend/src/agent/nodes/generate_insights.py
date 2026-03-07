"""Insights generation node for the Insights Agent.

This module contains the core logic for generating behavioral insights from trading session data.
It implements FR 5.0 - FR 5.5 requirements.
"""
import json
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from typing_extensions import TypedDict

from src.schemas.insights import InsightsResponse, Insight


# =============================================================================
# InsightsAgentState TypedDict
# =============================================================================


class InsightsAgentState(TypedDict):
    """State for the Insights Agent."""

    session_id: str
    trades: List[dict]  # List of trade records
    session_summary: dict  # Aggregated session stats
    insights: Optional[InsightsResponse]
    trade_count: int


# =============================================================================
# Small Session Messages (FR 5.4)
# =============================================================================


def get_small_session_message(trade_count: int) -> str:
    """Get encouraging message based on trade count (FR 5.4.1).

    Args:
        trade_count: Number of trades in the session

    Returns:
        Encouraging message for the current session size
    """
    if trade_count == 0:
        return (
            "Welcome to your trading session! Log your first trade to start "
            "tracking your performance."
        )
    elif trade_count == 1:
        return (
            "Great, you've logged your first trade. Keep going to see patterns emerge."
        )
    elif 2 <= trade_count <= 4:
        return (
            "Early patterns are forming. Continue logging trades for more "
            "meaningful insights."
        )
    elif 5 <= trade_count <= 9:
        return (
            "You're building a good dataset. Behavioral patterns are becoming visible."
        )
    else:
        return ""


def should_generate_ai_insights(trade_count: int) -> bool:
    """Determine if AI insights should be generated (FR 5.4.2).

    Args:
        trade_count: Number of trades in the session

    Returns:
        True if AI insights should be generated, False for encouraging messages only
    """
    return trade_count >= 5


# =============================================================================
# Insight Category Detection Functions (FR 5.5)
# =============================================================================


def detect_tilt_risk(trades: List[Dict[str, Any]]) -> bool:
    """Detect tilt risk: 2+ consecutive losses with discipline -1 (FR 5.5.1).

    Args:
        trades: List of trade records

    Returns:
        True if tilt risk is detected
    """
    if len(trades) < 2:
        return False

    # Check last 2 trades for consecutive losses with discipline -1
    recent_trades = trades[-2:]
    for trade in recent_trades:
        if trade.get("outcome") != "loss":
            return False
        if trade.get("discipline_score", 0) != -1:
            return False
    return True


def detect_overconfidence(trades: List[Dict[str, Any]]) -> bool:
    """Detect overconfidence: 3+ consecutive wins with +1 discipline (FR 5.5.2).

    Args:
        trades: List of trade records

    Returns:
        True if overconfidence is detected
    """
    if len(trades) < 3:
        return False

    # Check last 3 trades for consecutive wins with discipline +1
    recent_trades = trades[-3:]
    for trade in recent_trades:
        if trade.get("outcome") != "win":
            return False
        if trade.get("discipline_score", 0) != 1:
            return False
    return True


def detect_session_fatigue(trades: List[Dict[str, Any]]) -> bool:
    """Detect session fatigue: 90+ minutes with declining discipline (FR 5.5.3).

    Args:
        trades: List of trade records with timestamps

    Returns:
        True if session fatigue is detected
    """
    if len(trades) < 2:
        return False

    # Check if session duration is 90+ minutes and discipline is declining
    first_trade = trades[0]
    last_trade = trades[-1]

    first_time = first_trade.get("timestamp")
    last_time = last_trade.get("timestamp")

    if not first_time or not last_time:
        return False

    try:
        first_dt = datetime.fromisoformat(first_time.replace("Z", "+00:00"))
        last_dt = datetime.fromisoformat(last_time.replace("Z", "+00:00"))
        duration_minutes = (last_dt - first_dt).total_seconds() / 60

        if duration_minutes < 90:
            return False
    except (ValueError, TypeError):
        return False

    # Check for declining discipline
    disciplines = [t.get("discipline_score", 0) for t in trades]
    for i in range(1, len(disciplines)):
        if disciplines[i] < disciplines[i - 1]:
            return True
    return False


def detect_discipline_trajectory(trades: List[Dict[str, Any]]) -> bool:
    """Detect discipline trajectory: 3 consecutive -1 scores (FR 5.5.4).

    Args:
        trades: List of trade records

    Returns:
        True if discipline trajectory issue is detected
    """
    if len(trades) < 3:
        return False

    # Check last 3 trades for consecutive -1 discipline scores
    recent_trades = trades[-3:]
    for trade in recent_trades:
        if trade.get("discipline_score", 0) != -1:
            return False
    return True


def detect_agency_breakdown(trades: List[Dict[str, Any]]) -> bool:
    """Detect agency breakdown: agency -1 (FR 5.5.5).

    Args:
        trades: List of trade records

    Returns:
        True if agency breakdown is detected
    """
    if len(trades) < 1:
        return False

    # Check most recent trade for agency -1
    recent_trade = trades[-1]
    return recent_trade.get("agency_score", 0) == -1


def detect_streak_recognition(trades: List[Dict[str, Any]]) -> bool:
    """Detect streak recognition: 3+ win streak or 3+ disciplined trades (FR 5.5.6).

    Args:
        trades: List of trade records

    Returns:
        True if streak recognition applies
    """
    if len(trades) < 3:
        return False

    # Check for 3+ consecutive wins
    recent_trades = trades[-3:]
    wins = all(t.get("outcome") == "win" for t in recent_trades)
    if wins:
        return True

    # Check for 3+ disciplined trades
    disciplined = all(t.get("discipline_score", 0) == 1 for t in recent_trades)
    return disciplined


def detect_recovery_pattern(trades: List[Dict[str, Any]]) -> bool:
    """Detect recovery pattern: positive discipline after recovering from loss (FR 5.5.7).

    Args:
        trades: List of trade records

    Returns:
        True if recovery pattern is detected
    """
    if len(trades) < 2:
        return False

    # Check for loss followed by win with positive discipline
    second_last = trades[-2]
    last = trades[-1]

    if second_last.get("outcome") == "loss" and last.get("outcome") == "win":
        if last.get("discipline_score", 0) > 0:
            return True
    return False


def generate_rule_based_insights(trades: List[Dict[str, Any]]) -> List[Insight]:
    """Generate insights based on rule detection (FR 5.5).

    Args:
        trades: List of trade records

    Returns:
        List of detected insights
    """
    insights = []

    # Tier 1: Immediate Risk Alerts (FR 5.5.1 - 5.5.3)
    if detect_tilt_risk(trades):
        insights.append(Insight(
            category="risk",
            message="Tilt risk detected: 2+ consecutive losses with low discipline. Consider taking a break.",
            severity="warning"
        ))

    if detect_overconfidence(trades):
        insights.append(Insight(
            category="risk",
            message="Overconfidence warning: 3+ consecutive wins with high discipline. Stay grounded.",
            severity="warning"
        ))

    if detect_session_fatigue(trades):
        insights.append(Insight(
            category="risk",
            message="Session fatigue detected: 90+ minutes with declining discipline. Consider ending the session.",
            severity="warning"
        ))

    # Tier 2: Pattern Recognition (3+ trades) (FR 5.5.4 - 5.5.5)
    if len(trades) >= 3:
        if detect_discipline_trajectory(trades):
            insights.append(Insight(
                category="pattern",
                message="Discipline trajectory concerning: 3 consecutive trades with discipline -1.",
                severity="info"
            ))

        if detect_agency_breakdown(trades):
            insights.append(Insight(
                category="pattern",
                message="Agency breakdown detected in recent trade. Consider your decision-making process.",
                severity="info"
            ))

    # Tier 3: Positive Reinforcement (FR 5.5.6 - 5.5.7)
    if len(trades) >= 3:
        if detect_streak_recognition(trades):
            insights.append(Insight(
                category="positive",
                message="Excellent streak! You're showing consistent discipline or winning trades.",
                severity="success"
            ))

        if detect_recovery_pattern(trades):
            insights.append(Insight(
                category="positive",
                message="Strong recovery! You bounced back well from a losing trade with good discipline.",
                severity="success"
            ))

    return insights


# =============================================================================
# LLM Prompt for Full Insights
# =============================================================================

INSIGHTS_SYSTEM_PROMPT = """You are a trading psychology expert AI assistant. Analyze the trading session data provided and generate behavioral insights.

# Your Task
Generate 2-4 actionable insights about the trader's behavior patterns, emotional state, and decision-making quality.

# Input Data
- Raw trade records: {trades}
- Session statistics: {session_summary}

# Required Output Fields
Each insight must include:
- category: "risk", "pattern", or "positive"
- message: 1-2 sentence actionable insight (max 500 chars)
- severity: "warning", "info", or "success" (optional)

# Guidelines
- Focus on behavioral patterns, not just results
- Identify emotional state indicators (tilt, overconfidence, fatigue)
- Note setup consistency and discipline
- Provide actionable flags for risk situations
- Be encouraging for positive behaviors
- Keep messages concise and practical

# Output Format
Return ONLY valid JSON array of insights. No markdown, no explanation.
Example: [{{"category": "pattern", "message": "Your insight here", "severity": "info"}}]
"""


async def call_insights_llm(
    trades: List[Dict[str, Any]],
    session_summary: dict
) -> InsightsResponse:
    """Call LLM to generate full insights (FR 5.1 - 5.3).

    Args:
        trades: List of trade records
        session_summary: Aggregated session statistics

    Returns:
        InsightsResponse with generated insights
    """
    llm = ChatOpenAI(
        model="gpt-4o-mini",
        temperature=0,
        max_tokens=1000,
        request_timeout=10.0
    )

    trades_json = json.dumps(trades, indent=2)
    summary_json = json.dumps(session_summary, indent=2)

    messages = [
        SystemMessage(content=INSIGHTS_SYSTEM_PROMPT.format(
            trades=trades_json,
            session_summary=summary_json
        )),
        HumanMessage(content="Generate behavioral insights for this trading session.")
    ]

    response = await llm.ainvoke(messages)

    try:
        insights_data = json.loads(response.content)
        insight_objects = [Insight(**insight) for insight in insights_data]
    except (json.JSONDecodeError, TypeError, ValueError):
        # Fallback to rule-based insights if LLM fails
        insight_objects = []

    return InsightsResponse(
        insights=insight_objects,
        generated_at=datetime.now(timezone.utc).isoformat(),
        trade_count=len(trades)
    )


# =============================================================================
# Main Generate Insights Node
# =============================================================================


async def generate_insights_node(state: InsightsAgentState) -> InsightsAgentState:
    """Generate behavioral insights from session data (FR 5.0 - 5.5).

    This node:
    - FR 5.1: Feeds full session's trade data to Trading Expert agent
    - FR 5.2: Passes both raw trade records and aggregated session statistics
    - FR 5.3: Includes behavioral patterns, setup consistency, emotional state indicators
    - FR 5.4: Returns encouraging messages for <5 trades, full analysis for 5+
    - FR 5.5: Generates insights across all tiers

    Args:
        state: InsightsAgentState containing session data

    Returns:
        Updated state with insights
    """
    trades = state.get("trades", [])
    trade_count = state.get("trade_count", 0)
    session_summary = state.get("session_summary", {})

    # FR 5.4: Small session handling
    if not should_generate_ai_insights(trade_count):
        message = get_small_session_message(trade_count)
        insights = InsightsResponse(
            insights=[Insight(category="pattern", message=message)],
            generated_at=datetime.now(timezone.utc).isoformat(),
            trade_count=trade_count
        )
        return {"insights": insights}

    # Generate rule-based insights first
    rule_insights = generate_rule_based_insights(trades)

    # For 5-9 trades, use rule-based insights only (FR 5.4.2)
    if 5 <= trade_count < 10:
        if not rule_insights:
            # Add encouraging message if no rule-based insights
            rule_insights.append(Insight(
                category="pattern",
                message="You're building a good dataset. Keep trading to see more patterns emerge.",
                severity="info"
            ))

        insights = InsightsResponse(
            insights=rule_insights[:3],  # Max 3 insights
            generated_at=datetime.now(timezone.utc).isoformat(),
            trade_count=trade_count
        )
        return {"insights": insights}

    # For 10+ trades, use LLM for full analysis
    if trade_count >= 10:
        try:
            llm_insights = await call_insights_llm(trades, session_summary)

            # Combine with rule-based insights
            all_insights = rule_insights + llm_insights.insights

            # Deduplicate and limit to 3
            seen_messages = set()
            final_insights = []
            for insight in all_insights:
                if insight.message not in seen_messages:
                    seen_messages.add(insight.message)
                    final_insights.append(insight)
                    if len(final_insights) >= 3:
                        break

            insights = InsightsResponse(
                insights=final_insights,
                generated_at=datetime.now(timezone.utc).isoformat(),
                trade_count=trade_count
            )
        except Exception:
            # Fallback to rule-based insights
            insights = InsightsResponse(
                insights=rule_insights[:3],
                generated_at=datetime.now(timezone.utc).isoformat(),
                trade_count=trade_count
            )
        return {"insights": insights}

    # Default fallback
    return {"insights": None}
