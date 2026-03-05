"""Tests for insights schemas."""
import pytest
from datetime import datetime
from pydantic import ValidationError

from src.schemas.insights import Insight, InsightsResponse


class TestInsight:
    """Tests for Insight schema."""

    def test_valid_risk_insight(self):
        """Test valid risk category insight."""
        insight = Insight(
            category="risk",
            message="High correlation between revenge trades and account drawdown",
            severity="warning",
        )
        assert insight.category == "risk"
        assert insight.message == "High correlation between revenge trades and account drawdown"
        assert insight.severity == "warning"

    def test_valid_pattern_insight(self):
        """Test valid pattern category insight."""
        insight = Insight(
            category="pattern",
            message="You tend to trade more actively during volatile market sessions",
            severity="info",
        )
        assert insight.category == "pattern"
        assert insight.severity == "info"

    def test_valid_positive_insight(self):
        """Test valid positive category insight."""
        insight = Insight(
            category="positive",
            message="Excellent discipline score on pullback entries this week",
            severity="success",
        )
        assert insight.category == "positive"
        assert insight.severity == "success"

    def test_valid_optional_severity(self):
        """Test insight without severity (optional field)."""
        insight = Insight(
            category="pattern",
            message="Some observation without explicit severity",
        )
        assert insight.severity is None

    def test_valid_max_message_length(self):
        """Test insight with max length message (500 chars)."""
        insight = Insight(
            category="pattern",
            message="x" * 500,
        )
        assert len(insight.message) == 500

    def test_invalid_message_too_long(self):
        """Test rejection of message over 500 characters."""
        with pytest.raises(ValidationError) as exc_info:
            Insight(
                category="pattern",
                message="x" * 501,
            )
        # Pydantic V2 returns "string_too_long" for max_length violations
        assert "string_too_long" in str(exc_info.value)

    def test_invalid_empty_category(self):
        """Test rejection of empty category."""
        with pytest.raises(ValidationError):
            Insight(
                category="",
                message="Some message",
            )

    def test_invalid_empty_message(self):
        """Test rejection of empty message."""
        with pytest.raises(ValidationError):
            Insight(
                category="pattern",
                message="",
            )

    def test_invalid_severity(self):
        """Test acceptance of any severity value (free-form string)."""
        # Severity is Optional[str], so any string is accepted
        insight = Insight(
            category="pattern",
            message="Some message",
            severity="invalid",
        )
        assert insight.severity == "invalid"


class TestInsightsResponse:
    """Tests for InsightsResponse schema."""

    def test_valid_insights_response(self):
        """Test valid insights response with multiple insights."""
        response = InsightsResponse(
            insights=[
                Insight(
                    category="risk",
                    message="High correlation between revenge trades and account drawdown",
                    severity="warning",
                ),
                Insight(
                    category="positive",
                    message="Excellent discipline score on pullback entries this week",
                    severity="success",
                ),
            ],
            generated_at="2024-01-15T10:30:00Z",
            trade_count=5,
        )
        assert len(response.insights) == 2
        assert response.trade_count == 5

    def test_valid_single_insight(self):
        """Test valid insights response with single insight."""
        response = InsightsResponse(
            insights=[
                Insight(
                    category="pattern",
                    message="You tend to trade more actively during volatile market sessions",
                ),
            ],
            generated_at="2024-01-15T10:30:00Z",
            trade_count=1,
        )
        assert len(response.insights) == 1
        assert response.trade_count == 1

    def test_valid_max_insights(self):
        """Test valid insights response with max 3 insights."""
        response = InsightsResponse(
            insights=[
                Insight(category="risk", message="Message 1", severity="warning"),
                Insight(category="pattern", message="Message 2", severity="info"),
                Insight(category="positive", message="Message 3", severity="success"),
            ],
            generated_at="2024-01-15T10:30:00Z",
            trade_count=10,
        )
        assert len(response.insights) == 3

    def test_valid_zero_trade_count(self):
        """Test valid insights response with zero trades."""
        response = InsightsResponse(
            insights=[],
            generated_at="2024-01-15T10:30:00Z",
            trade_count=0,
        )
        assert response.trade_count == 0

    def test_valid_iso_timestamp(self):
        """Test insights response with ISO timestamp."""
        timestamp = datetime.now().isoformat()
        response = InsightsResponse(
            insights=[],
            generated_at=timestamp,
            trade_count=0,
        )
        assert response.generated_at == timestamp

    def test_invalid_negative_trade_count(self):
        """Test rejection of negative trade_count."""
        with pytest.raises(ValidationError) as exc_info:
            InsightsResponse(
                insights=[],
                generated_at="2024-01-15T10:30:00Z",
                trade_count=-1,
            )
        assert "greater than or equal to 0" in str(exc_info.value)

    def test_invalid_empty_insights_list(self):
        """Test valid response with empty insights list."""
        response = InsightsResponse(
            insights=[],
            generated_at="2024-01-15T10:30:00Z",
            trade_count=0,
        )
        assert response.insights == []

    def test_invalid_missing_generated_at(self):
        """Test rejection when generated_at is missing."""
        with pytest.raises(ValidationError):
            InsightsResponse(
                insights=[],
                trade_count=5,
            )

    def test_invalid_missing_trade_count(self):
        """Test rejection when trade_count is missing."""
        with pytest.raises(ValidationError):
            InsightsResponse(
                insights=[],
                generated_at="2024-01-15T10:30:00Z",
            )
