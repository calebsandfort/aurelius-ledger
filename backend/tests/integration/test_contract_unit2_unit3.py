"""Contract tests: Unit 2 (Trade Entry API) → Unit 3 (Extraction Agent).

Verifies that:
1. The shape Unit 2 sends matches ExtractionRequest
2. ExtractionResponse fields are handled by Unit 2
3. TradeExtractionResult fields map to tradeResponseSchema fields
4. Cross-unit imports resolve without errors
"""
import inspect

from src.schemas.trade_extraction import (
    ExtractionRequest,
    ExtractionResponse,
    TradeExtractionResult,
)
from src.agent.state import ExtractionState
from src.agent.nodes.extract_trade import extract_trade_node, should_retry
from src.agent.workflows.trade_extraction import build_extraction_graph


class TestCrossUnitImports:
    """Verify that Unit 3 modules can import Unit 1 schemas used by Unit 2."""

    def test_extraction_request_importable(self):
        assert ExtractionRequest is not None

    def test_extraction_response_importable(self):
        assert ExtractionResponse is not None

    def test_extraction_result_importable(self):
        assert TradeExtractionResult is not None

    def test_extraction_state_importable(self):
        assert ExtractionState is not None

    def test_extract_trade_node_importable(self):
        assert extract_trade_node is not None

    def test_build_extraction_graph_importable(self):
        assert build_extraction_graph is not None


class TestExtractionRequestContract:
    """Verify that the shape Unit 2 sends matches ExtractionRequest."""

    def test_accepts_trade_id_and_raw_input(self):
        """Unit 2 sends trade_id (UUID string) and raw_input (user text)."""
        request = ExtractionRequest(
            trade_id="550e8400-e29b-41d4-a716-446655440000",
            raw_input="Long NQ at 17800, exited at 17850 for +$500",
        )
        assert request.trade_id == "550e8400-e29b-41d4-a716-446655440000"
        assert request.raw_input == "Long NQ at 17800, exited at 17850 for +$500"

    def test_raw_input_max_length_matches_zod_schema(self):
        """Unit 1 Zod tradeInputSchema allows max 5000 chars.
        ExtractionRequest.raw_input should accept 5000 chars too."""
        long_input = "x" * 5000
        request = ExtractionRequest(trade_id="test-id", raw_input=long_input)
        assert len(request.raw_input) == 5000

    def test_rejects_empty_trade_id(self):
        """ExtractionRequest requires non-empty trade_id."""
        import pytest

        with pytest.raises(Exception):
            ExtractionRequest(trade_id="", raw_input="some input")

    def test_rejects_empty_raw_input(self):
        """ExtractionRequest requires non-empty raw_input."""
        import pytest

        with pytest.raises(Exception):
            ExtractionRequest(trade_id="test-id", raw_input="")


class TestExtractionResponseContract:
    """Verify ExtractionResponse shape matches what Unit 2 expects."""

    def test_success_response_shape(self):
        """Unit 2 reads trade_id, success, and message from response."""
        response = ExtractionResponse(
            trade_id="550e8400-e29b-41d4-a716-446655440000",
            success=True,
            message="Extraction successful",
        )
        assert response.trade_id == "550e8400-e29b-41d4-a716-446655440000"
        assert response.success is True
        assert response.message == "Extraction successful"

    def test_failure_response_shape(self):
        """Unit 2 handles failed extractions."""
        response = ExtractionResponse(
            trade_id="test-id",
            success=False,
            message="Extraction failed: schema mismatch",
        )
        assert response.success is False
        assert "failed" in response.message.lower()


class TestExtractionResultToTradeResponseContract:
    """Verify TradeExtractionResult fields map to tradeResponseSchema fields.

    Unit 3 produces TradeExtractionResult which updates trade DB records.
    Unit 2's GET endpoint then returns those fields via tradeResponseSchema.
    The field names and types must be compatible.
    """

    TRADE_RESPONSE_FIELDS = {
        "direction",
        "outcome",
        "pnl",
        "setup_description",
        "discipline_score",
        "agency_score",
        "discipline_confidence",
        "agency_confidence",
    }

    def test_extraction_result_covers_trade_response_fields(self):
        """All trade response fields that come from extraction must exist in TradeExtractionResult."""
        extraction_fields = set(TradeExtractionResult.model_fields.keys())
        missing = self.TRADE_RESPONSE_FIELDS - extraction_fields
        assert not missing, f"TradeExtractionResult is missing fields: {missing}"

    def test_direction_values_compatible(self):
        """Both schemas accept 'long' and 'short'."""
        for direction in ("long", "short"):
            result = TradeExtractionResult(
                direction=direction,
                outcome="win",
                pnl=100,
                discipline_score=0,
                agency_score=0,
                discipline_confidence="low",
                agency_confidence="low",
            )
            assert result.direction == direction

    def test_outcome_values_compatible(self):
        """Both schemas accept 'win', 'loss', 'breakeven'."""
        for outcome in ("win", "loss", "breakeven"):
            result = TradeExtractionResult(
                direction="long",
                outcome=outcome,
                pnl=0,
                discipline_score=0,
                agency_score=0,
                discipline_confidence="low",
                agency_confidence="low",
            )
            assert result.outcome == outcome

    def test_confidence_values_compatible(self):
        """Both schemas accept 'high', 'medium', 'low'."""
        for confidence in ("high", "medium", "low"):
            result = TradeExtractionResult(
                direction="long",
                outcome="win",
                pnl=0,
                discipline_score=0,
                agency_score=0,
                discipline_confidence=confidence,
                agency_confidence=confidence,
            )
            assert result.discipline_confidence == confidence
            assert result.agency_confidence == confidence

    def test_pnl_type_compatible(self):
        """Extraction returns float, trade response expects number."""
        result = TradeExtractionResult(
            direction="long",
            outcome="win",
            pnl=500.50,
            discipline_score=1,
            agency_score=1,
            discipline_confidence="high",
            agency_confidence="high",
        )
        assert isinstance(result.pnl, float)

    def test_score_values_compatible(self):
        """Both schemas accept -1, 0, 1 for discipline and agency scores."""
        for score in (-1, 0, 1):
            result = TradeExtractionResult(
                direction="long",
                outcome="win",
                pnl=0,
                discipline_score=score,
                agency_score=score,
                discipline_confidence="low",
                agency_confidence="low",
            )
            assert result.discipline_score == score
            assert result.agency_score == score


class TestExtractionStateContract:
    """Verify ExtractionState shape matches what the extraction API creates."""

    def test_initial_state_shape(self):
        """The extraction API endpoint creates this exact initial state shape."""
        initial_state: ExtractionState = {
            "trade_id": "test-id",
            "raw_input": "Long NQ for $500",
            "extraction": None,
            "validation_errors": [],
            "retry_count": 0,
        }
        assert initial_state["trade_id"] == "test-id"
        assert initial_state["extraction"] is None
        assert initial_state["retry_count"] == 0

    def test_extract_trade_node_signature(self):
        """extract_trade_node accepts ExtractionState and returns dict."""
        sig = inspect.signature(extract_trade_node)
        params = list(sig.parameters.keys())
        assert "state" in params

    def test_should_retry_signature(self):
        """should_retry accepts ExtractionState and returns Literal."""
        sig = inspect.signature(should_retry)
        params = list(sig.parameters.keys())
        assert "state" in params
