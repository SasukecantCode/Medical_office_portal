from datetime import date, datetime

from sqlalchemy import JSON, Date, DateTime, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.types import EncryptedString


class HRStaff(Base):
    __tablename__ = "hr_staff"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    # ── Personal Info ──
    full_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    fathers_name: Mapped[str] = mapped_column(String(255), nullable=True)
    mothers_name: Mapped[str] = mapped_column(String(255), nullable=True)
    gender: Mapped[str] = mapped_column(String(50), nullable=True)
    date_of_birth: Mapped[date] = mapped_column(Date, nullable=True)

    # ── Service Info ──
    designation: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    mode_of_service: Mapped[str] = mapped_column(String(255), nullable=True)
    head: Mapped[str] = mapped_column(String(255), nullable=True)
    present_posting_place: Mapped[str] = mapped_column(String(255), nullable=True)
    appointment_order_no: Mapped[str] = mapped_column(String(500), nullable=True)
    date_of_joining: Mapped[date] = mapped_column(Date, nullable=True)
    present_basic_pay: Mapped[str] = mapped_column(String(100), nullable=True)

    # MACP dates (auto-calculated from DOJ, but stored for overrides)
    first_macp: Mapped[date] = mapped_column(Date, nullable=True)
    second_macp: Mapped[date] = mapped_column(Date, nullable=True)
    third_macp: Mapped[date] = mapped_column(Date, nullable=True)

    # Date of Retirement (auto-calculated from DOB + designation)
    date_of_retirement: Mapped[date] = mapped_column(Date, nullable=True)

    # ── Address & Contact ──
    present_address: Mapped[str] = mapped_column(String(1000), nullable=True)
    permanent_address: Mapped[str] = mapped_column(String(1000), nullable=True)
    phone: Mapped[str] = mapped_column(String(50), nullable=True, index=True)
    email: Mapped[str] = mapped_column(String(255), nullable=True, index=True)

    # ── Identity Documents ──
    aadhaar_number: Mapped[str] = mapped_column(EncryptedString(20), nullable=True)
    pan_number: Mapped[str] = mapped_column(EncryptedString(20), nullable=True)

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
