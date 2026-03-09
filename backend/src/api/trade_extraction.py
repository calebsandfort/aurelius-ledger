"""Trade extraction API endpoint."""
import asyncpg
import structlog

from src.agent.state import ExtractionState
from src.agent.workflows.trade_extraction import extract_trade_graph
from src.config import settings
from src.schemas.trade_extraction import ExtractionRequest, ExtractionResponse
from fastapi import APIRouter

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/extract", tags=["extraction"])


async def _write_extraction_to_db(trade_id: str, extraction) -> None:
    """Write extracted trade data back to the database.

    Args:
        trade_id: UUID of the trade record to update
        extraction: TradeExtractionResult with extracted fields
    """
    conn = await asyncpg.connect(settings.database_url)
    try:
        await conn.execute(
            """
            UPDATE trades SET
                direction = $1,
                outcome = $2,
                pnl = $3,
                setup_description = $4,
                discipline_score = $5,
                agency_score = $6,
                discipline_confidence = $7,
                agency_confidence = $8,
                updated_at = NOW()
            WHERE id = $9::uuid
            """,
            extraction.direction,
            extraction.outcome,
            extraction.pnl,
            extraction.setup_description,
            extraction.discipline_score,
            extraction.agency_score,
            extraction.discipline_confidence,
            extraction.agency_confidence,
            trade_id,
        )
    finally:
        await conn.close()


@router.post("")
async def extraction_endpoint(request: ExtractionRequest) -> ExtractionResponse:
    """Extract structured trade data from natural language input and persist to DB.

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

    initial_state: ExtractionState = {
        "trade_id": request.trade_id,
        "raw_input": request.raw_input,
        "extraction": None,
        "validation_errors": [],
        "retry_count": 0,
    }

    try:
        result = await extract_trade_graph.ainvoke(initial_state)

        if result.get("extraction") is not None:
            extraction = result["extraction"]

            await _write_extraction_to_db(request.trade_id, extraction)

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
                message=f"Couldn't parse that — add it manually when you have a moment.",
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
            message="Trade saved. Analysis unavailable — check back later.",
        )
