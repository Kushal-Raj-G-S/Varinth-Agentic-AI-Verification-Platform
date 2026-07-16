import os
import pytest
from fastapi import HTTPException
from app.core.security import (
    assert_path_in_scope,
    SecurityViolationError,
    sanitize_string,
    validate_slug,
)

def test_sanitize_string():
    # Strip control characters
    assert sanitize_string("hello\x00world\x1f") == "helloworld"
    # Normal string remains untouched
    assert sanitize_string("Hello, World! 123") == "Hello, World! 123"

def test_validate_slug():
    assert validate_slug("baxel-core-1") == "baxel-core-1"
    assert validate_slug("baxel_core") == "baxel_core"
    
    with pytest.raises(HTTPException) as exc:
        validate_slug("Baxel")
    assert exc.value.status_code == 422
    
    with pytest.raises(HTTPException):
        validate_slug("baxel.core")
    
    with pytest.raises(HTTPException):
        validate_slug("baxel/core")

def test_assert_path_in_scope_valid(tmp_path):
    root = str(tmp_path.resolve())
    # Subdir
    sub = os.path.join(root, "backend", "services")
    os.makedirs(sub)
    
    # Valid candidate path in scope
    candidate = os.path.join(sub, "orchestrator.py")
    assert assert_path_in_scope(root, candidate) == os.path.realpath(candidate)

def test_assert_path_in_scope_traversal_violation(tmp_path):
    root = str(tmp_path.resolve())
    sub = os.path.join(root, "project")
    os.makedirs(sub)
    
    # Path escaping root directory
    candidate = os.path.join(sub, "..", "..", "etc", "passwd")
    with pytest.raises(SecurityViolationError):
        assert_path_in_scope(root, candidate)

def test_assert_path_in_scope_exact_root(tmp_path):
    root = str(tmp_path.resolve())
    assert assert_path_in_scope(root, root) == os.path.realpath(root)
