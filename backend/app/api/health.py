from fastapi import APIRouter, Depends, status
from app.core.security import UserClaims, require_authenticated_user
from app.models.schemas import HealthResponse

router = APIRouter(tags=["health"])


@router.get(
    "/api/v1/health",
    response_model=HealthResponse,
    status_code=status.HTTP_200_OK,
    summary="Health check (unauthenticated)",
)
async def health():
    """Public health check. Returns 200 OK with service info."""
    return HealthResponse(status="ok")
