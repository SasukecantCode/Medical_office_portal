from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, Field


class HRFieldDefBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    label: str = Field(min_length=1, max_length=255)
    data_type: str = "string"
    sort_order: int = 0
    required: bool = False


class HRFieldDefCreate(HRFieldDefBase):
    pass


class HRFieldDefUpdate(BaseModel):
    name: str | None = None
    label: str | None = None
    data_type: str | None = None
    sort_order: int | None = None
    required: bool | None = None


class HRFieldDefRead(HRFieldDefBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
