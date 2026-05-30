from __future__ import annotations

import mimetypes
import os
import re
import shutil
from dataclasses import dataclass
from datetime import datetime
from functools import lru_cache
from typing import Iterable

from fastapi import HTTPException, UploadFile
from google.cloud import storage

from app.core.config import settings


ALLOWED_CATEGORIES = ["Personal", "Medical", "Employment", "Other"]
ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx"}
EMPLOYEE_ID_PATTERN = re.compile(r"^[a-zA-Z0-9_\-\s]+_EMP\d{3,}$|^EMP\d{3,}$")


@dataclass(frozen=True)
class DocumentItem:
    file_path: str
    file_name: str
    category: str
    size: int
    content_type: str | None
    updated_at: str | None


class GCSDocumentStorageService:
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
        old_blob = self._get_blob(employee_id, old_path)
        if old_blob is None:
            raise HTTPException(status_code=404, detail="Document not found")
        new_blob_name = f"{employee_id}/{new_path}"
        new_blob = self.bucket.rename_blob(old_blob, new_blob_name)
        return self._blob_to_item(new_blob, employee_id)

    def rename_employee_folder(self, old_employee_id: str, new_employee_id: str) -> None:
        blobs = list(self.bucket.list_blobs(prefix=f"{old_employee_id}/"))
        for blob in blobs:
            new_name = blob.name.replace(f"{old_employee_id}/", f"{new_employee_id}/", 1)
            self.bucket.rename_blob(blob, new_name)

    def delete_employee_folder(self, employee_id: str) -> None:
        blobs = list(self.bucket.list_blobs(prefix=f"{employee_id}/"))
        for blob in blobs:
            blob.delete()

    def _blob_to_item(self, blob: storage.Blob, employee_id: str) -> DocumentItem:
        rel_path = blob.name[len(employee_id) + 1 :]
        category = rel_path.split("/", 1)[0] if "/" in rel_path else ""
        return DocumentItem(
            file_path=rel_path,
            file_name=os.path.basename(rel_path),
            category=category,
            size=int(blob.size or 0),
            content_type=blob.content_type,
            updated_at=blob.updated.strftime("%Y-%m-%dT%H:%M:%SZ") if blob.updated else None,
        )

    def download_employee_zip(self, employee_id: str) -> list[storage.Blob]:
        prefix = f"{employee_id}/"
        blobs = [b for b in self.bucket.list_blobs(prefix=prefix) if not b.name.endswith("/")]
        return blobs

    def _get_blob(self, employee_id: str, file_path: str) -> storage.Blob | None:
        blob = self.bucket.blob(f"{employee_id}/{file_path}")
        return blob if blob.exists() else None


class MockBlob:
    def __init__(self, full_path: str, bucket_path: str):
        self._full_path = full_path
        self.name = bucket_path
        self.size = os.path.getsize(full_path) if os.path.exists(full_path) else 0
        self.content_type, _ = mimetypes.guess_type(full_path)
        if os.path.exists(full_path):
            self.updated = datetime.fromtimestamp(os.path.getmtime(full_path))
        else:
            self.updated = None

    def open(self, mode="rb"):
        return open(self._full_path, mode)

    def download_as_bytes(self) -> bytes:
        with open(self._full_path, "rb") as f:
            return f.read()

    def delete(self):
        if os.path.exists(self._full_path):
            os.remove(self._full_path)


class LocalDocumentStorageService:
    def __init__(self, base_dir: str):
        self.base_dir = os.path.abspath(base_dir)
        os.makedirs(self.base_dir, exist_ok=True)

    def _get_abs_path(self, *parts):
        return os.path.join(self.base_dir, *parts)

    def create_employee_folder(self, employee_id: str) -> None:
        for c in ALLOWED_CATEGORIES:
            os.makedirs(self._get_abs_path(employee_id, c), exist_ok=True)

    def delete_employee_folder(self, employee_id: str) -> None:
        emp_dir = self._get_abs_path(employee_id)
        if os.path.exists(emp_dir):
            shutil.rmtree(emp_dir)

    def upload_employee_document(self, employee_id: str, category: str, file: UploadFile) -> DocumentItem:
        file_name = _sanitize_filename(file.filename or "document")
        dest_dir = self._get_abs_path(employee_id, category)
        os.makedirs(dest_dir, exist_ok=True)
        dest_path = os.path.join(dest_dir, file_name)
        
        with open(dest_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
            
        size = os.path.getsize(dest_path)
        content_type = file.content_type or "application/octet-stream"
        updated = datetime.fromtimestamp(os.path.getmtime(dest_path))
        
        return DocumentItem(
            file_path=f"{category}/{file_name}",
            file_name=file_name,
            category=category,
            size=size,
            content_type=content_type,
            updated_at=updated.strftime("%Y-%m-%dT%H:%M:%SZ"),
        )

    def list_employee_documents(self, employee_id: str) -> list[DocumentItem]:
        emp_dir = self._get_abs_path(employee_id)
        items = []
        if not os.path.exists(emp_dir):
            return items
            
        for root, dirs, files in os.walk(emp_dir):
            for file_name in files:
                full_path = os.path.join(root, file_name)
                rel_path = os.path.relpath(full_path, emp_dir)
                category = rel_path.split(os.sep)[0] if os.sep in rel_path else ""
                rel_path_fwd = rel_path.replace(os.sep, "/")
                
                size = os.path.getsize(full_path)
                content_type, _ = mimetypes.guess_type(full_path)
                updated = datetime.fromtimestamp(os.path.getmtime(full_path))
                
                items.append(
                    DocumentItem(
                        file_path=rel_path_fwd,
                        file_name=file_name,
                        category=category,
                        size=size,
                        content_type=content_type,
                        updated_at=updated.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    )
                )
        return items

    def _get_blob(self, employee_id: str, file_path: str) -> MockBlob | None:
        file_path_os = file_path.replace("/", os.sep)
        full_path = self._get_abs_path(employee_id, file_path_os)
        if not os.path.exists(full_path) or not os.path.isfile(full_path):
            return None
        return MockBlob(full_path, f"{employee_id}/{file_path}")

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
        old_full = self._get_abs_path(employee_id, old_path.replace("/", os.sep))
        new_full = self._get_abs_path(employee_id, new_path.replace("/", os.sep))
        
        if not os.path.exists(old_full):
            raise HTTPException(status_code=404, detail="Document not found")
            
        os.makedirs(os.path.dirname(new_full), exist_ok=True)
        os.rename(old_full, new_full)
        
        size = os.path.getsize(new_full)
        content_type, _ = mimetypes.guess_type(new_full)
        updated = datetime.fromtimestamp(os.path.getmtime(new_full))
        category = new_path.split("/")[0] if "/" in new_path else ""
        
        return DocumentItem(
            file_path=new_path,
            file_name=os.path.basename(new_path),
            category=category,
            size=size,
            content_type=content_type,
            updated_at=updated.strftime("%Y-%m-%dT%H:%M:%SZ"),
        )

    def download_employee_zip(self, employee_id: str) -> list[MockBlob]:
        emp_dir = self._get_abs_path(employee_id)
        blobs = []
        if not os.path.exists(emp_dir):
            return blobs
            
        for root, dirs, files in os.walk(emp_dir):
            for file_name in files:
                full_path = os.path.join(root, file_name)
                rel_path = os.path.relpath(full_path, emp_dir).replace(os.sep, "/")
                blobs.append(MockBlob(full_path, f"{employee_id}/{rel_path}"))
        return blobs


@lru_cache
def get_document_storage_service():
    try:
        service = GCSDocumentStorageService(settings.gcs_bucket_name)
        # Verify connection by checking if bucket exists
        if not service.bucket.exists():
            raise ValueError(f"GCS Bucket '{settings.gcs_bucket_name}' does not exist or is inaccessible.")
        return service
    except Exception as e:
        import logging
        logging.error(f"FATAL: Failed to connect to Google Cloud Storage: {e}")
        raise RuntimeError("Google Cloud Storage connection failed. Document Vault requires a valid GCS connection.") from e


def _sanitize_filename(filename: str) -> str:
    name = os.path.basename(filename.replace("\\", "/"))
    name = name.strip().replace("..", "")
    return name or "document"


def _validate_employee_id(employee_id: str) -> str:
    employee_id = employee_id.strip()
    if not EMPLOYEE_ID_PATTERN.fullmatch(employee_id):
        raise HTTPException(status_code=400, detail=f"Invalid employee ID format: '{employee_id}'")
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
