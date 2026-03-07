"""Trade extraction LangGraph workflow."""
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph

from src.agent.nodes.extract_trade import (
    extract_trade_node,
    refine_extraction_node,
    should_retry,
)
from src.agent.state import ExtractionState


def build_extraction_graph() -> StateGraph:
    """Build the trade extraction LangGraph workflow.

    Flow:
    1. START -> extract
    2. extract -> validate (check for valid extraction)
    3. validate -> retry (if errors and retries remaining)
    4. validate -> accept (if extraction valid)
    5. validate -> fail (if errors and no retries)
    6. retry -> extract (loop back)
    7. accept -> END
    8. fail -> END

    Returns:
        Compiled LangGraph StateGraph with checkpointer
    """
    graph = StateGraph(ExtractionState)

    # Add nodes
    graph.add_node("extract", extract_trade_node)
    graph.add_node("refine", refine_extraction_node)

    # Start with extraction
    graph.add_edge(START, "extract")

    # After extraction, check if we need to validate or retry
    graph.add_conditional_edges(
        "extract",
        should_retry,
        {
            "retry": "refine",
            "accept": END,
            "fail": END,
        },
    )

    # After refining, go back to extraction
    graph.add_edge("refine", "extract")

    # Compile with checkpointer
    return graph.compile(checkpointer=MemorySaver())


# Singleton instance
extract_trade_graph = build_extraction_graph()
