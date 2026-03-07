# Re-export from chat module for backward compatibility
from src.agent.chat import chat_node  # noqa: F401


def __getattr__(name: str):
    """Allow importing from src.agent.nodes.extract_trade via directory."""
    if name == "extract_trade":
        from src.agent.nodes import extract_trade

        return extract_trade
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
