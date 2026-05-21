"""Application configuration loaded from environment / .env file."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """Runtime configuration. Override via environment or backend/.env."""

    model_config = SettingsConfigDict(
        env_file=BACKEND_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Anthropic
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-6"

    # Routing
    confidence_threshold: float = 0.65
    top_k: int = 5

    # Storage paths (resolved relative to BACKEND_ROOT)
    chroma_dir: str = "data/chroma"
    upload_dir: str = "data/uploads"
    sqlite_path: str = "data/megatron.db"

    # CORS
    frontend_origin: str = "http://localhost:5173"

    @property
    def chroma_path(self) -> Path:
        return (BACKEND_ROOT / self.chroma_dir).resolve()

    @property
    def upload_path(self) -> Path:
        return (BACKEND_ROOT / self.upload_dir).resolve()

    @property
    def sqlite_url(self) -> str:
        return f"sqlite:///{(BACKEND_ROOT / self.sqlite_path).resolve()}"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    s = Settings()
    s.chroma_path.mkdir(parents=True, exist_ok=True)
    s.upload_path.mkdir(parents=True, exist_ok=True)
    (BACKEND_ROOT / s.sqlite_path).parent.mkdir(parents=True, exist_ok=True)
    return s
