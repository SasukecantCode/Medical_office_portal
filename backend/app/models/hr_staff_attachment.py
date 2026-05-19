from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class HRStaffAttachment(Base):
    __tablename__ = "hr_staff_attachments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    staff_id: Mapped[int] = mapped_column(Integer, ForeignKey("hr_staff.id"), index=True, nullable=False)

    original_filename: Mapped[str] = mapped_column(String(512), nullable=False)
    stored_filename: Mapped[str] = mapped_column(String(512), nullable=False, unique=True)
    content_type: Mapped[str] = mapped_column(String(255), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
