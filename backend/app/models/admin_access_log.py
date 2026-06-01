from datetime import datetime

from sqlalchemy import DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AdminAccessLog(Base):
    __tablename__ = "admin_access_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    invite_id: Mapped[int] = mapped_column(Integer, nullable=True, index=True)
    profile_handle: Mapped[str] = mapped_column(String(120), nullable=False)
    role: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    logged_in_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
