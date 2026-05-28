from datetime import date, datetime

from sqlalchemy import JSON, Date, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class HRStaff(Base):
    __tablename__ = "hr_staff"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    full_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    gender: Mapped[str] = mapped_column(String(50), nullable=True)
    date_of_birth: Mapped[date] = mapped_column(Date, nullable=True)

    designation: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    cadre: Mapped[str] = mapped_column(String(255), nullable=True, index=True)
    employment_type: Mapped[str] = mapped_column(String(255), nullable=True, index=True)

    phone: Mapped[str] = mapped_column(String(50), nullable=True, index=True)
    email: Mapped[str] = mapped_column(String(255), nullable=True, index=True)

    facility_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    facility_type: Mapped[str] = mapped_column(String(255), nullable=True, index=True)

    district: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    block: Mapped[str] = mapped_column(String(255), nullable=True, index=True)
    posting_place: Mapped[str] = mapped_column(String(255), nullable=True)

    date_of_joining: Mapped[date] = mapped_column(Date, nullable=True)

    remarks: Mapped[str] = mapped_column(String(2000), nullable=True)

    # For future fields without immediate migrations
    extra: Mapped[dict] = mapped_column(JSON, nullable=True)

    # Profile photo (single JPEG) stored on disk (MVP)
    profile_photo_original_filename: Mapped[str] = mapped_column(String(512), nullable=True)
    profile_photo_stored_filename: Mapped[str] = mapped_column(String(512), nullable=True)
    profile_photo_content_type: Mapped[str] = mapped_column(String(255), nullable=True)
    profile_photo_uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
    deleted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
