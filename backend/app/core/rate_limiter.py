"""
rate_limiter.py
---------------
Sliding window in-memory rate limiter.
Keyed by (user_id, route_key).
"""
import time
import threading
from collections import deque
from fastapi import HTTPException, status

from app.core.config import get_settings

settings = get_settings()

# ---------------------------------------------------------------------------
# Per-route limits: (max_requests, window_seconds)
# ---------------------------------------------------------------------------
ROUTE_LIMITS: dict[str, tuple[int, int]] = {
    "POST:/api/v1/audits":  (10, 60),   # 10 audit runs per minute per user
    "DEFAULT":              (60, 60),   # 60 requests per minute per user
}

_lock = threading.Lock()
_windows: dict[str, deque] = {}   # key -> deque of timestamps


def _get_limit(route_key: str) -> tuple[int, int]:
    return ROUTE_LIMITS.get(route_key, ROUTE_LIMITS["DEFAULT"])


def check_rate_limit(user_id: str, route_key: str) -> None:
    """
    Raises HTTP 429 if the user has exceeded the rate limit for this route.
    Updates the sliding window on every call.
    """
    max_requests, window_seconds = _get_limit(route_key)
    bucket_key = f"{user_id}:{route_key}"
    now = time.monotonic()

    with _lock:
        if bucket_key not in _windows:
            _windows[bucket_key] = deque()

        window = _windows[bucket_key]

        # Drop timestamps outside the current window
        cutoff = now - window_seconds
        while window and window[0] < cutoff:
            window.popleft()

        if len(window) >= max_requests:
            retry_after = int(window[0] + window_seconds - now) + 1
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded. Retry after {retry_after} seconds.",
                headers={"Retry-After": str(retry_after)},
            )

        window.append(now)
