"""Trade extraction node with LangChain structured output."""
import re
from typing import Literal

import structlog
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from pydantic import ValidationError

from src.agent.prompts import EXTRACTION_PROMPT
from src.agent.state import ExtractionState
from src.schemas.trade_extraction import TradeExtractionResult

logger = structlog.get_logger(__name__)

MAX_RETRIES = 2
REQUEST_TIMEOUT = 5


def sanitize_input(raw_input: str) -> str:
    """Sanitize input to prevent prompt injection.

    Removes potential prompt injection patterns while preserving
    the core trading information.
    """
    # Remove null bytes
    sanitized = raw_input.replace("\x00", "")

    # Remove common prompt injection patterns
    injection_patterns = [
        r"ignore\s+(previous|all)\s+(instructions|prompts?)",
        r"system:\s*",
        r"you\s+are\s+now\s+.*",
        r"developer\s+mode",
        r"override\s+(the\s+)?output",
        r"\{\{.*\}\}",  # Template injection
    ]

    for pattern in injection_patterns:
        sanitized = re.sub(pattern, "", sanitized, flags=re.IGNORECASE)

    # Collapse multiple whitespace
    sanitized = " ".join(sanitized.split())

    return sanitized


async def extract_trade_node(state: ExtractionState) -> dict:
    """Extract structured trade data from natural language input.

    Uses LangChain's with_structured_output() with Pydantic validation.
    Implements retry logic for schema mismatches.

    Args:
        state: Current extraction state with trade_id, raw_input, retry_count

    Returns:
        Updated state with extraction result or validation errors
    """
    trade_id = state["trade_id"]
    raw_input = state["raw_input"]
    retry_count = state["retry_count"]

    logger.info(
        "extraction_started",
        trade_id=trade_id,
        retry_count=retry_count,
        input_length=len(raw_input),
    )

    # Sanitize input
    sanitized_input = sanitize_input(raw_input)

    try:
        # Create LLM with structured output
        llm = ChatOpenAI(
            model="gpt-4o-mini",
            temperature=0,
            max_tokens=1000,
            request_timeout=REQUEST_TIMEOUT,
        )

        # Use with_structured_output for Pydantic validation
        structured_llm = llm.with_structured_output(TradeExtractionResult)

        # Invoke LLM with extraction system prompt
        response = await structured_llm.ainvoke(
            [
                SystemMessage(content=EXTRACTION_PROMPT),
                HumanMessage(content=sanitized_input),
            ]
        )

        logger.info(
            "extraction_successful",
            trade_id=trade_id,
            direction=response.direction,
            outcome=response.outcome,
            pnl=response.pnl,
        )

        return {
            "extraction": response,
            "validation_errors": [],
        }

    except ValidationError as e:
        error_messages = [str(err) for err in e.errors()]
        logger.warning(
            "extraction_validation_error",
            trade_id=trade_id,
            errors=error_messages,
            retry_count=retry_count,
        )

        if retry_count < MAX_RETRIES:
            # Retry with context
            return {
                "extraction": None,
                "validation_errors": error_messages,
                "retry_count": retry_count + 1,
            }
        else:
            # Max retries reached
            return {
                "extraction": None,
                "validation_errors": [
                    f"Failed to extract valid trade data after {MAX_RETRIES} attempts: {', '.join(error_messages)}"
                ],
            }

    except Exception as e:
        logger.error(
            "extraction_failed",
            trade_id=trade_id,
            error=str(e),
            retry_count=retry_count,
        )

        if retry_count < MAX_RETRIES:
            return {
                "extraction": None,
                "validation_errors": [str(e)],
                "retry_count": retry_count + 1,
            }
        else:
            return {
                "extraction": None,
                "validation_errors": [
                    f"Extraction failed after {MAX_RETRIES} attempts: {str(e)}"
                ],
            }


def should_retry(state: ExtractionState) -> Literal["retry", "accept", "fail"]:
    """Determine whether to retry extraction based on current state.

    Args:
        state: Current extraction state

    Returns:
        "retry" to retry extraction, "accept" to proceed, "fail" to end with error
    """
    if state.get("extraction") is not None:
        return "accept"

    if state["retry_count"] < MAX_RETRIES:
        return "retry"

    return "fail"


async def refine_extraction_node(state: ExtractionState) -> dict:
    """Add context for retry attempts.

    Appends previous validation errors to help the LLM fix its output.

    Args:
        state: Current extraction state with validation_errors

    Returns:
        Updated state with enhanced input for retry
    """
    errors = state.get("validation_errors", [])
    retry_count = state["retry_count"]

    logger.info(
        "refine_extraction",
        trade_id=state["trade_id"],
        retry_count=retry_count,
        error_count=len(errors),
    )

    # Add error context to the original input
    enhanced_input = (
        f"{state['raw_input']}\n\n"
        f"[Previous extraction errors: {', '.join(errors)}. "
        f"Please fix these issues and return valid JSON matching the schema.]"
    )

    return {
        "raw_input": enhanced_input,
        "retry_count": retry_count + 1,
    }
