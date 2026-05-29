from __future__ import annotations

import os
import re
from dataclasses import dataclass
from functools import lru_cache
from typing import Iterable

from fastapi import HTTPException, UploadFile
from google.cloud import storage

from app.core.config import settings


ALLOWED_CATEGORIES = ["Personal", "Medical", "Employment", "Other"]
ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx"}
EMPLOYEE_ID_PATTERN = re.compile(r"^EMP\d{3,}$")


@dataclass(frozen=True)
class DocumentItem:
    file_path: str
    file_name: str
    category: str
    size: int
    content_type: str | None
    updated_at: str | None


class DocumentStorageService:
    def __init__(self, bucket_name: str):
        self.client = storage.Client()
        self.bucket = self.client.bucket(bucket_name)

    def create_employee_folder(self, employee_id: str) -> None:
        prefixes = [f"{employee_id}/"] + [f"{employee_id}/{c}/" for c in ALLOWED_CATEGORIES]
        for name in prefixes:
            blob = self.bucket.blob(name)
            if not blob.exists():
                blob.upload_from_string(b"")

    def upload_employee_document(self, employee_id: str, category: str, file: UploadFile) -> DocumentItem:
        file_name = _sanitize_filename(file.filename or "document")
        object_name = f"{employee_id}/{category}/{file_name}"
        blob = self.bucket.blob(object_name)
        content_type = file.content_type or "application/octet-stream"
        blob.upload_from_file(file.file, content_type=content_type)
        blob.reload()
        return DocumentItem(
            file_path=f"{category}/{file_name}",
            file_name=file_name,
            category=category,
            size=int(blob.size or 0),
            content_type=blob.content_type,
            updated_at=blob.updated.strftime("%Y-%m-%dT%H:%M:%SZ") if blob.updated else None,
        )

    def list_employee_documents(self, employee_id: str) -> list[DocumentItem]:
        prefix = f"{employee_id}/"
        items: list[DocumentItem] = []
        for blob in self.bucket.list_blobs(prefix=prefix):
            if blob.name.endswith("/"):
                continue
            rel_path = blob.name[len(prefix) :]
            category = rel_path.split("/", 1)[0] if "/" in rel_path else ""
            items.append(
                DocumentItem(
                    file_path=rel_path,
                    file_name=os.path.basename(rel_path),
                    category=category,
                    size=int(blob.size or 0),
                    content_type=blob.content_type,
                    updated_at=blob.updated.strftime("%Y-%m-%dT%H:%M:%SZ") if blob.updated else None,
                )
            )
        return items

    def download_document(self, employee_id: str, file_path: str):
        blob = self._get_blob(employee_id, file_path)
        if blob is None:
            raise HTTPException(status_code=404, detail="Document not found")
        return blob

    def delete_document(self, employee_id: str, file_path: str) -> None:
        blob = self._get_blob(employee_id, file_path)
        if blob is None:
            raise HTTPException(status_code=404, detail="Document not found")
        blob.delete()

    def rename_document(self, employee_id: str, old_path: str, new_path: str) -> DocumentItem:
        source_blob = self._get_blob(employee_id, old_path)
        if source_blob is None:
            raise HTTPException(status_code=404, detail="Document not found")
        destination_name = f"{employee_id}/{new_path}"
        new_blob = self.bucket.copy_blob(source_blob, self.bucket, destination_name)
        source_blob.delete()
        new_blob.reload()
        rel_path = new_path
        category = rel_path.split("/", 1)[0] if "/" in rel_path else ""
        return DocumentItem(
            file_path=rel_path,
            file_name=os.path.basename(rel_path),
            category=category,
            size=int(new_blob.size or 0),
            content_type=new_blob.content_type,
            updated_at=new_blob.updated.strftime("%Y-%m-%dT%H:%M:%SZ") if new_blob.updated else None,
        )

    def download_employee_zip(self, employee_id: str) -> list[storage.Blob]:
        prefix = f"{employee_id}/"
        blobs = [b for b in self.bucket.list_blobs(prefix=prefix) if not b.name.endswith("/")]
        return blobs

    def _get_blob(self, employee_id: str, file_path: str) -> storage.Blob | None:
        blob = self.bucket.blob(f"{employee_id}/{file_path}")
        return blob if blob.exists() else None


@lru_cache
def get_document_storage_service() -> DocumentStorageService:
    return DocumentStorageService(settings.gcs_bucket_name)


def _sanitize_filename(filename: str) -> str:
    name = os.path.basename(filename.replace("\\", "/"))
    name = name.strip().replace("..", "")
    return name or "document"


def _validate_employee_id(employee_id: str) -> str:
    employee_id = employee_id.strip().upper()
    if not EMPLOYEE_ID_PATTERN.fullmatch(employee_id):
        raise HTTPException(status_code=400, detail="Invalid employee ID format")
    return employee_id


def _validate_category(category: str) -> str:
    if category not in ALLOWED_CATEGORIES:
        raise HTTPException(status_code=400, detail="Invalid document category")
    return category


def _validate_file_path(employee_id: str, file_path: str) -> str:
    cleaned = file_path.strip().lstrip("/")
    if not cleaned or ".." in cleaned or cleaned.startswith("/"):
        raise HTTPException(status_code=400, detail="Invalid file path")
    if cleaned.startswith(f"{employee_id}/"):
        cleaned = cleaned[len(employee_id) + 1 :]
    parts = cleaned.split("/")
    if len(parts) < 2:
        raise HTTPException(status_code=400, detail="File path must include category and filename")
    _validate_category(parts[0])
    return cleaned


def _validate_upload(file: UploadFile) -> None:
    filename = file.filename or ""
    _, ext = os.path.splitext(filename.lower())
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Unsupported file type")

    size = _get_upload_size(file)
    if size <= 0:
        raise HTTPException(status_code=400, detail="Empty file")
    if size > settings.document_max_size_bytes:
        raise HTTPException(status_code=400, detail="File exceeds size limit")


def _get_upload_size(file: UploadFile) -> int:
    try:
        file.file.seek(0, os.SEEK_END)
        size = file.file.tell()
        file.file.seek(0)
        return int(size)
    except Exception:
        return 0


def normalize_document_inputs(employee_id: str, category: str | None, file_path: str | None) -> tuple[str, str | None, str | None]:
    normalized_id = _validate_employee_id(employee_id)
    normalized_category = _validate_category(category) if category is not None else None
    normalized_path = _validate_file_path(normalized_id, file_path) if file_path is not None else None
    return normalized_id, normalized_category, normalized_path


def validate_upload_request(file: UploadFile) -> None:
    _validate_upload(file)


def validate_employee_id(employee_id: str) -> str:
    return _validate_employee_id(employee_id)


def validate_file_path(employee_id: str, file_path: str) -> str:
    return _validate_file_path(employee_id, file_path)


def validate_category(category: str) -> str:
    return _validate_category(category)


def allowed_extensions() -> Iterable[str]:
    return sorted(ALLOWED_EXTENSIONS)


def create_employee_folder(employee_id: str) -> None:
    storage = get_document_storage_service()
    storage.create_employee_folder(employee_id)


def upload_employee_document(employee_id: str, category: str, file: UploadFile) -> DocumentItem:
    storage = get_document_storage_service()
    return storage.upload_employee_document(employee_id, category, file)


def list_employee_documents(employee_id: str) -> list[DocumentItem]:
    storage = get_document_storage_service()
    return storage.list_employee_documents(employee_id)


def download_document(employee_id: str, file_path: str):
    storage = get_document_storage_service()
    return storage.download_document(employee_id, file_path)


def delete_document(employee_id: str, file_path: str) -> None:
    storage = get_document_storage_service()
    storage.delete_document(employee_id, file_path)


def rename_document(employee_id: str, old_path: str, new_path: str) -> DocumentItem:
    storage = get_document_storage_service()
    return storage.rename_document(employee_id, old_path, new_path)


def download_employee_zip(employee_id: str) -> list[storage.Blob]:
    storage = get_document_storage_service()
    return storage.download_employee_zip(employee_id)
