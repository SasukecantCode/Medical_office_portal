from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, SmallInteger, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class HRFieldDef(Base):
    __tablename__ = "hr_field_defs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    # canonical machine name (no spaces), unique
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    # human friendly label
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    # data type (string, date, integer, email, phone, etc.)
    data_type: Mapped[str] = mapped_column(String(50), nullable=False, default="string")
    # ordering for presentation
    sort_order: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    deleted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
