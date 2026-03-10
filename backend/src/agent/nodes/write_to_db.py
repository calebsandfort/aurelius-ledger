"""Write extracted trade data to database."""

import asyncpg
import structlog

from src.agent.state import AgentState
from src.config import settings

logger = structlog.get_logger(__name__)


async def write_to_db_node(state: AgentState) -> dict:
    """Create trade record with extracted data. Skip if extraction failed."""
    extraction = state.get("extraction")
    if not extraction:
        logger.warning("write_to_db_skipped", reason="no_extraction")
        return {}

    user_id = state.get("user_id")
    if not user_id:
        logger.warning("write_to_db_skipped", reason="no_user_id")
        return {}

    conn = await asyncpg.connect(settings.database_url)
    try:
        session = await conn.fetchrow(
            "SELECT id FROM sessions WHERE user_id=$1 AND ended_at IS NULL "
            "ORDER BY started_at DESC LIMIT 1",
            user_id,
        )
        if not session:
            session = await conn.fetchrow(
                "INSERT INTO sessions "
                "(user_id,total_pnl,win_count,loss_count,"
                "breakeven_count,net_discipline_score,net_agency_score,trade_count) "
                "VALUES ($1,0,0,0,0,0,0,0) RETURNING id",
                user_id,
            )
        session_id = str(session["id"])

        row = await conn.fetchrow(
            "SELECT MAX(sequence_number) AS n FROM trades WHERE session_id=$1::uuid",
            session_id,
        )
        seq = (row["n"] or 0) + 1

        raw_input = state["messages"][-1].content if state.get("messages") else ""

        trade = await conn.fetchrow(
            "INSERT INTO trades "
            "(session_id,sequence_number,raw_input,"
            "direction,outcome,pnl,setup_description,"
            "discipline_score,agency_score,discipline_confidence,agency_confidence) "
            "VALUES ($1::uuid,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id",
            session_id,
            seq,
            raw_input,
            extraction.direction,
            extraction.outcome,
            extraction.pnl,
            extraction.setup_description,
            extraction.discipline_score,
            extraction.agency_score,
            extraction.discipline_confidence,
            extraction.agency_confidence,
        )

        logger.info(
            "trade_written",
            trade_id=str(trade["id"]),
            session_id=session_id,
            sequence_number=seq,
        )

        return {
            "trade_id": str(trade["id"]),
            "session_id": session_id,
            "sequence_number": seq,
        }
    except Exception as e:
        logger.error("write_to_db_failed", error=str(e))
        raise
    finally:
        await conn.close()
