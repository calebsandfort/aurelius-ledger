"""Main chat agent graph — linear trade-to-insights pipeline."""

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph

from src.agent.nodes.compose_response import compose_response_node
from src.agent.nodes.extract_trade import extract_trade_chat_node
from src.agent.nodes.run_insights import run_insights_node
from src.agent.nodes.write_to_db import write_to_db_node
from src.agent.state import AgentState


def build_graph() -> StateGraph:
    """Build the linear trade-to-insights chat pipeline.

    Flow: START → extract_trade → write_to_db → run_insights → compose_response → END
    """
    graph = StateGraph(AgentState)
    graph.add_node("extract_trade", extract_trade_chat_node)
    graph.add_node("write_to_db", write_to_db_node)
    graph.add_node("run_insights", run_insights_node)
    graph.add_node("compose_response", compose_response_node)
    graph.add_edge(START, "extract_trade")
    graph.add_edge("extract_trade", "write_to_db")
    graph.add_edge("write_to_db", "run_insights")
    graph.add_edge("run_insights", "compose_response")
    graph.add_edge("compose_response", END)
    return graph.compile(checkpointer=MemorySaver())


agent = build_graph()
