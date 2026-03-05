"""Pydantic schemas for trade extraction."""
from typing import Optional, Literal

from pydantic import BaseModel, Field


class TradeExtractionResult(BaseModel):
    """Result of extracting structured trade data from natural language."""

    direction: Literal["long", "short"] = Field(
        ..., description="Direction of the trade: long or short"
    )
    outcome: Literal["win", "loss", "breakeven"] = Field(
        ..., description="Outcome of the trade: win, loss, or breakeven"
    )
    pnl: float = Field(
        ..., ge=-10000, le=10000, description="Profit/loss in dollars"
    )
    setup_description: Optional[str] = Field(
        None, max_length=2000, description="Description of the trade setup"
    )
    discipline_score: int = Field(
        ..., ge=-1, le=1, description="Discipline score: -1 (poor), 0 (neutral), 1 (excellent)"
    )
    agency_score: int = Field(
        ..., ge=-1, le=1, description="Agency score: -1 (passive), 0 (neutral), 1 (proactive)"
    )
    discipline_confidence: Literal["high", "medium", "low"] = Field(
        ..., description="Confidence in discipline score"
    )
    agency_confidence: Literal["high", "medium", "low"] = Field(
        ..., description="Confidence in agency score"
    )
    behavioral_signals: list[str] = Field(
        default_factory=list, description="Behavioral signals detected in the trade description"
    )


class ExtractionRequest(BaseModel):
    """Request to extract trade data from natural language input."""

    trade_id: str = Field(
        ..., min_length=1, description="UUID of the trade record to update"
    )
    raw_input: str = Field(
        ..., min_length=1, max_length=5000, description="Natural language trade description"
    )


class ExtractionResponse(BaseModel):
    """Response from extraction operation."""

    trade_id: str = Field(..., description="UUID of the trade record")
    success: bool = Field(..., description="Whether extraction was successful")
    message: str = Field(..., description="Status message")
