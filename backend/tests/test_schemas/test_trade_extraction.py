"""Tests for trade_extraction schemas."""
import pytest
from pydantic import ValidationError

from src.schemas.trade_extraction import (
    TradeExtractionResult,
    ExtractionRequest,
    ExtractionResponse,
)


class TestTradeExtractionResult:
    """Tests for TradeExtractionResult schema."""

    def test_valid_long_win_trade(self):
        """Test valid long win trade with all fields."""
        result = TradeExtractionResult(
            direction="long",
            outcome="win",
            pnl=500.0,
            setup_description="Pullback to EMA support",
            discipline_score=1,
            agency_score=1,
            discipline_confidence="high",
            agency_confidence="high",
            behavioral_signals=["patience", "discipline"],
        )
        assert result.direction == "long"
        assert result.outcome == "win"
        assert result.pnl == 500.0
        assert result.discipline_score == 1

    def test_valid_short_loss_trade(self):
        """Test valid short loss trade."""
        result = TradeExtractionResult(
            direction="short",
            outcome="loss",
            pnl=-250.0,
            setup_description="Resistance rejection",
            discipline_score=0,
            agency_score=-1,
            discipline_confidence="medium",
            agency_confidence="low",
            behavioral_signals=["revenge_trading"],
        )
        assert result.direction == "short"
        assert result.outcome == "loss"
        assert result.pnl == -250.0

    def test_valid_breakeven_trade(self):
        """Test valid breakeven trade."""
        result = TradeExtractionResult(
            direction="long",
            outcome="breakeven",
            pnl=0.0,
            discipline_score=1,
            agency_score=0,
            discipline_confidence="high",
            agency_confidence="medium",
            behavioral_signals=[],
        )
        assert result.outcome == "breakeven"
        assert result.pnl == 0.0

    def test_valid_min_pnl(self):
        """Test valid trade with minimum PnL (-10000)."""
        result = TradeExtractionResult(
            direction="short",
            outcome="loss",
            pnl=-10000.0,
            discipline_score=-1,
            agency_score=-1,
            discipline_confidence="low",
            agency_confidence="low",
            behavioral_signals=[],
        )
        assert result.pnl == -10000.0

    def test_valid_max_pnl(self):
        """Test valid trade with maximum PnL (10000)."""
        result = TradeExtractionResult(
            direction="long",
            outcome="win",
            pnl=10000.0,
            discipline_score=1,
            agency_score=1,
            discipline_confidence="high",
            agency_confidence="high",
            behavioral_signals=[],
        )
        assert result.pnl == 10000.0

    def test_valid_optional_setup_description(self):
        """Test trade without optional setup_description."""
        result = TradeExtractionResult(
            direction="long",
            outcome="win",
            pnl=100.0,
            discipline_score=1,
            agency_score=1,
            discipline_confidence="high",
            agency_confidence="high",
        )
        assert result.setup_description is None

    def test_valid_empty_behavioral_signals(self):
        """Test trade with empty behavioral_signals list."""
        result = TradeExtractionResult(
            direction="long",
            outcome="win",
            pnl=100.0,
            discipline_score=1,
            agency_score=1,
            discipline_confidence="high",
            agency_confidence="high",
            behavioral_signals=[],
        )
        assert result.behavioral_signals == []

    def test_invalid_pnl_below_minimum(self):
        """Test rejection of PnL below -10000."""
        with pytest.raises(ValidationError) as exc_info:
            TradeExtractionResult(
                direction="long",
                outcome="win",
                pnl=-10001.0,
                discipline_score=1,
                agency_score=1,
                discipline_confidence="high",
                agency_confidence="high",
            )
        assert "greater than or equal to -10000" in str(exc_info.value)

    def test_invalid_pnl_above_maximum(self):
        """Test rejection of PnL above 10000."""
        with pytest.raises(ValidationError) as exc_info:
            TradeExtractionResult(
                direction="long",
                outcome="win",
                pnl=10001.0,
                discipline_score=1,
                agency_score=1,
                discipline_confidence="high",
                agency_confidence="high",
            )
        assert "less than or equal to 10000" in str(exc_info.value)

    def test_invalid_direction(self):
        """Test rejection of invalid direction."""
        with pytest.raises(ValidationError):
            TradeExtractionResult(
                direction="invalid",  # type: ignore
                outcome="win",
                pnl=500.0,
                discipline_score=1,
                agency_score=1,
                discipline_confidence="high",
                agency_confidence="high",
            )

    def test_invalid_outcome(self):
        """Test rejection of invalid outcome."""
        with pytest.raises(ValidationError):
            TradeExtractionResult(
                direction="long",
                outcome="invalid",  # type: ignore
                pnl=500.0,
                discipline_score=1,
                agency_score=1,
                discipline_confidence="high",
                agency_confidence="high",
            )

    def test_invalid_discipline_score_below_min(self):
        """Test rejection of discipline_score below -1."""
        with pytest.raises(ValidationError) as exc_info:
            TradeExtractionResult(
                direction="long",
                outcome="win",
                pnl=500.0,
                discipline_score=-2,
                agency_score=1,
                discipline_confidence="high",
                agency_confidence="high",
            )
        assert "greater than or equal to -1" in str(exc_info.value)

    def test_invalid_discipline_score_above_max(self):
        """Test rejection of discipline_score above 1."""
        with pytest.raises(ValidationError) as exc_info:
            TradeExtractionResult(
                direction="long",
                outcome="win",
                pnl=500.0,
                discipline_score=2,
                agency_score=1,
                discipline_confidence="high",
                agency_confidence="high",
            )
        assert "less than or equal to 1" in str(exc_info.value)

    def test_invalid_agency_score_below_min(self):
        """Test rejection of agency_score below -1."""
        with pytest.raises(ValidationError) as exc_info:
            TradeExtractionResult(
                direction="long",
                outcome="win",
                pnl=500.0,
                discipline_score=1,
                agency_score=-2,
                discipline_confidence="high",
                agency_confidence="high",
            )
        assert "greater than or equal to -1" in str(exc_info.value)

    def test_invalid_discipline_confidence(self):
        """Test rejection of invalid discipline_confidence."""
        with pytest.raises(ValidationError):
            TradeExtractionResult(
                direction="long",
                outcome="win",
                pnl=500.0,
                discipline_score=1,
                agency_score=1,
                discipline_confidence="invalid",  # type: ignore
                agency_confidence="high",
            )

    def test_invalid_agency_confidence(self):
        """Test rejection of invalid agency_confidence."""
        with pytest.raises(ValidationError):
            TradeExtractionResult(
                direction="long",
                outcome="win",
                pnl=500.0,
                discipline_score=1,
                agency_score=1,
                discipline_confidence="high",
                agency_confidence="invalid",  # type: ignore
            )

    def test_invalid_setup_description_too_long(self):
        """Test rejection of setup_description over 2000 characters."""
        with pytest.raises(ValidationError) as exc_info:
            TradeExtractionResult(
                direction="long",
                outcome="win",
                pnl=500.0,
                setup_description="x" * 2001,
                discipline_score=1,
                agency_score=1,
                discipline_confidence="high",
                agency_confidence="high",
            )
        # Pydantic V2 returns "string_too_long" for max_length violations
        assert "string_too_long" in str(exc_info.value)


class TestExtractionRequest:
    """Tests for ExtractionRequest schema."""

    def test_valid_extraction_request(self):
        """Test valid extraction request."""
        request = ExtractionRequest(
            trade_id="550e8400-e29b-41d4-a716-446655440000",
            raw_input="Long NQ at 15000, hit target +$500. Good patience waiting for pullback.",
        )
        assert request.trade_id == "550e8400-e29b-41d4-a716-446655440000"
        assert request.raw_input == "Long NQ at 15000, hit target +$500. Good patience waiting for pullback."

    def test_valid_max_length_raw_input(self):
        """Test valid extraction request with max length raw_input."""
        request = ExtractionRequest(
            trade_id="550e8400-e29b-41d4-a716-446655440000",
            raw_input="x" * 5000,
        )
        assert len(request.raw_input) == 5000

    def test_valid_min_length_raw_input(self):
        """Test valid extraction request with min length raw_input."""
        request = ExtractionRequest(
            trade_id="550e8400-e29b-41d4-a716-446655440000",
            raw_input="a",
        )
        assert len(request.raw_input) == 1

    def test_invalid_empty_raw_input(self):
        """Test rejection of empty raw_input."""
        with pytest.raises(ValidationError) as exc_info:
            ExtractionRequest(
                trade_id="550e8400-e29b-41d4-a716-446655440000",
                raw_input="",
            )
        # Pydantic V2 returns "string_too_short" for min_length violations
        assert "string_too_short" in str(exc_info.value)

    def test_invalid_raw_input_too_long(self):
        """Test rejection of raw_input over 5000 characters."""
        with pytest.raises(ValidationError) as exc_info:
            ExtractionRequest(
                trade_id="550e8400-e29b-41d4-a716-446655440000",
                raw_input="x" * 5001,
            )
        # Pydantic V2 returns "string_too_long" for max_length violations
        assert "string_too_long" in str(exc_info.value)

    def test_invalid_empty_trade_id(self):
        """Test rejection of empty trade_id."""
        with pytest.raises(ValidationError):
            ExtractionRequest(
                trade_id="",
                raw_input="Some trade description",
            )


class TestExtractionResponse:
    """Tests for ExtractionResponse schema."""

    def test_valid_successful_response(self):
        """Test successful extraction response."""
        response = ExtractionResponse(
            trade_id="550e8400-e29b-41d4-a716-446655440000",
            success=True,
            message="Trade extracted successfully",
        )
        assert response.trade_id == "550e8400-e29b-41d4-a716-446655440000"
        assert response.success is True
        assert response.message == "Trade extracted successfully"

    def test_valid_failed_response(self):
        """Test failed extraction response."""
        response = ExtractionResponse(
            trade_id="550e8400-e29b-41d4-a716-446655440000",
            success=False,
            message="Failed to extract trade data",
        )
        assert response.success is False
        assert response.message == "Failed to extract trade data"

    def test_missing_required_fields(self):
        """Test rejection when required fields are missing."""
        with pytest.raises(ValidationError):
            ExtractionResponse(
                trade_id="550e8400-e29b-41d4-a716-446655440000",
            )
