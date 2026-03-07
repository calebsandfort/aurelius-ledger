"""Contract tests: Unit 3 (Extraction Agent) → Unit 4 (Insights Agent).

Verifies that:
1. TradeExtractionResult output shape satisfies what insight detection functions expect
2. The trade dict format used by insights matches what extraction produces
3. Cross-unit imports resolve without errors
"""
from src.schemas.trade_extraction import TradeExtractionResult
from src.schemas.insights import Insight, InsightsResponse
from src.agent.nodes.generate_insights import (
    InsightsAgentState,
    detect_tilt_risk,
    detect_overconfidence,
    detect_session_fatigue,
    detect_discipline_trajectory,
    detect_agency_breakdown,
    detect_streak_recognition,
    detect_recovery_pattern,
    generate_rule_based_insights,
    generate_insights_node,
)
from src.agent.workflows.insights_caching import (
    generate_cache_key,
    should_regenerate,
    calculate_debounce_delay,
    InsightsCache,
)


class TestCrossUnitImports:
    """Verify that Unit 3 schemas and Unit 4 modules can coexist."""

    def test_extraction_result_and_insight_importable_together(self):
        assert TradeExtractionResult is not None
        assert Insight is not None
        assert InsightsResponse is not None

    def test_insights_agent_state_importable(self):
        assert InsightsAgentState is not None

    def test_insight_detection_functions_importable(self):
        assert detect_tilt_risk is not None
        assert detect_overconfidence is not None
        assert detect_discipline_trajectory is not None

    def test_insights_caching_importable(self):
        assert generate_cache_key is not None
        assert should_regenerate is not None
        assert InsightsCache is not None


class TestExtractionOutputToInsightsInput:
    """Verify that TradeExtractionResult fields satisfy insight detection expectations.

    Unit 4's detection functions expect trade dicts with keys like:
    'outcome', 'discipline_score', 'agency_score', 'timestamp'.

    Unit 3 produces TradeExtractionResult with: direction, outcome, pnl,
    setup_description, discipline_score, agency_score, discipline_confidence,
    agency_confidence, behavioral_signals.

    The trade records stored in DB and passed to insights include additional
    fields like 'timestamp' from the database layer.
    """

    def _make_trade_dict_from_extraction(
        self,
        extraction: TradeExtractionResult,
        trade_id: str = "test-trade-1",
        timestamp: str = "2024-01-15T10:30:00Z",
    ) -> dict:
        """Convert TradeExtractionResult to the trade dict format insights expects.

        This simulates the DB storage → retrieval path.
        """
        return {
            "id": trade_id,
            "direction": extraction.direction,
            "outcome": extraction.outcome,
            "pnl": extraction.pnl,
            "setup_description": extraction.setup_description,
            "discipline_score": extraction.discipline_score,
            "agency_score": extraction.agency_score,
            "discipline_confidence": extraction.discipline_confidence,
            "agency_confidence": extraction.agency_confidence,
            "timestamp": timestamp,
        }

    def test_tilt_risk_detection_with_extraction_output(self):
        """Tilt risk: 2+ consecutive losses with discipline -1."""
        loss_trade = TradeExtractionResult(
            direction="short",
            outcome="loss",
            pnl=-200,
            discipline_score=-1,
            agency_score=0,
            discipline_confidence="high",
            agency_confidence="low",
        )

        trades = [
            self._make_trade_dict_from_extraction(loss_trade, "t1", "2024-01-15T10:00:00Z"),
            self._make_trade_dict_from_extraction(loss_trade, "t2", "2024-01-15T10:10:00Z"),
        ]

        assert detect_tilt_risk(trades) is True

    def test_overconfidence_detection_with_extraction_output(self):
        """Overconfidence: 3+ consecutive wins with discipline +1."""
        win_trade = TradeExtractionResult(
            direction="long",
            outcome="win",
            pnl=500,
            discipline_score=1,
            agency_score=1,
            discipline_confidence="high",
            agency_confidence="high",
        )

        trades = [
            self._make_trade_dict_from_extraction(win_trade, f"t{i}", f"2024-01-15T10:{i*10:02d}:00Z")
            for i in range(3)
        ]

        assert detect_overconfidence(trades) is True

    def test_discipline_trajectory_with_extraction_output(self):
        """Discipline trajectory: 3 consecutive -1 scores."""
        undisciplined = TradeExtractionResult(
            direction="long",
            outcome="loss",
            pnl=-100,
            discipline_score=-1,
            agency_score=0,
            discipline_confidence="high",
            agency_confidence="low",
        )

        trades = [
            self._make_trade_dict_from_extraction(undisciplined, f"t{i}")
            for i in range(3)
        ]

        assert detect_discipline_trajectory(trades) is True

    def test_agency_breakdown_with_extraction_output(self):
        """Agency breakdown: agency -1 on latest trade."""
        passive_trade = TradeExtractionResult(
            direction="short",
            outcome="loss",
            pnl=-300,
            discipline_score=0,
            agency_score=-1,
            discipline_confidence="medium",
            agency_confidence="high",
        )

        trades = [self._make_trade_dict_from_extraction(passive_trade)]
        assert detect_agency_breakdown(trades) is True

    def test_streak_recognition_with_extraction_output(self):
        """Streak: 3+ consecutive wins."""
        win_trade = TradeExtractionResult(
            direction="long",
            outcome="win",
            pnl=200,
            discipline_score=1,
            agency_score=1,
            discipline_confidence="high",
            agency_confidence="high",
        )

        trades = [
            self._make_trade_dict_from_extraction(win_trade, f"t{i}")
            for i in range(3)
        ]

        assert detect_streak_recognition(trades) is True

    def test_recovery_pattern_with_extraction_output(self):
        """Recovery: loss followed by win with positive discipline."""
        loss_trade = TradeExtractionResult(
            direction="short",
            outcome="loss",
            pnl=-200,
            discipline_score=-1,
            agency_score=0,
            discipline_confidence="high",
            agency_confidence="low",
        )
        recovery_trade = TradeExtractionResult(
            direction="long",
            outcome="win",
            pnl=300,
            discipline_score=1,
            agency_score=1,
            discipline_confidence="high",
            agency_confidence="high",
        )

        trades = [
            self._make_trade_dict_from_extraction(loss_trade, "t1"),
            self._make_trade_dict_from_extraction(recovery_trade, "t2"),
        ]

        assert detect_recovery_pattern(trades) is True

    def test_rule_based_insights_return_valid_insight_objects(self):
        """generate_rule_based_insights returns List[Insight] that InsightsResponse accepts."""
        loss_trade = TradeExtractionResult(
            direction="short",
            outcome="loss",
            pnl=-200,
            discipline_score=-1,
            agency_score=-1,
            discipline_confidence="high",
            agency_confidence="high",
        )

        trades = [
            self._make_trade_dict_from_extraction(loss_trade, f"t{i}")
            for i in range(3)
        ]

        insights = generate_rule_based_insights(trades)

        # Each insight must be a valid Insight object
        for insight in insights:
            assert isinstance(insight, Insight)
            assert insight.category in ("risk", "pattern", "positive")
            assert len(insight.message) > 0
            if insight.severity is not None:
                assert insight.severity in ("warning", "info", "success")

        # Insights must fit into InsightsResponse (max 3)
        response = InsightsResponse(
            insights=insights[:3],
            generated_at="2024-01-15T10:30:00+00:00",
            trade_count=3,
        )
        assert len(response.insights) <= 3


class TestInsightsStateContract:
    """Verify InsightsAgentState shape matches what the API creates."""

    def test_state_accepts_trade_dicts_from_extraction(self):
        """The insights API creates InsightsAgentState with trade dicts."""
        extraction = TradeExtractionResult(
            direction="long",
            outcome="win",
            pnl=500,
            discipline_score=1,
            agency_score=1,
            discipline_confidence="high",
            agency_confidence="high",
        )

        trade_dict = {
            "id": "trade-1",
            "direction": extraction.direction,
            "outcome": extraction.outcome,
            "pnl": extraction.pnl,
            "discipline_score": extraction.discipline_score,
            "agency_score": extraction.agency_score,
            "timestamp": "2024-01-15T10:30:00Z",
        }

        state: InsightsAgentState = {
            "session_id": "session-1",
            "trades": [trade_dict],
            "session_summary": {
                "total_trades": 1,
                "win_count": 1,
                "loss_count": 0,
                "total_pnl": 500.0,
            },
            "trade_count": 1,
            "insights": None,
        }

        assert state["trade_count"] == 1
        assert len(state["trades"]) == 1
        assert state["trades"][0]["outcome"] == "win"


class TestInsightsCacheKeyContract:
    """Verify cache key generation works with extraction-derived trade dicts."""

    def test_cache_key_with_extraction_output(self):
        """generate_cache_key accepts trade dicts from extraction output."""
        trade_dicts = [
            {
                "id": f"trade-{i}",
                "direction": "long",
                "outcome": "win",
                "pnl": 100 * (i + 1),
                "discipline_score": 1,
                "agency_score": 1,
            }
            for i in range(3)
        ]

        key = generate_cache_key("session-1", trade_dicts, 3)
        assert key.startswith("insights:session-1:3:")
        assert len(key) > len("insights:session-1:3:")
