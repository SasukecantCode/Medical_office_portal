from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Health Office Portal API"
    environment: str = "dev"

    # Comma-separated list or "*"
    cors_origins: str = "*"

    database_url: str = "sqlite:///./portal.db"

    # Local file storage for attachments (MVP)
    uploads_dir: str = "./uploads"


settings = Settings()
