"""Insights API endpoints for trading session insights.

This module implements the insights API endpoints:
- GET /api/v1/insights?session_id={session_id} - Get insights for a session
- POST /api/v1/insights - Generate insights for a session (async, non-blocking)

This implements:
- FR 5.0: Insights Generation
- FR 5.2: Insights Generation Timing
- FR 5.3: Insights Regeneration Strategy
- FR 5.4: Small Session Insights
"""
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

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
from src.schemas.insights import InsightsResponse, Insight


# =============================================================================
# Request/Response Models
# =============================================================================


class InsightsRequest(BaseModel):
    """Request body for generating insights."""

    session_id: str = Field(..., min_length=1, description="Trading session ID")


class InsightsResponseModel(BaseModel):
    """Response model for insights endpoint."""

    insights: List[Insight] = Field(
        ..., max_length=3, description="List of insights (max 3)"
    )
    generated_at: str = Field(
        ..., description="ISO timestamp of when insights were generated"
    )
    trade_count: int = Field(..., ge=0, description="Number of trades in the session")

    model_config = {"from_attributes": True}


# =============================================================================
# API Response Envelope
# =============================================================================


class ApiResponse(BaseModel):
    """Generic API response wrapper."""

    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


# =============================================================================
# Router Setup
# =============================================================================

router = APIRouter(prefix="/api/v1", tags=["insights"])


# =============================================================================
# Helper Functions (Mock/Development)
# =============================================================================


async def get_session_data(session_id: str) -> Optional[Dict[str, Any]]:
    """Fetch session data (trades and summary) for a given session.

    This is a mock implementation for development. In production, this would
    query the database.

    Args:
        session_id: The trading session identifier

    Returns:
        Dictionary with trades, session_summary, trade_count, last_trade_time
        or None if session not found
    """
    # Mock implementation - in production this would query database
    # For now, return sample data if session_id is provided
    if not session_id:
        return None

    # Sample data for testing
    mock_trades = [
        {
            "id": f"trade-{i}",
            "direction": "long" if i % 2 == 0 else "short",
            "outcome": "win" if i % 3 != 0 else "loss",
            "pnl": 100.0 * (i + 1),
            "discipline_score": 1 if i % 3 == 0 else 0,
            "agency_score": 1,
            "timestamp": f"2024-01-15T10:{i * 10:02d}Z",
        }
        for i in range(5)
    ]

    return {
        "trades": mock_trades,
        "session_summary": {
            "total_trades": len(mock_trades),
            "win_count": sum(1 for t in mock_trades if t["outcome"] == "win"),
            "loss_count": sum(1 for t in mock_trades if t["outcome"] == "loss"),
            "total_pnl": sum(t["pnl"] for t in mock_trades),
            "win_rate": sum(1 for t in mock_trades if t["outcome"] == "win")
            / len(mock_trades),
        },
        "trade_count": len(mock_trades),
        "last_trade_time": mock_trades[-1]["timestamp"],
    }


async def generate_insights_background(
    session_id: str, trades: List[Dict[str, Any]], session_summary: Dict[str, Any], trade_count: int
) -> None:
    """Background task to generate and cache insights.

    This implements FR 5.2.2: Insights generation queued asynchronously.

    Args:
        session_id: The trading session identifier
        trades: List of trade records
        session_summary: Aggregated session statistics
        trade_count: Number of trades in the session
    """
    state: InsightsAgentState = {
        "session_id": session_id,
        "trades": trades,
        "session_summary": session_summary,
        "trade_count": trade_count,
    }

    await generate_insights_node(state)


# =============================================================================
# API Endpoints
# =============================================================================


@router.get(
    "/insights",
    response_model=ApiResponse,
    status_code=status.HTTP_200_OK,
    summary="Get insights for a trading session",
)
async def get_insights(session_id: str = Query(..., min_length=1)) -> ApiResponse:
    """Get AI-generated insights for a trading session.

    This endpoint:
    - FR 5.1: Feeds full session's trade data to Trading Expert agent
    - FR 5.2: Passes both raw trade records and aggregated session statistics
    - FR 5.3: Uses caching to avoid regenerating insights unnecessarily
    - FR 5.4: Returns encouraging messages for <5 trades

    Args:
        session_id: The trading session ID

    Returns:
        ApiResponse with insights data

    Raises:
        HTTPException: 404 if session not found
    """
    # Fetch session data
    session_data = await get_session_data(session_id)

    if session_data is None:
        return ApiResponse(
            success=False,
            error=f"Session {session_id} not found",
        )

    trades = session_data["trades"]
    session_summary = session_data["session_summary"]
    trade_count = session_data["trade_count"]
    last_trade_time = session_data["last_trade_time"]

    # Check cache (FR 5.3.3)
    cache = get_insights_cache()
    cache_key = generate_cache_key(session_id, trades, trade_count)
    cached_insights = cache.get(cache_key)

    # Check if regeneration is needed (FR 5.3.4)
    if cached_insights and not should_regenerate(
        cached_insights, trade_count, last_trade_time
    ):
        # Return cached insights
        return ApiResponse(
            success=True,
            data={
                "insights": cached_insights.insights,
                "generated_at": cached_insights.generated_at,
                "trade_count": cached_insights.trade_count,
            },
        )

    # Generate new insights
    state: InsightsAgentState = {
        "session_id": session_id,
        "trades": trades,
        "session_summary": session_summary,
        "trade_count": trade_count,
    }

    result = await generate_insights_node(state)
    insights = result.get("insights")

    if insights is None:
        # Return default response for edge cases
        insights = InsightsResponse(
            insights=[Insight(category="pattern", message="No insights available yet.")],
            generated_at=datetime.now(timezone.utc).isoformat(),
            trade_count=trade_count,
        )

    # Cache the new insights (FR 5.3.3)
    cache.set(cache_key, insights)

    return ApiResponse(
        success=True,
        data={
            "insights": insights.insights,
            "generated_at": insights.generated_at,
            "trade_count": insights.trade_count,
        },
    )


@router.post(
    "/insights",
    response_model=ApiResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Generate insights for a trading session (async)",
)
async def create_insights(
    request: InsightsRequest, background_tasks: BackgroundTasks
) -> ApiResponse:
    """Generate AI-generated insights asynchronously for a trading session.

    This endpoint:
    - FR 5.2.2: Returns 202 Accepted immediately
    - FR 5.2.2: Queues insights generation as background task
    - FR 5.2.3: Dashboard shows "Generating insights..." placeholder

    Args:
        request: InsightsRequest with session_id
        background_tasks: FastAPI background tasks

    Returns:
        ApiResponse with status
    """
    # Fetch session data
    session_data = await get_session_data(request.session_id)

    if session_data is None:
        return ApiResponse(
            success=False,
            error=f"Session {request.session_id} not found",
        )

    trades = session_data["trades"]
    session_summary = session_data["session_summary"]
    trade_count = session_data["trade_count"]

    # Queue background task for insights generation (FR 5.2.2)
    background_tasks.add_task(
        generate_insights_background,
        request.session_id,
        trades,
        session_summary,
        trade_count,
    )

    return ApiResponse(
        success=True,
        data={"status": "insights_generation_queued", "session_id": request.session_id},
    )
