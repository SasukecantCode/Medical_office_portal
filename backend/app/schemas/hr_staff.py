from __future__ import annotations

from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class HRStaffBase(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)
    gender: str | None = None
    date_of_birth: date | None = None

    designation: str = Field(min_length=1, max_length=255)
    cadre: str | None = None
    employment_type: str | None = None

    phone: str | None = None
    email: EmailStr | None = None

    facility_name: str = Field(min_length=1, max_length=255)
    facility_type: str | None = None

    district: str = Field(min_length=1, max_length=255)
    block: str | None = None
    posting_place: str | None = None

    date_of_joining: date | None = None
    remarks: str | None = None

    extra: dict[str, Any] | None = None


class HRStaffCreate(HRStaffBase):
    pass


class HRStaffUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    gender: str | None = None
    date_of_birth: date | None = None

    designation: str | None = Field(default=None, min_length=1, max_length=255)
    cadre: str | None = None
    employment_type: str | None = None

    phone: str | None = None
    email: EmailStr | None = None

    facility_name: str | None = Field(default=None, min_length=1, max_length=255)
    facility_type: str | None = None

    district: str | None = Field(default=None, min_length=1, max_length=255)
    block: str | None = None
    posting_place: str | None = None

    date_of_joining: date | None = None
    remarks: str | None = None

    extra: dict[str, Any] | None = None


class HRStaffRead(HRStaffBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime
