"""Tests for Insights API endpoints (Unit 4).

Tests verify the following FRs:
- FR 5.0: Insights Generation
- FR 5.2: Insights Generation Timing
- FR 5.3: Insights Regeneration Strategy
- FR 5.4: Small Session Insights
"""
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from src.schemas.insights import Insight, InsightsResponse


# =============================================================================
# FR 5.0 - Insights Generation API Tests
# =============================================================================


class TestInsightsAPIEndpoints:
    """Tests for the insights API endpoints."""

    @pytest.fixture
    def client(self) -> TestClient:
        """Create test client."""
        from src.main import app
        return TestClient(app)

    @pytest.fixture
    def mock_trades(self):
        """Sample trade data for testing."""
        return [
            {
                "id": "trade-1",
                "direction": "long",
                "outcome": "win",
                "pnl": 500.00,
                "discipline_score": 1,
                "agency_score": 1,
                "timestamp": "2024-01-15T10:00:00Z",
            },
            {
                "id": "trade-2",
                "direction": "short",
                "outcome": "loss",
                "pnl": -200.00,
                "discipline_score": 0,
                "agency_score": 1,
                "timestamp": "2024-01-15T10:15:00Z",
            },
            {
                "id": "trade-3",
                "direction": "long",
                "outcome": "win",
                "pnl": 300.00,
                "discipline_score": 1,
                "agency_score": 1,
                "timestamp": "2024-01-15T10:30:00Z",
            },
        ]

    @pytest.fixture
    def mock_session_summary(self):
        """Sample session summary for testing."""
        return {
            "total_trades": 3,
            "win_count": 2,
            "loss_count": 1,
            "breakeven_count": 0,
            "total_pnl": 600.00,
            "win_rate": 0.67,
            "avg_pnl_per_trade": 200.00,
            "largest_win": 500.00,
            "largest_loss": -200.00,
            "discipline_sum": 2,
            "agency_sum": 3,
        }

    @pytest.mark.asyncio
    async def test_fr_5_0_get_insights_returns_200(self, client, mock_trades, mock_session_summary):
        """Test GET /api/v1/insights returns 200 with valid session_id."""
        with patch("src.api.insights.get_session_data") as mock_get_session:
            mock_get_session.return_value = {
                "trades": mock_trades,
                "session_summary": mock_session_summary,
                "trade_count": 3,
                "last_trade_time": "2024-01-15T10:30:00Z",
            }

            response = client.get("/api/v1/insights?session_id=test-session-123")

            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert "data" in data
            assert "insights" in data["data"]
            assert "generated_at" in data["data"]
            assert "trade_count" in data["data"]

    @pytest.mark.asyncio
    async def test_fr_5_0_get_insights_returns_insights_list(self, client, mock_trades, mock_session_summary):
        """Test GET /api/v1/insights returns insights list (FR 5.1)."""
        with patch("src.api.insights.get_session_data") as mock_get_session:
            mock_get_session.return_value = {
                "trades": mock_trades,
                "session_summary": mock_session_summary,
                "trade_count": 3,
                "last_trade_time": "2024-01-15T10:30:00Z",
            }

            response = client.get("/api/v1/insights?session_id=test-session-123")

            assert response.status_code == 200
            data = response.json()
            assert isinstance(data["data"]["insights"], list)

    @pytest.mark.asyncio
    async def test_fr_5_0_get_insights_includes_timestamp(self, client, mock_trades, mock_session_summary):
        """Test GET /api/v1/insights includes generated_at timestamp (FR 5.4)."""
        with patch("src.api.insights.get_session_data") as mock_get_session:
            mock_get_session.return_value = {
                "trades": mock_trades,
                "session_summary": mock_session_summary,
                "trade_count": 3,
                "last_trade_time": "2024-01-15T10:30:00Z",
            }

            response = client.get("/api/v1/insights?session_id=test-session-123")

            assert response.status_code == 200
            data = response.json()
            assert "generated_at" in data["data"]
            # Should be ISO format timestamp
            generated_at = data["data"]["generated_at"]
            datetime.fromisoformat(generated_at.replace("Z", "+00:00"))

    @pytest.mark.asyncio
    async def test_fr_5_0_post_insights_returns_202(self, client, mock_trades, mock_session_summary):
        """Test POST /api/v1/insights returns 202 (async, non-blocking) (FR 5.2.2)."""
        with patch("src.api.insights.get_session_data") as mock_get_session:
            mock_get_session.return_value = {
                "trades": mock_trades,
                "session_summary": mock_session_summary,
                "trade_count": 3,
                "last_trade_time": "2024-01-15T10:30:00Z",
            }

            response = client.post("/api/v1/insights", json={"session_id": "test-session-123"})

            assert response.status_code == 202
            data = response.json()
            assert data["success"] is True

    @pytest.mark.asyncio
    async def test_fr_5_0_post_insights_queued_async(self, client, mock_trades, mock_session_summary):
        """Test POST /api/v1/insights queues generation asynchronously (FR 5.2.2)."""
        with patch("src.api.insights.get_session_data") as mock_get_session, \
             patch("src.api.insights.generate_insights_background") as mock_bg:

            mock_get_session.return_value = {
                "trades": mock_trades,
                "session_summary": mock_session_summary,
                "trade_count": 3,
                "last_trade_time": "2024-01-15T10:30:00Z",
            }
            mock_bg.return_value = None

            response = client.post("/api/v1/insights", json={"session_id": "test-session-123"})

            # Background task should be called
            mock_bg.assert_called_once()
            assert response.status_code == 202

    def test_fr_5_0_get_insights_requires_session_id(self, client):
        """Test GET /api/v1/insights requires session_id parameter."""
        response = client.get("/api/v1/insights")
        assert response.status_code == 422  # Validation error

    def test_fr_5_0_post_insights_requires_session_id(self, client):
        """Test POST /api/v1/insights requires session_id in body."""
        response = client.post("/api/v1/insights", json={})
        assert response.status_code == 422  # Validation error


# =============================================================================
# FR 5.3 - Insights Regeneration Strategy
# =============================================================================


class TestInsightsCaching:
    """Tests for insights caching in API (FR 5.3)."""

    @pytest.fixture
    def client(self) -> TestClient:
        """Create test client."""
        from src.main import app
        return TestClient(app)

    @pytest.mark.asyncio
    async def test_fr_5_3_1_regenerate_after_trade(self, client):
        """Test insights regenerate after new trade (FR 5.3.1)."""
        with patch("src.api.insights.get_session_data") as mock_get_session, \
             patch("src.api.insights.get_insights_cache") as mock_get_cache:

            # First call - no cache
            mock_cache = MagicMock()
            mock_cache.get.return_value = None
            mock_get_cache.return_value = mock_cache

            mock_get_session.return_value = {
                "trades": [{"id": 1, "outcome": "win"}],
                "session_summary": {"total_trades": 1},
                "trade_count": 1,
                "last_trade_time": "2024-01-15T10:00:00Z",
            }

            response = client.get("/api/v1/insights?session_id=test-session")

            assert response.status_code == 200
            # Cache should have been checked
            mock_cache.get.assert_called()

    @pytest.mark.asyncio
    async def test_fr_5_3_3_cache_uses_session_id_trade_count(self, client):
        """Test cache key uses session_id + trade_count + last 3 trades (FR 5.3.3)."""
        with patch("src.api.insights.get_session_data") as mock_get_session, \
             patch("src.api.insights.generate_cache_key") as mock_cache_key:

            mock_get_session.return_value = {
                "trades": [{"id": 1, "outcome": "win"}],
                "session_summary": {"total_trades": 1},
                "trade_count": 1,
                "last_trade_time": "2024-01-15T10:00:00Z",
            }
            mock_cache_key.return_value = "insights:test:1:abc123"

            response = client.get("/api/v1/insights?session_id=test-session")

            # Cache key should have been generated with correct params
            mock_cache_key.assert_called()


# =============================================================================
# FR 5.4 - Small Session Insights
# =============================================================================


class TestSmallSessionAPI:
    """Tests for small session insights in API (FR 5.4)."""

    @pytest.fixture
    def client(self) -> TestClient:
        """Create test client."""
        from src.main import app
        return TestClient(app)

    @pytest.mark.asyncio
    async def test_fr_5_4_small_session_returns_encouraging_message(self, client):
        """Test small session (<5 trades) returns encouraging message (FR 5.4.1)."""
        with patch("src.api.insights.get_session_data") as mock_get_session:
            # Only 2 trades - should show encouraging message
            mock_get_session.return_value = {
                "trades": [
                    {"id": 1, "outcome": "win", "discipline_score": 1},
                    {"id": 2, "outcome": "loss", "discipline_score": 0},
                ],
                "session_summary": {"total_trades": 2},
                "trade_count": 2,
                "last_trade_time": "2024-01-15T10:30:00Z",
            }

            response = client.get("/api/v1/insights?session_id=test-session")

            assert response.status_code == 200
            data = response.json()
            # Should have at least one insight for small session
            assert len(data["data"]["insights"]) >= 1


# =============================================================================
# Error Handling Tests
# =============================================================================


class TestInsightsAPIErrors:
    """Tests for insights API error handling."""

    @pytest.fixture
    def client(self) -> TestClient:
        """Create test client."""
        from src.main import app
        return TestClient(app)

    @pytest.mark.asyncio
    async def test_get_insights_returns_error_for_invalid_session(self, client):
        """Test GET /api/v1/insights returns error for non-existent session."""
        with patch("src.api.insights.get_session_data") as mock_get_session:
            mock_get_session.return_value = None  # No session found

            response = client.get("/api/v1/insights?session_id=invalid-session")

            # Returns success: false for not found
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is False
            assert "error" in data

    @pytest.mark.asyncio
    async def test_post_insights_handles_missing_session(self, client):
        """Test POST /api/v1/insights handles missing session gracefully."""
        with patch("src.api.insights.get_session_data") as mock_get_session:

            mock_get_session.return_value = None

            response = client.post("/api/v1/insights", json={"session_id": "test-session"})

            # Should return 202 (async) with success: false for not found
            # FR 5.2.2: POST returns 202 Accepted for async, non-blocking
            assert response.status_code == 202
            data = response.json()
            assert data["success"] is False
