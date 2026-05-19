from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class HRStaffAttachmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    staff_id: int
    original_filename: str
    content_type: str | None = None
    created_at: datetime

    url: str | None = None
