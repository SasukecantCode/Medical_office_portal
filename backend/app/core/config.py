from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict
from dotenv import load_dotenv

_BACKEND_DIR = Path(__file__).resolve().parents[2]
load_dotenv(dotenv_path=str(_BACKEND_DIR / ".env"))

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

    # Google Cloud Storage (Document Vault)
    gcs_bucket_name: str = "medical-office-hr-documents"
    document_max_size_bytes: int = 10 * 1024 * 1024

    # Public base URL for export links (falls back to request host)
    public_base_url: str | None = None

    # Gemini / LLM settings (optional)
    gemini_api_key: str | None = None
    gemini_model: str | None = "models/gemini-2.5-flash"


settings = Settings()
