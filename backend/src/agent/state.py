from typing import Annotated, Optional

from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages
from typing_extensions import TypedDict

from src.schemas.trade_extraction import TradeExtractionResult


class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]


class ExtractionState(TypedDict):
    """State for trade extraction workflow."""

    trade_id: str
    raw_input: str
    extraction: Optional[TradeExtractionResult]
    validation_errors: list[str]
    retry_count: int
