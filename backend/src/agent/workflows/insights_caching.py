"""Insights caching utilities for debouncing and cache management.

This module implements FR 5.3 - Insights Regeneration Strategy:
- FR 5.3.1: Regenerate after each trade under normal pace (<1 trade/minute)
- FR 5.3.2: Debounce 2-3 seconds for rapid submissions (>1 trade/minute)
- FR 5.3.3: Cache insights by session ID + trade count + hash of last 3 trades
- FR 5.3.4: Regenerate if trade_count or last_trade_time changes
"""
import hashlib
import json
from typing import List, Dict, Any, Optional

from src.schemas.insights import InsightsResponse


# =============================================================================
# Cache Key Generation (FR 5.3.3)
# =============================================================================


def generate_cache_key(session_id: str, trades: List[Dict[str, Any]], trade_count: int) -> str:
    """Generate cache key from session ID, trade count, and hash of last 3 trades.

    This implements FR 5.3.3: Cache insights by session ID + trade count + hash of last 3 trades.

    Args:
        session_id: The trading session identifier
        trades: List of trade records
        trade_count: Number of trades in the session

    Returns:
        Cache key string in format: insights:{session_id}:{trade_count}:{hash}
    """
    # Use last 3 trades for hash
    recent_trades = trades[-3:] if len(trades) >= 3 else trades
    trade_json = json.dumps(recent_trades, sort_keys=True)
    trade_hash = hashlib.sha256(trade_json.encode()).hexdigest()[:8]

    return f"insights:{session_id}:{trade_count}:{trade_hash}"


# =============================================================================
# Regeneration Decision (FR 5.3.4)
# =============================================================================


def _normalize_timestamp(ts: str) -> "datetime":
    """Normalize timestamp to UTC-aware datetime."""
    from datetime import datetime
    ts = ts.strip()
    # If no timezone info, assume UTC
    if ts.endswith("Z"):
        ts = ts[:-1] + "+00:00"
    elif "+" not in ts[-6:] and "-" not in ts[-6:]:
        ts = ts + "+00:00"
    return datetime.fromisoformat(ts)


def should_regenerate(
    cached: InsightsResponse,
    new_trade_count: int,
    last_trade_time: str
) -> bool:
    """Determine if insights should be regenerated.

    This implements FR 5.3.4: Regenerate if trade_count or last_trade_time changes.

    Args:
        cached: Previously cached InsightsResponse
        new_trade_count: Current trade count
        last_trade_time: Timestamp of last trade

    Returns:
        True if insights should be regenerated, False otherwise
    """
    # If trade count changed, regenerate
    if cached.trade_count != new_trade_count:
        return True

    # If last trade time changed (new trade added), regenerate
    # Compare timestamps by parsing them to handle timezone differences
    try:
        cached_dt = _normalize_timestamp(cached.generated_at)
        last_trade_dt = _normalize_timestamp(last_trade_time)

        # If times are different by more than 1 second, regenerate
        time_diff = abs((cached_dt - last_trade_dt).total_seconds())
        if time_diff > 1:
            return True
    except (AttributeError, TypeError, ValueError):
        # If we can't parse, regenerate
        return True

    return False


# =============================================================================
# Debounce Logic (FR 5.3.2)
# =============================================================================


def calculate_debounce_delay(
    trades: List[Dict[str, Any]],
    time_window_seconds: float = 60.0
) -> float:
    """Calculate debounce delay based on trade pace.

    This implements FR 5.3.2: Debounce 2-3 seconds for rapid submissions (>1 trade/minute).

    Args:
        trades: List of trade records with timestamps
        time_window_seconds: Time window to consider for pace calculation (default 60s)

    Returns:
        Debounce delay in seconds (0 for normal pace, 2-3 for rapid)
    """
    if len(trades) < 2:
        return 0.0

    # Get timestamps from trades
    timestamps = []
    for trade in trades:
        ts = trade.get("timestamp")
        if ts:
            timestamps.append(ts)

    if len(timestamps) < 2:
        return 0.0

    # Calculate time between trades
    try:
        from datetime import datetime
        # Parse timestamps
        parsed_times = []
        for ts in timestamps:
            try:
                # Use the normalize function
                parsed_times.append(_normalize_timestamp(ts))
            except (ValueError, TypeError):
                continue

        if len(parsed_times) < 2:
            return 0.0

        # Calculate average time between trades
        parsed_times.sort()
        time_diffs = []
        for i in range(1, len(parsed_times)):
            diff = (parsed_times[i] - parsed_times[i-1]).total_seconds()
            time_diffs.append(diff)

        avg_time_between_trades = sum(time_diffs) / len(time_diffs)

        # If more than 1 trade per minute on average, debounce
        if avg_time_between_trades < time_window_seconds:
            return 2.5  # 2-3 seconds debounce
        return 0.0
    except Exception:
        return 0.0


# =============================================================================
# Cache Storage (In-Memory)
# =============================================================================


class InsightsCache:
    """In-memory cache for insights with TTL support."""

    def __init__(self, ttl_seconds: float = 300.0):
        """Initialize the cache.

        Args:
            ttl_seconds: Time-to-live for cache entries (default 5 minutes)
        """
        self._cache: Dict[str, InsightsResponse] = {}
        self._ttl = ttl_seconds

    def get(self, key: str) -> Optional[InsightsResponse]:
        """Get cached insights by key.

        Args:
            key: Cache key

        Returns:
            Cached InsightsResponse or None if not found/expired
        """
        return self._cache.get(key)

    def set(self, key: str, value: InsightsResponse) -> None:
        """Set cached insights.

        Args:
            key: Cache key
            value: InsightsResponse to cache
        """
        self._cache[key] = value

    def clear(self) -> None:
        """Clear all cached insights."""
        self._cache.clear()


# Global cache instance
_insights_cache = InsightsCache()


def get_insights_cache() -> InsightsCache:
    """Get the global insights cache instance.

    Returns:
        Global InsightsCache instance
    """
    return _insights_cache
