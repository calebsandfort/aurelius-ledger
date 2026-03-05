"""Pydantic schemas for AI-generated insights."""
from typing import Optional, List

from pydantic import BaseModel, Field


class Insight(BaseModel):
    """AI-generated insight about trader behavior."""

    category: str = Field(..., min_length=1, description="Category: risk, pattern, or positive")
    message: str = Field(..., min_length=1, max_length=500, description="Insight message")
    severity: Optional[str] = Field(
        None, description="Severity: warning, info, or success"
    )


class InsightsResponse(BaseModel):
    """Response containing AI-generated insights."""

    insights: List[Insight] = Field(
        ..., max_length=3, description="List of insights (max 3)"
    )
    generated_at: str = Field(
        ..., description="ISO timestamp of when insights were generated"
    )
    trade_count: int = Field(
        ..., ge=0, description="Number of trades in the session"
    )
