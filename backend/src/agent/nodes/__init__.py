"""Agent nodes for insights generation."""

# Re-export chat_node from chat.py for backwards compatibility
from src.agent.nodes.chat import chat_node  # noqa: F401

__all__ = ["chat_node"]
