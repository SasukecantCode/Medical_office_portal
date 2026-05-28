from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


_BACKEND_DIR = Path(__file__).resolve().parents[2]
_DEFAULT_DB_PATH = _BACKEND_DIR / "portal.db"
_DEFAULT_UPLOADS_DIR = _BACKEND_DIR / "uploads"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(_BACKEND_DIR / ".env"), env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Health Office Portal API"
    environment: str = "dev"

    # Comma-separated list or "*"
    cors_origins: str = "*"

    database_url: str = f"sqlite:///{_DEFAULT_DB_PATH.as_posix()}"

    # Local file storage for attachments (MVP)
    uploads_dir: str = str(_DEFAULT_UPLOADS_DIR)

    # Gemini / LLM settings (optional)
    gemini_api_key: str | None = None
    gemini_model: str | None = "models/gemini-2.5-flash"


settings = Settings()
