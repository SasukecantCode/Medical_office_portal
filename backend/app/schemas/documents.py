from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class DocumentItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    file_path: str
    file_name: str
    category: str
    size: int
    content_type: str | None = None
    updated_at: str | None = None


class DocumentListRead(BaseModel):
    employee_id: str
    documents: list[DocumentItemRead]


class DocumentCreateFolderRequest(BaseModel):
    employee_id: str


class DocumentRenameRequest(BaseModel):
    employee_id: str
    old_path: str
    new_path: str


class DocumentDeleteRequest(BaseModel):
    employee_id: str
    file_path: str
