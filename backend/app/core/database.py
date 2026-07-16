"""
database.py
-----------
Supabase client wrapper for Varinth.
The service role client bypasses RLS for server-side writes.
RLS is enforced at the DB level for all user-facing reads.
"""
from functools import lru_cache
from supabase import create_client, Client

from app.core.config import get_settings


@lru_cache()
def get_supabase() -> Client:
    """
    Server-side Supabase client using the service role key.
    Only used inside backend services — never exposed to the client.
    """
    settings = get_settings()
    return create_client(
        settings.supabase_url,
        settings.supabase_service_role_key,
    )
