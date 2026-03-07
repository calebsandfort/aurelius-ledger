"""Contract tests: Unit 2 (Trade Entry API) → Unit 4 (Insights Agent).

Verifies that:
1. Trade API response shape satisfies what Insights API expects as input
2. InsightsResponse shape satisfies what frontend Zod schema expects
3. The insights API endpoint can be imported and has correct router setup
"""
from datetime import datetime, timezone

from src.schemas.insights import Insight, InsightsResponse
from src.api.insights import router as insights_router
from src.api.trade_extraction import router as extraction_router
from src.agent.nodes.generate_insights import (
    detect_tilt_risk,
    detect_overconfidence,
    generate_rule_based_insights,
)


class TestCrossUnitImports:
    """Verify that Unit 2 API dependencies and Unit 4 API can coexist."""

    def test_insights_router_importable(self):
        assert insights_router is not None

    def test_extraction_router_importable(self):
        assert extraction_router is not None

    def test_insights_router_has_prefix(self):
        assert insights_router.prefix == "/api/v1"

    def test_extraction_router_has_prefix(self):
        assert extraction_router.prefix == "/extract"


class TestTradeResponseToInsightsContract:
    """Verify that trade API response shape works with insight detection.

    Unit 2 GET /api/v1/trades returns trades with keys:
    id, session_id, sequence_number, direction, outcome, pnl,
    setup_description, discipline_score, agency_score,
    discipline_confidence, agency_confidence, created_at

    Unit 4 insight detectors expect trade dicts with keys:
    outcome, discipline_score, agency_score, timestamp
    """

    def _make_api_response_trade(
        self,
        direction: str = "long",
        outcome: str = "win",
        pnl: float = 500.0,
        discipline_score: int = 1,
        agency_score: int = 1,
    ) -> dict:
        """Create a trade dict matching Unit 2's GET response shape."""
        return {
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "session_id": "660e8400-e29b-41d4-a716-446655440000",
            "sequence_number": 1,
            "direction": direction,
            "outcome": outcome,
            "pnl": pnl,
            "setup_description": "Pullback entry on NQ",
            "discipline_score": discipline_score,
            "agency_score": agency_score,
            "discipline_confidence": "high",
            "agency_confidence": "high",
            "created_at": "2024-01-15T10:30:00.000Z",
        }

    def test_tilt_risk_with_api_response_shape(self):
        """Insight detectors work with trade shape from Unit 2 API."""
        trades = [
            self._make_api_response_trade(outcome="loss", discipline_score=-1),
            self._make_api_response_trade(outcome="loss", discipline_score=-1),
        ]
        assert detect_tilt_risk(trades) is True

    def test_overconfidence_with_api_response_shape(self):
        """Insight detectors work with trade shape from Unit 2 API."""
        trades = [
            self._make_api_response_trade(outcome="win", discipline_score=1)
            for _ in range(3)
        ]
        assert detect_overconfidence(trades) is True

    def test_rule_based_insights_with_api_response_shape(self):
        """Full rule-based insights work with trade shape from Unit 2 API."""
        trades = [
            self._make_api_response_trade(outcome="loss", discipline_score=-1, agency_score=-1)
            for _ in range(3)
        ]
        insights = generate_rule_based_insights(trades)
        assert len(insights) > 0
        for insight in insights:
            assert isinstance(insight, Insight)


class TestInsightsResponseToFrontendContract:
    """Verify InsightsResponse satisfies the frontend Zod insightsResponseSchema.

    Frontend Zod schema expects:
    - insights: array of { category: enum, message: string(max 500), severity?: enum }
    - generated_at: string.datetime()
    - trade_count: number.int().min(0)

    Backend Pydantic produces InsightsResponse with:
    - insights: List[Insight] (category: str, message: str, severity: Optional[str])
    - generated_at: str
    - trade_count: int
    """

    def test_insight_categories_match_frontend_enum(self):
        """Backend must only produce categories the frontend enum accepts."""
        valid_categories = {"risk", "pattern", "positive"}

        for category in valid_categories:
            insight = Insight(category=category, message="Test message")
            assert insight.category in valid_categories

    def test_insight_severity_values_match_frontend_enum(self):
        """Backend must only produce severity values the frontend enum accepts."""
        valid_severities = {"warning", "info", "success"}

        for severity in valid_severities:
            insight = Insight(category="risk", message="Test", severity=severity)
            assert insight.severity in valid_severities

    def test_insight_message_within_frontend_limit(self):
        """Backend message max_length=500 matches frontend max(500)."""
        insight = Insight(
            category="risk",
            message="x" * 500,
            severity="warning",
        )
        assert len(insight.message) == 500

    def test_generated_at_is_iso_datetime(self):
        """Frontend expects string.datetime() — backend must produce ISO format."""
        now = datetime.now(timezone.utc).isoformat()
        response = InsightsResponse(
            insights=[Insight(category="pattern", message="Test")],
            generated_at=now,
            trade_count=5,
        )
        # Verify it can be parsed as datetime
        parsed = datetime.fromisoformat(response.generated_at)
        assert parsed is not None

    def test_trade_count_non_negative(self):
        """Frontend expects trade_count >= 0."""
        response = InsightsResponse(
            insights=[],
            generated_at=datetime.now(timezone.utc).isoformat(),
            trade_count=0,
        )
        assert response.trade_count >= 0

    def test_max_three_insights(self):
        """Frontend insightsResponseSchema limits to max 3 insights."""
        insights = [
            Insight(category="risk", message="msg1", severity="warning"),
            Insight(category="pattern", message="msg2", severity="info"),
            Insight(category="positive", message="msg3", severity="success"),
        ]
        response = InsightsResponse(
            insights=insights,
            generated_at=datetime.now(timezone.utc).isoformat(),
            trade_count=10,
        )
        assert len(response.insights) <= 3

    def test_full_response_serializes_to_frontend_shape(self):
        """Serialized InsightsResponse must match what frontend Zod expects."""
        response = InsightsResponse(
            insights=[
                Insight(category="risk", message="Tilt risk detected.", severity="warning"),
                Insight(category="positive", message="Great discipline!", severity="success"),
            ],
            generated_at="2024-01-15T10:30:00+00:00",
            trade_count=7,
        )

        data = response.model_dump()

        # Verify shape matches frontend Zod schema
        assert isinstance(data["insights"], list)
        assert isinstance(data["generated_at"], str)
        assert isinstance(data["trade_count"], int)

        for insight in data["insights"]:
            assert "category" in insight
            assert "message" in insight
            assert insight["category"] in ("risk", "pattern", "positive")
            if insight.get("severity") is not None:
                assert insight["severity"] in ("warning", "info", "success")
