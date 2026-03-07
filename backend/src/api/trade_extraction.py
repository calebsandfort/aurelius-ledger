"""Trade extraction API endpoint."""
from typing import Literal

import structlog
from fastapi import APIRouter, HTTPException
from pydantic import Field

from src.agent.state import ExtractionState
from src.agent.workflows.trade_extraction import extract_trade_graph
from src.schemas.trade_extraction import ExtractionRequest, ExtractionResponse

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/extract", tags=["extraction"])


@router.post("")
async def extraction_endpoint(request: ExtractionRequest) -> ExtractionResponse:
    """Extract structured trade data from natural language input.

    Args:
        request: ExtractionRequest with trade_id and raw_input

    Returns:
        ExtractionResponse with success status and message
    """
    logger.info(
        "extraction_request_received",
        trade_id=request.trade_id,
        input_length=len(request.raw_input),
    )

    # Initialize state
    initial_state: ExtractionState = {
        "trade_id": request.trade_id,
        "raw_input": request.raw_input,
        "extraction": None,
        "validation_errors": [],
        "retry_count": 0,
    }

    # Run extraction graph
    try:
        result = await extract_trade_graph.ainvoke(initial_state)

        if result.get("extraction") is not None:
            extraction = result["extraction"]
            logger.info(
                "extraction_success",
                trade_id=request.trade_id,
                direction=extraction.direction,
                outcome=extraction.outcome,
                pnl=extraction.pnl,
            )

            return ExtractionResponse(
                trade_id=request.trade_id,
                success=True,
                message="Extraction successful",
            )
        else:
            errors = result.get("validation_errors", [])
            logger.warning(
                "extraction_failed",
                trade_id=request.trade_id,
                errors=errors,
            )

            return ExtractionResponse(
                trade_id=request.trade_id,
                success=False,
                message=f"Extraction failed: {'; '.join(errors)}",
            )

    except Exception as e:
        logger.error(
            "extraction_error",
            trade_id=request.trade_id,
            error=str(e),
        )

        return ExtractionResponse(
            trade_id=request.trade_id,
            success=False,
            message=f"An error occurred during extraction: {str(e)}",
        )
