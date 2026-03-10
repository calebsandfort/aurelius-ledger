from typing import Annotated, Optional

from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages
from typing_extensions import TypedDict

from src.schemas.trade_extraction import TradeExtractionResult


class AgentState(TypedDict):
    """Unified state for the trade-to-insights chat pipeline."""

    messages: Annotated[list[BaseMessage], add_messages]
    user_id: Optional[str]
    extraction: Optional[TradeExtractionResult]
    trade_id: Optional[str]
    session_id: Optional[str]
    sequence_number: Optional[int]
    session_trades: Optional[list[dict]]
    session_summary: Optional[dict]
    insights: Optional[list[dict]]


class ExtractionState(TypedDict):
    """State for trade extraction workflow."""

    trade_id: str
    raw_input: str
    extraction: Optional[TradeExtractionResult]
    validation_errors: list[str]
    retry_count: int
