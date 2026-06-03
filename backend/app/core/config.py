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

    # ONLYOFFICE Docs integration
    onlyoffice_document_server_url: str | None = None
    onlyoffice_jwt_secret: str | None = None
    onlyoffice_token_ttl_minutes: int = 60 * 24 * 7

    # Public base URL for export links (falls back to request host)
    public_base_url: str | None = None

    # Authentication / registration
    registration_access_code: str = "namsai123"
    auth_jwt_secret_key: str = "change-me-in-production"
    auth_jwt_algorithm: str = "HS256"
    auth_jwt_expiry_minutes: int = 720
    auth_otp_length: int = 6
    auth_otp_expiry_minutes: int = 10

    # SMTP email delivery for OTPs
    auth_smtp_host: str | None = None
    auth_smtp_port: int = 587
    auth_smtp_user: str | None = None
    auth_smtp_password: str | None = None
    auth_smtp_from_email: str | None = None
    auth_smtp_use_tls: bool = True
    auth_smtp_timeout_seconds: int = 20

    # Master admin defaults / portal access control
    allow_vaccination_portal: bool = False

    # Gemini / LLM settings (optional)
    gemini_api_key: str | None = None
    gemini_model: str | None = "models/gemini-2.5-flash"


settings = Settings()
