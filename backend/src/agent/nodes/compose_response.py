"""Compose a formatted chat response from trade data and insights."""

import structlog
from langchain_core.messages import AIMessage

from src.agent.state import AgentState

logger = structlog.get_logger(__name__)

FALLBACK_MESSAGE = (
    "I couldn't extract trade data from that message. "
    "Could you rephrase with direction (long/short), outcome, and P&L?"
)

_DISCIPLINE_LABELS = {
    -1: "\U0001f534 Impulsive",
    0: "\U0001f7e1 Neutral",
    1: "\U0001f7e2 Disciplined",
}

_AGENCY_LABELS = {
    -1: "\U0001f534 Reactive",
    0: "\U0001f7e1 Neutral",
    1: "\U0001f7e2 Intentional",
}

_CONFIDENCE_ICONS = {
    "high": "(\u2713\u2713)",
    "medium": "(\u2713)",
    "low": "(?)",
}


def _format_score(score: int, confidence: str, labels: dict[int, str]) -> str:
    """Map a score + confidence to an emoji-enhanced label."""
    label = labels.get(score, "\U0001f7e1 Neutral")
    icon = _CONFIDENCE_ICONS.get(confidence, "(?)")
    return f"{label} {icon}"


async def compose_response_node(state: AgentState) -> dict:
    """Build a deterministic formatted response from trade data, session stats, and insights."""
    extraction = state.get("extraction")
    if not extraction:
        return {"messages": [AIMessage(content=FALLBACK_MESSAGE)]}

    sequence_number = state.get("sequence_number", 1)
    summary = state.get("session_summary", {})
    insights = state.get("insights", [])

    trade_count = summary.get("trade_count", 1)
    wins = summary.get("wins", 0)
    win_rate = round((wins / max(trade_count, 1)) * 100)

    direction = extraction.direction.upper()
    outcome = extraction.outcome.upper()
    pnl_str = f"${extraction.pnl:+.0f}"

    discipline = _format_score(
        extraction.discipline_score,
        extraction.discipline_confidence,
        _DISCIPLINE_LABELS,
    )
    agency = _format_score(
        extraction.agency_score,
        extraction.agency_confidence,
        _AGENCY_LABELS,
    )

    avg_discipline = summary.get("avg_discipline", extraction.discipline_score)
    avg_agency = summary.get("avg_agency", extraction.agency_score)

    lines = [
        f"\U0001f4ca **Trade #{sequence_number} \u2014 {direction} {outcome} ({pnl_str})**",
        f"{discipline} | {agency}",
        "",
        f"\U0001f4c8 **Session** \u2014 {trade_count} trades | ${summary.get('total_pnl', 0):+.0f} P&L | {win_rate}% win rate",
        f"Avg Discipline: {avg_discipline:.1f} | Avg Agency: {avg_agency:.1f}",
    ]

    if insights:
        lines.append("")
        lines.append("\U0001f4a1 **Insights**")
        for insight in insights[:3]:
            message = insight.get("message", "") if isinstance(insight, dict) else getattr(insight, "message", "")
            if message:
                lines.append(f"\u2022 {message}")

    return {"messages": [AIMessage(content="\n".join(lines))]}
