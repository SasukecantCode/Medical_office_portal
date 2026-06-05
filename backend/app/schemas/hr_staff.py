from __future__ import annotations

from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class HRStaffBase(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)
    fathers_name: str | None = None
    mothers_name: str | None = None
    gender: str | None = None
    date_of_birth: date | None = None

    designation: str = Field(min_length=1, max_length=255)
    mode_of_service: str | None = None
    head: str | None = None
    present_posting_place: str | None = None
    appointment_order_no: str | None = None
    date_of_joining: date | None = None
    present_basic_pay: str | None = None

    # MACP dates (auto-calculated but can be overridden)
    first_macp: date | None = None
    second_macp: date | None = None
    third_macp: date | None = None

    # Date of Retirement (auto-calculated but can be overridden)
    date_of_retirement: date | None = None

    present_address: str | None = None
    permanent_address: str | None = None

    phone: str | None = None
    email: EmailStr | None = None

    aadhaar_number: str | None = None
    pan_number: str | None = None

    remarks: str | None = None

    extra: dict[str, Any] | None = None


class HRStaffCreate(HRStaffBase):
    pass


class HRStaffUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    fathers_name: str | None = None
    mothers_name: str | None = None
    gender: str | None = None
    date_of_birth: date | None = None

    designation: str | None = Field(default=None, min_length=1, max_length=255)
    mode_of_service: str | None = None
    head: str | None = None
    present_posting_place: str | None = None
    appointment_order_no: str | None = None
    date_of_joining: date | None = None
    present_basic_pay: str | None = None

    first_macp: date | None = None
    second_macp: date | None = None
    third_macp: date | None = None

    date_of_retirement: date | None = None

    present_address: str | None = None
    permanent_address: str | None = None

    phone: str | None = None
    email: EmailStr | None = None

    aadhaar_number: str | None = None
    pan_number: str | None = None

    remarks: str | None = None

    extra: dict[str, Any] | None = None


class HRStaffRead(HRStaffBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime

    # Computed by API routes (not stored in DB)
    photo_url: str | None = None
    display_id: str | None = None
    age: int | None = None
    total_years_in_service: int | None = None
