import pytest
from fastapi import HTTPException
from app.core.rate_limiter import check_rate_limit

def test_rate_limiter_success():
    user_id = "test-user-1"
    # Calls within limits
    for _ in range(5):
        check_rate_limit(user_id, "DEFAULT")

def test_rate_limiter_limit_exceeded():
    user_id = "test-user-2"
    # DEFAULT limit is 60 calls per minute. 61st call should raise.
    with pytest.raises(HTTPException) as exc:
        for _ in range(65):
            check_rate_limit(user_id, "DEFAULT")
    assert exc.value.status_code == 429

def test_rate_limiter_audits_exceeded():
    user_id = "test-user-3"
    # AUDIT limit is 10 runs per minute. 11th call should raise.
    with pytest.raises(HTTPException) as exc:
        for _ in range(12):
            check_rate_limit(user_id, "POST:/api/v1/audits")
    assert exc.value.status_code == 429
