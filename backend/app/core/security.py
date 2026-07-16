"""
security.py
-----------
Path traversal protection, JWT verification, input sanitization.
Every public-facing concern that touches security lives here.
"""
import os
import re
import unicodedata
from fastapi import HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.core.config import get_settings
from app.core.logging import get_logger

settings = get_settings()
logger = get_logger("varinth.security")
_bearer = HTTPBearer()

# ---------------------------------------------------------------------------
# Allowed file extensions for the evidence retriever.
# Only these will ever be opened. Everything else is silently skipped.
# ---------------------------------------------------------------------------
ALLOWED_EXTENSIONS: frozenset[str] = frozenset({
    ".py", ".ts", ".tsx", ".js", ".jsx", ".go", ".rs", ".java", ".rb",
    ".md", ".txt", ".yaml", ".yml", ".toml", ".env.example",
    ".json", ".sh", ".dockerfile", ".sql", ".graphql", ".proto",
    ".cfg", ".ini", ".conf",
})

# Directories that are always excluded during recursive scanning.
EXCLUDED_DIRS: frozenset[str] = frozenset({
    "node_modules", ".git", ".venv", "venv", "__pycache__", ".mypy_cache",
    ".pytest_cache", "dist", "build", ".next", ".nuxt", "coverage",
    ".tox", "eggs", ".eggs", ".idea", ".vscode",
})

# Slug validation pattern
SLUG_PATTERN = re.compile(r'^[a-z0-9_-]{1,64}$')

# Control character stripping (everything below 0x20 except tab/newline)
_CONTROL_CHARS = dict.fromkeys(
    i for i in range(0, 32) if i not in (9, 10, 13)
)


# ---------------------------------------------------------------------------
# Input sanitization
# ---------------------------------------------------------------------------

def sanitize_string(value: str, max_len: int | None = None) -> str:
    """
    Strip null bytes, control characters, and optionally truncate.
    Does NOT alter unicode characters beyond ASCII control codes.
    """
    # Remove null bytes
    value = value.replace('\x00', '')
    # Remove control characters (keep tab, LF, CR)
    value = value.translate(_CONTROL_CHARS)
    # NFC normalize
    value = unicodedata.normalize('NFC', value)
    if max_len:
        value = value[:max_len]
    return value


def validate_slug(slug: str) -> str:
    if not SLUG_PATTERN.match(slug):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid slug '{slug}'. Must match ^[a-z0-9_-]{{1,64}}$",
        )
    return slug


# ---------------------------------------------------------------------------
# Path traversal protection
# ---------------------------------------------------------------------------

class SecurityViolationError(Exception):
    """Raised when a path traversal attempt is detected."""


def assert_path_in_scope(root_path: str, candidate_path: str) -> str:
    """
    Resolve both paths to their canonical real paths and assert that
    candidate_path is strictly within root_path.

    Raises SecurityViolationError if the candidate escapes the root.
    Returns the resolved absolute candidate path on success.
    """
    resolved_root = os.path.realpath(root_path)
    resolved_candidate = os.path.realpath(candidate_path)

    # Ensure the candidate is under the root (add separator to avoid
    # prefix collisions like /rootdir vs /rootdir-evil)
    if not resolved_candidate.startswith(resolved_root + os.sep) and \
            resolved_candidate != resolved_root:
        raise SecurityViolationError(
            f"Path traversal detected. Candidate '{resolved_candidate}' "
            f"is outside root '{resolved_root}'."
        )
    return resolved_candidate


def is_allowed_extension(file_path: str) -> bool:
    """Return True only if the file extension is in the whitelist."""
    _, ext = os.path.splitext(file_path.lower())
    return ext in ALLOWED_EXTENSIONS


def is_excluded_dir(dir_name: str) -> bool:
    """Return True if a directory name should be skipped during traversal."""
    return dir_name in EXCLUDED_DIRS


# ---------------------------------------------------------------------------
# JWT verification (Supabase Auth)
# ---------------------------------------------------------------------------

class UserClaims:
    def __init__(self, user_id: str, email: str | None = None):
        self.user_id = user_id
        self.email = email


def verify_supabase_jwt(token: str) -> UserClaims:
    """
    Verify a Supabase-issued JWT by calling the Supabase Auth service.
    Returns UserClaims on success, raises 401 on any failure.
    """
    try:
        from app.core.database import get_supabase
        client = get_supabase()
        auth_resp = client.auth.get_user(token)
        if not auth_resp or not auth_resp.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not authenticated or token is invalid.",
            )
        user = auth_resp.user
        return UserClaims(
            user_id=str(user.id),
            email=user.email,
        )
    except Exception as exc:
        logger.error("jwt_verification_failed", exc_info=exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {str(exc)}",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


async def require_authenticated_user(
    credentials: HTTPAuthorizationCredentials = Security(_bearer),
) -> UserClaims:
    """
    FastAPI dependency. Inject into any route that requires authentication.

    Usage:
        @router.get("/protected")
        async def handler(user: UserClaims = Depends(require_authenticated_user)):
            ...
    """
    return verify_supabase_jwt(credentials.credentials)
