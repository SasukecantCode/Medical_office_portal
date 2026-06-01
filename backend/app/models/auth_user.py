from __future__ import annotations

from datetime import datetime
from enum import Enum

from sqlalchemy import Boolean, DateTime, Integer, String, UniqueConstraint, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class UserRole(str, Enum):
    hr = "hr"
    vaccination = "vaccination"
    master = "master"


class AuthUser(Base):
    __tablename__ = "auth_users"
    __table_args__ = (
        UniqueConstraint("role", "username", name="uq_auth_users_role_username"),
        UniqueConstraint("email", name="uq_auth_users_email"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    phone_number: Mapped[str] = mapped_column(String(50), nullable=True, index=True)
    username: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)

    is_email_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("0"))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("0"))

    otp_code_hash: Mapped[str] = mapped_column(String(255), nullable=True)
    otp_expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    otp_sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)

    last_login_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    @property
    def profile_handle(self) -> str:
        return f"admin.{self.role}.{self.username}"