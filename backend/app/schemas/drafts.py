from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class DraftItem(BaseModel):
    employee_id: str
    draft_id: str
    title: str
    file_path: str
    file_name: str
    document_key: str
    version: int
    size: int
    content_type: str | None = None
    created_at: str
    updated_at: str


class DraftCreateRequest(BaseModel):
    employee_id: str
    title: str | None = Field(default=None, max_length=128)


class DraftRenameRequest(BaseModel):
    title: str = Field(..., max_length=128)


class DraftRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    employee_id: str
    draft_id: str
    title: str
    file_path: str
    file_name: str
    document_key: str
    version: int
    size: int
    content_type: str | None = None
    created_at: str
    updated_at: str


class DraftListRead(BaseModel):
    employee_id: str
    drafts: list[DraftRead]


class DraftConfigRead(BaseModel):
    employee_id: str
    draft: DraftRead
    editor_config: dict[str, Any]
    document_server_url: str