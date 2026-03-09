"""Insights API endpoints for trading session insights."""
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import asyncpg
from fastapi import APIRouter, BackgroundTasks, Query, status
from pydantic import BaseModel, Field

from src.agent.nodes.generate_insights import (
    InsightsAgentState,
    generate_insights_node,
)
from src.agent.workflows.insights_caching import (
    generate_cache_key,
    get_insights_cache,
    should_regenerate,
)
from src.config import settings
from src.schemas.insights import InsightsResponse, Insight


router = APIRouter(prefix="/api/v1", tags=["insights"])


class InsightsRequest(BaseModel):
    session_id: str = Field(..., min_length=1)


class ApiResponse(BaseModel):
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


async def _get_session_data(session_id: str) -> Optional[Dict[str, Any]]:
    """Fetch real session trades and compute summary from the database."""
    conn = await asyncpg.connect(settings.database_url)
    try:
        rows = await conn.fetch(
            """
            SELECT
                id, direction, outcome, pnl,
                discipline_score, agency_score,
                discipline_confidence, agency_confidence,
                setup_description, created_at
            FROM trades
            WHERE session_id = $1::uuid
            ORDER BY sequence_number ASC
            """,
            session_id,
        )
    finally:
        await conn.close()

    if not rows:
        return None

    trades = [
        {
            "id": str(row["id"]),
            "direction": row["direction"],
            "outcome": row["outcome"],
            "pnl": float(row["pnl"]),
            "discipline_score": row["discipline_score"],
            "agency_score": row["agency_score"],
            "discipline_confidence": row["discipline_confidence"],
            "agency_confidence": row["agency_confidence"],
            "setup_description": row["setup_description"],
            "timestamp": row["created_at"].isoformat(),
        }
        for row in rows
    ]

    trade_count = len(trades)
    win_count = sum(1 for t in trades if t["outcome"] == "win")
    loss_count = sum(1 for t in trades if t["outcome"] == "loss")
    total_pnl = sum(t["pnl"] for t in trades)
    discipline_sum = sum(t["discipline_score"] for t in trades)
    agency_sum = sum(t["agency_score"] for t in trades)
    win_rate = win_count / trade_count if trade_count > 0 else 0.0

    session_summary = {
        "total_trades": trade_count,
        "win_count": win_count,
        "loss_count": loss_count,
        "breakeven_count": trade_count - win_count - loss_count,
        "total_pnl": round(total_pnl, 2),
        "win_rate": round(win_rate, 3),
        "discipline_sum": discipline_sum,
        "agency_sum": agency_sum,
        "last_3_discipline": [t["discipline_score"] for t in trades[-3:]],
        "last_3_agency": [t["agency_score"] for t in trades[-3:]],
    }

    return {
        "trades": trades,
        "session_summary": session_summary,
        "trade_count": trade_count,
        "last_trade_time": trades[-1]["timestamp"] if trades else None,
    }


@router.get("/insights", response_model=ApiResponse, status_code=status.HTTP_200_OK)
async def get_insights(session_id: str = Query(..., min_length=1)) -> ApiResponse:
    session_data = await _get_session_data(session_id)

    if session_data is None:
        return ApiResponse(success=False, error=f"Session {session_id} not found or has no trades")

    trades = session_data["trades"]
    session_summary = session_data["session_summary"]
    trade_count = session_data["trade_count"]
    last_trade_time = session_data["last_trade_time"]

    cache = get_insights_cache()
    cache_key = generate_cache_key(session_id, trades, trade_count)
    cached_insights = cache.get(cache_key)

    if cached_insights and not should_regenerate(cached_insights, trade_count, last_trade_time):
        return ApiResponse(
            success=True,
            data={
                "insights": [i.model_dump() for i in cached_insights.insights],
                "generated_at": cached_insights.generated_at,
                "trade_count": cached_insights.trade_count,
            },
        )

    state: InsightsAgentState = {
        "session_id": session_id,
        "trades": trades,
        "session_summary": session_summary,
        "trade_count": trade_count,
        "insights": None,
    }

    result = await generate_insights_node(state)
    insights = result.get("insights")

    if insights is None:
        insights = InsightsResponse(
            insights=[Insight(category="pattern", message="No insights available yet.")],
            generated_at=datetime.now(timezone.utc).isoformat(),
            trade_count=trade_count,
        )

    cache.set(cache_key, insights)

    return ApiResponse(
        success=True,
        data={
            "insights": [i.model_dump() for i in insights.insights],
            "generated_at": insights.generated_at,
            "trade_count": insights.trade_count,
        },
    )


@router.post("/insights", response_model=ApiResponse, status_code=status.HTTP_202_ACCEPTED)
async def create_insights(request: InsightsRequest, background_tasks: BackgroundTasks) -> ApiResponse:
    session_data = await _get_session_data(request.session_id)

    if session_data is None:
        return ApiResponse(success=False, error=f"Session {request.session_id} not found or has no trades")

    async def _generate():
        state: InsightsAgentState = {
            "session_id": request.session_id,
            "trades": session_data["trades"],
            "session_summary": session_data["session_summary"],
            "trade_count": session_data["trade_count"],
            "insights": None,
        }
        await generate_insights_node(state)

    background_tasks.add_task(_generate)

    return ApiResponse(
        success=True,
        data={"status": "insights_generation_queued", "session_id": request.session_id},
    )
