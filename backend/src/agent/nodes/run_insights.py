"""Run insights on session trades."""

import asyncpg
import structlog

from src.agent.nodes.generate_insights import (
    call_insights_llm,
    generate_rule_based_insights,
)
from src.agent.state import AgentState
from src.config import settings

logger = structlog.get_logger(__name__)


async def run_insights_node(state: AgentState) -> dict:
    """Query session trades and generate insights."""
    session_id = state.get("session_id")
    if not session_id:
        logger.warning("run_insights_skipped", reason="no_session_id")
        return {}

    conn = await asyncpg.connect(settings.database_url)
    try:
        rows = await conn.fetch(
            "SELECT direction,outcome,pnl,discipline_score,agency_score,"
            "discipline_confidence,agency_confidence,setup_description,created_at "
            "FROM trades WHERE session_id=$1::uuid ORDER BY sequence_number ASC",
            session_id,
        )
    finally:
        await conn.close()

    trades = [dict(r) for r in rows]
    trade_count = len(trades)

    summary = {
        "trade_count": trade_count,
        "total_pnl": sum(t.get("pnl", 0) or 0 for t in trades),
        "wins": sum(1 for t in trades if t.get("outcome") == "win"),
        "losses": sum(1 for t in trades if t.get("outcome") == "loss"),
        "avg_discipline": (
            sum(t.get("discipline_score", 0) or 0 for t in trades) / max(trade_count, 1)
        ),
        "avg_agency": (
            sum(t.get("agency_score", 0) or 0 for t in trades) / max(trade_count, 1)
        ),
    }

    rule_insights = generate_rule_based_insights(trades)

    llm_insights = []
    if trade_count >= 10:
        try:
            resp = await call_insights_llm(trades, summary)
            llm_insights = [
                {"category": i.category, "message": i.message, "severity": i.severity}
                for i in resp.insights
            ]
        except Exception as e:
            logger.error("llm_insights_failed", error=str(e))

    all_insights = [
        {"category": i.category, "message": i.message, "severity": i.severity}
        for i in rule_insights
    ] + llm_insights

    logger.info(
        "insights_generated",
        session_id=session_id,
        trade_count=trade_count,
        insight_count=len(all_insights),
    )

    return {
        "session_trades": trades,
        "session_summary": summary,
        "insights": all_insights[:3],
    }
