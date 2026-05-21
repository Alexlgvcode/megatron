"""Thin wrapper around Supabase Storage for course material file uploads."""
from __future__ import annotations

from pathlib import Path

from supabase import create_client, Client

from .config import get_settings

_client: Client | None = None


def _get_client() -> Client:
    global _client
    if _client is None:
        s = get_settings()
        if not s.supabase_url or not s.supabase_key:
            raise RuntimeError("SUPABASE_URL and SUPABASE_KEY must be set in .env")
        _client = create_client(s.supabase_url, s.supabase_key)
    return _client


def _content_type(filename: str) -> str:
    suffix = Path(filename).suffix.lower()
    return {".pdf": "application/pdf", ".md": "text/markdown"}.get(suffix, "text/plain")


def upload_file(*, path: str, data: bytes, filename: str) -> str:
    """Upload bytes to Supabase Storage and return the public URL."""
    client = _get_client()
    bucket = get_settings().supabase_bucket
    client.storage.from_(bucket).upload(
        path=path,
        file=data,
        file_options={"content-type": _content_type(filename), "upsert": "true"},
    )
    return client.storage.from_(bucket).get_public_url(path)


def delete_file(path: str) -> None:
    """Delete a file from Supabase Storage. Silently ignores missing files."""
    try:
        client = _get_client()
        bucket = get_settings().supabase_bucket
        client.storage.from_(bucket).remove([path])
    except Exception:
        pass
