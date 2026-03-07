"""Tests for Insights Agent (Unit 4).

Tests verify the following FRs:
- FR 5.0: Insights Generation
- FR 5.2: Insights Generation Timing
- FR 5.3: Insights Regeneration Strategy
- FR 5.4: Small Session Insights
- FR 5.5: Insight Categories
"""
import json
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pydantic import ValidationError

from src.schemas.insights import Insight, InsightsResponse


# ============================================================================
# FR 5.3 - Insights Regeneration Strategy
# ============================================================================


class TestCacheKeyGeneration:
    """Tests for cache key generation (FR 5.3.3)."""

    def test_fr_5_3_3_cache_key_includes_session_id(self):
        """Test cache key includes session ID."""
        from src.agent.workflows.insights_caching import generate_cache_key

        key = generate_cache_key("session-123", [], 0)
        assert "session-123" in key

    def test_fr_5_3_3_cache_key_includes_trade_count(self):
        """Test cache key includes trade count."""
        from src.agent.workflows.insights_caching import generate_cache_key

        key = generate_cache_key("session-123", [], 5)
        assert "5" in key

    def test_fr_5_3_3_cache_key_uses_last_3_trades_hash(self):
        """Test cache key changes when last 3 trades change."""
        from src.agent.workflows.insights_caching import generate_cache_key

        trades1 = [
            {"id": 1, "direction": "long", "outcome": "win", "pnl": 100},
            {"id": 2, "direction": "short", "outcome": "loss", "pnl": -50},
            {"id": 3, "direction": "long", "outcome": "win", "pnl": 75},
        ]
        trades2 = [
            {"id": 1, "direction": "long", "outcome": "win", "pnl": 100},
            {"id": 2, "direction": "short", "outcome": "loss", "pnl": -50},
            {"id": 3, "direction": "long", "outcome": "loss", "pnl": -25},  # Different
        ]

        key1 = generate_cache_key("session-123", trades1, 3)
        key2 = generate_cache_key("session-123", trades2, 3)

        assert key1 != key2

    def test_fr_5_3_3_cache_key_same_for_identical_trades(self):
        """Test cache key stays same for identical trade data."""
        from src.agent.workflows.insights_caching import generate_cache_key

        trades = [
            {"id": 1, "direction": "long", "outcome": "win", "pnl": 100},
            {"id": 2, "direction": "short", "outcome": "loss", "pnl": -50},
        ]

        key1 = generate_cache_key("session-123", trades, 2)
        key2 = generate_cache_key("session-123", trades, 2)

        assert key1 == key2

    def test_fr_5_3_3_cache_key_handles_fewer_than_3_trades(self):
        """Test cache key works with fewer than 3 trades."""
        from src.agent.workflows.insights_caching import generate_cache_key

        key = generate_cache_key("session-123", [{"id": 1, "outcome": "win"}], 1)
        assert "session-123" in key


class TestShouldRegenerate:
    """Tests for regeneration decision (FR 5.3.4)."""

    def test_fr_5_3_4_regenerate_when_trade_count_changes(self):
        """Test regeneration when trade count changes."""
        from src.agent.workflows.insights_caching import should_regenerate

        cached = InsightsResponse(
            insights=[Insight(category="pattern", message="Test")],
            generated_at="2024-01-15T10:30:00Z",
            trade_count=5,
        )

        result = should_regenerate(cached, 6, "2024-01-15T10:35:00")
        assert result is True

    def test_fr_5_3_4_regenerate_when_last_trade_time_changes(self):
        """Test regeneration when last trade time changes."""
        from src.agent.workflows.insights_caching import should_regenerate

        cached = InsightsResponse(
            insights=[Insight(category="pattern", message="Test")],
            generated_at="2024-01-15T10:30:00Z",
            trade_count=5,
        )

        # Same trade count but later timestamp
        result = should_regenerate(cached, 5, "2024-01-15T10:35:00")
        assert result is True

    def test_fr_5_3_4_no_regenerate_when_same(self):
        """Test no regeneration when nothing changed."""
        from src.agent.workflows.insights_caching import should_regenerate

        cached = InsightsResponse(
            insights=[Insight(category="pattern", message="Test")],
            generated_at="2024-01-15T10:30:00Z",
            trade_count=5,
        )

        result = should_regenerate(cached, 5, "2024-01-15T10:30:00")
        assert result is False


# ============================================================================
# FR 5.4 - Small Session Insights
# ============================================================================


class TestSmallSessionMessages:
    """Tests for small session message logic (FR 5.4)."""

    def test_fr_5_4_welcome_message_zero_trades(self):
        """Test welcome message for 0 trades (FR 5.4.1)."""
        from src.agent.nodes.generate_insights import get_small_session_message

        message = get_small_session_message(0)
        assert "Welcome" in message or "welcome" in message

    def test_fr_5_4_initial_assessment_one_trade(self):
        """Test initial assessment for 1 trade."""
        from src.agent.nodes.generate_insights import get_small_session_message

        message = get_small_session_message(1)
        assert len(message) > 0

    def test_fr_5_4_encouraging_for_2_4_trades(self):
        """Test encouraging messages for 2-4 trades (FR 5.4.1)."""
        from src.agent.nodes.generate_insights import get_small_session_message

        for count in [2, 3, 4]:
            message = get_small_session_message(count)
            assert len(message) > 0

    def test_fr_5_4_not_behavioral_under_5_trades(self):
        """Test NOT generating behavioral insights for <5 trades (FR 5.4.2)."""
        from src.agent.nodes.generate_insights import should_generate_ai_insights

        # Should NOT generate AI insights for < 5 trades
        assert should_generate_ai_insights(0) is False
        assert should_generate_ai_insights(1) is False
        assert should_generate_ai_insights(2) is False
        assert should_generate_ai_insights(3) is False
        assert should_generate_ai_insights(4) is False

    def test_fr_5_4_ai_insights_5_plus_trades(self):
        """Test AI insights generated for 5+ trades."""
        from src.agent.nodes.generate_insights import should_generate_ai_insights

        assert should_generate_ai_insights(5) is True
        assert should_generate_ai_insights(10) is True


# ============================================================================
# FR 5.5 - Insight Categories
# ============================================================================


class TestInsightCategories:
    """Tests for insight categorization (FR 5.5)."""

    def test_fr_5_5_1_tilt_risk_detection(self):
        """Test tilt risk detection: 2+ consecutive losses with discipline -1."""
        from src.agent.nodes.generate_insights import detect_tilt_risk

        # 2 consecutive losses with discipline -1
        trades = [
            {"outcome": "loss", "discipline_score": -1},
            {"outcome": "loss", "discipline_score": -1},
        ]
        assert detect_tilt_risk(trades) is True

    def test_fr_5_5_1_no_tilt_without_discipline_issue(self):
        """Test no tilt risk without discipline -1."""
        from src.agent.nodes.generate_insights import detect_tilt_risk

        trades = [
            {"outcome": "loss", "discipline_score": 1},
            {"outcome": "loss", "discipline_score": 1},
        ]
        assert detect_tilt_risk(trades) is False

    def test_fr_5_5_2_overconfidence_detection(self):
        """Test overconfidence: 3+ consecutive wins with +1 discipline."""
        from src.agent.nodes.generate_insights import detect_overconfidence

        trades = [
            {"outcome": "win", "discipline_score": 1},
            {"outcome": "win", "discipline_score": 1},
            {"outcome": "win", "discipline_score": 1},
        ]
        assert detect_overconfidence(trades) is True

    def test_fr_5_5_3_session_fatigue_detection(self):
        """Test session fatigue: 90+ minutes with declining discipline."""
        from src.agent.nodes.generate_insights import detect_session_fatigue

        # 90+ minutes with declining discipline
        trades = [
            {"discipline_score": 1, "timestamp": "2024-01-15T10:00:00Z"},
            {"discipline_score": 0, "timestamp": "2024-01-15T10:30:00Z"},
            {"discipline_score": -1, "timestamp": "2024-01-15T11:30:00Z"},
        ]
        assert detect_session_fatigue(trades) is True

    def test_fr_5_5_4_discipline_trajectory_detection(self):
        """Test discipline trajectory: 3 consecutive -1 scores."""
        from src.agent.nodes.generate_insights import detect_discipline_trajectory

        trades = [
            {"discipline_score": -1},
            {"discipline_score": -1},
            {"discipline_score": -1},
        ]
        assert detect_discipline_trajectory(trades) is True

    def test_fr_5_5_5_agency_breakdown_detection(self):
        """Test agency breakdown: agency -1."""
        from src.agent.nodes.generate_insights import detect_agency_breakdown

        trades = [
            {"agency_score": -1},
        ]
        assert detect_agency_breakdown(trades) is True

    def test_fr_5_5_6_streak_recognition(self):
        """Test streak recognition: 3+ win streak or 3+ disciplined trades."""
        from src.agent.nodes.generate_insights import detect_streak_recognition

        # 3+ win streak
        trades = [
            {"outcome": "win"},
            {"outcome": "win"},
            {"outcome": "win"},
        ]
        assert detect_streak_recognition(trades) is True

    def test_fr_5_5_7_recovery_pattern(self):
        """Test recovery pattern: positive discipline after recovering from loss."""
        from src.agent.nodes.generate_insights import detect_recovery_pattern

        trades = [
            {"outcome": "loss", "discipline_score": -1},
            {"outcome": "win", "discipline_score": 1},
        ]
        assert detect_recovery_pattern(trades) is True


# ============================================================================
# Integration Tests
# ============================================================================


class TestGenerateInsightsNode:
    """Tests for the generate insights node function."""

    @pytest.mark.asyncio
    @patch("src.agent.nodes.generate_insights.ChatOpenAI")
    async def test_fr_5_1_generates_insights_with_trade_data(self, mock_llm_class):
        """Test insights generation with full session trade data (FR 5.1)."""
        from src.agent.nodes.generate_insights import generate_insights_node

        mock_llm = AsyncMock()
        mock_llm.ainvoke.return_value = MagicMock(
            content=json.dumps({
                "insights": [
                    {
                        "category": "pattern",
                        "message": "You're showing consistent discipline",
                        "severity": "info"
                    }
                ],
                "generated_at": datetime.now(timezone.utc).isoformat()
            })
        )
        mock_llm_class.return_value = mock_llm

        state = {
            "session_id": "test-session",
            "trades": [
                {"id": 1, "direction": "long", "outcome": "win", "pnl": 100, "discipline_score": 1, "agency_score": 1},
            ],
            "session_summary": {"total_trades": 1, "win_rate": 1.0},
            "trade_count": 1,
        }

        result = await generate_insights_node(state)
        assert "insights" in result

    @pytest.mark.asyncio
    @patch("src.agent.nodes.generate_insights.ChatOpenAI")
    async def test_fr_5_2_uses_session_statistics(self, mock_llm_class):
        """Test passing both raw trades and session stats (FR 5.2)."""
        from src.agent.nodes.generate_insights import generate_insights_node

        mock_llm = AsyncMock()
        mock_llm.ainvoke.return_value = MagicMock(
            content=json.dumps({
                "insights": [],
                "generated_at": datetime.now(timezone.utc).isoformat()
            })
        )
        mock_llm_class.return_value = mock_llm

        state = {
            "session_id": "test-session",
            "trades": [],
            "session_summary": {"total_trades": 10, "win_rate": 0.6, "total_pnl": 500},
            "trade_count": 10,
        }

        result = await generate_insights_node(state)
        # Should have called LLM with session summary
        mock_llm.ainvoke.assert_called_once()

    @pytest.mark.asyncio
    @patch("src.agent.nodes.generate_insights.ChatOpenAI")
    async def test_fr_5_4_small_session_returns_encouraging_message(self, mock_llm_class):
        """Test small sessions return encouraging messages (FR 5.4.1)."""
        from src.agent.nodes.generate_insights import generate_insights_node

        # For < 5 trades, should return encouraging message without LLM call
        state = {
            "session_id": "test-session",
            "trades": [{"id": 1, "outcome": "win"}],
            "session_summary": {"total_trades": 1},
            "trade_count": 1,
        }

        result = await generate_insights_node(state)

        # Should have insights but no LLM call
        assert "insights" in result
        assert result["insights"] is not None

    @pytest.mark.asyncio
    @patch("src.agent.nodes.generate_insights.ChatOpenAI")
    async def test_fr_5_3_returns_valid_insights_response(self, mock_llm_class):
        """Test insights response follows InsightsResponse schema."""
        from src.agent.nodes.generate_insights import generate_insights_node

        mock_llm = AsyncMock()
        mock_llm.ainvoke.return_value = MagicMock(
            content=json.dumps({
                "insights": [
                    {"category": "risk", "message": "Test alert", "severity": "warning"}
                ],
                "generated_at": "2024-01-15T10:30:00Z"
            })
        )
        mock_llm_class.return_value = mock_llm

        state = {
            "session_id": "test-session",
            "trades": [
                {"id": 1, "direction": "long", "outcome": "win", "pnl": 100, "discipline_score": 1, "agency_score": 1},
            ],
            "session_summary": {"total_trades": 10, "win_rate": 1.0},
            "trade_count": 10,
        }

        result = await generate_insights_node(state)
        insights = result["insights"]

        # Validate against schema
        assert isinstance(insights, InsightsResponse)
        assert len(insights.insights) <= 3  # Max 3 insights
        assert insights.trade_count == 10
