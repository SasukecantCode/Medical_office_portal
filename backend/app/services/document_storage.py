from __future__ import annotations

import json
import mimetypes
import os
import re
import shutil
from dataclasses import dataclass
from datetime import datetime
from functools import lru_cache
from typing import Iterable
from uuid import uuid4

from fastapi import HTTPException, UploadFile
from google.cloud import storage

from app.core.config import settings


ALLOWED_CATEGORIES = ["Personal", "Medical", "Employment", "Other"]
ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx"}
EMPLOYEE_ID_PATTERN = re.compile(r"^[a-zA-Z0-9_\-\s]+_EMP\d{3,}$|^EMP\d{3,}$")
HIDDEN_DRAFT_FOLDER = ".drafts"
DOCX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
DEFAULT_DRAFT_TITLE = "Untitled Draft"


@dataclass(frozen=True)
class DocumentItem:
    file_path: str
    file_name: str
    category: str
    size: int
    content_type: str | None
    updated_at: str | None


@dataclass(frozen=True)
class DraftItem:
    employee_id: str
    draft_id: str
    title: str
    file_path: str
    file_name: str
    document_key: str
    version: int
    size: int
    content_type: str | None
    created_at: str
    updated_at: str


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

    def create_employee_draft_folder(self, employee_id: str) -> None:
        blob = self.bucket.blob(f"{employee_id}/{HIDDEN_DRAFT_FOLDER}/")
        if not blob.exists():
            blob.upload_from_string(b"")

    def create_employee_draft(self, employee_id: str, title: str, content: bytes) -> DraftItem:
        self.create_employee_draft_folder(employee_id)
        draft_id = uuid4().hex
        now = _now_utc_iso()
        clean_title = _normalize_draft_title(title)
        item = DraftItem(
            employee_id=employee_id,
            draft_id=draft_id,
            title=clean_title,
            file_path=f"{HIDDEN_DRAFT_FOLDER}/{draft_id}.docx",
            file_name=_draft_file_name(clean_title),
            document_key=f"{draft_id}_1",
            version=1,
            size=len(content),
            content_type=DOCX_MIME_TYPE,
            created_at=now,
            updated_at=now,
        )
        self._write_draft_content(employee_id, draft_id, content)
        self._write_draft_metadata(employee_id, item)
        return item

    def list_employee_drafts(self, employee_id: str) -> list[DraftItem]:
        prefix = f"{employee_id}/{HIDDEN_DRAFT_FOLDER}/"
        items: list[DraftItem] = []
        for blob in self.bucket.list_blobs(prefix=prefix):
            if blob.name.endswith("/") or not blob.name.endswith(".json"):
                continue
            try:
                data = json.loads(blob.download_as_text())
                items.append(_draft_item_from_data(employee_id, data, size_hint=int(data.get("size") or 0)))
            except Exception:
                continue
        items.sort(key=lambda item: item.updated_at, reverse=True)
        return items

    def get_employee_draft(self, employee_id: str, draft_id: str) -> DraftItem:
        data = self._read_draft_metadata(employee_id, draft_id)
        if data is None:
            raise HTTPException(status_code=404, detail="Draft not found")
        return _draft_item_from_data(employee_id, data, size_hint=int(data.get("size") or 0))

    def get_employee_draft_blob(self, employee_id: str, draft_id: str):
        blob = self._get_draft_blob(employee_id, draft_id)
        if blob is None:
            raise HTTPException(status_code=404, detail="Draft not found")
        return blob

    def save_employee_draft(self, employee_id: str, draft_id: str, content: bytes, *, title: str | None = None) -> DraftItem:
        existing = self.get_employee_draft(employee_id, draft_id)
        version = existing.version + 1
        now = _now_utc_iso()
        clean_title = _normalize_draft_title(title or existing.title)
        item = DraftItem(
            employee_id=employee_id,
            draft_id=draft_id,
            title=clean_title,
            file_path=existing.file_path,
            file_name=_draft_file_name(clean_title),
            document_key=f"{draft_id}_{version}",
            version=version,
            size=len(content),
            content_type=DOCX_MIME_TYPE,
            created_at=existing.created_at,
            updated_at=now,
        )
        self._write_draft_content(employee_id, draft_id, content)
        self._write_draft_metadata(employee_id, item)
        return item

    def delete_employee_draft(self, employee_id: str, draft_id: str) -> None:
        doc_blob = self._get_draft_blob(employee_id, draft_id)
        meta_blob = self._get_draft_meta_blob(employee_id, draft_id)
        if doc_blob is None or meta_blob is None:
            raise HTTPException(status_code=404, detail="Draft not found")
        doc_blob.delete()
        meta_blob.delete()

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
            if blob.name.endswith("/") or f"/{HIDDEN_DRAFT_FOLDER}/" in blob.name:
                continue
            rel_path = blob.name[len(prefix) :]
            if rel_path.endswith(".json") or rel_path.startswith(f"{HIDDEN_DRAFT_FOLDER}/"):
                continue
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

    def _draft_doc_name(self, draft_id: str) -> str:
        return f"{HIDDEN_DRAFT_FOLDER}/{draft_id}.docx"

    def _draft_meta_name(self, draft_id: str) -> str:
        return f"{HIDDEN_DRAFT_FOLDER}/{draft_id}.json"

    def _get_draft_blob(self, employee_id: str, draft_id: str):
        blob = self.bucket.blob(f"{employee_id}/{self._draft_doc_name(draft_id)}")
        return blob if blob.exists() else None

    def _get_draft_meta_blob(self, employee_id: str, draft_id: str):
        blob = self.bucket.blob(f"{employee_id}/{self._draft_meta_name(draft_id)}")
        return blob if blob.exists() else None

    def _write_draft_content(self, employee_id: str, draft_id: str, content: bytes) -> None:
        blob = self.bucket.blob(f"{employee_id}/{self._draft_doc_name(draft_id)}")
        blob.upload_from_string(content, content_type=DOCX_MIME_TYPE)

    def _write_draft_metadata(self, employee_id: str, item: DraftItem) -> None:
        blob = self.bucket.blob(f"{employee_id}/{self._draft_meta_name(item.draft_id)}")
        payload = json.dumps(
            {
                "employee_id": item.employee_id,
                "draft_id": item.draft_id,
                "title": item.title,
                "file_path": item.file_path,
                "file_name": item.file_name,
                "document_key": item.document_key,
                "version": item.version,
                "size": item.size,
                "content_type": item.content_type,
                "created_at": item.created_at,
                "updated_at": item.updated_at,
            },
            ensure_ascii=True,
        )
        blob.upload_from_string(payload, content_type="application/json")

    def _read_draft_metadata(self, employee_id: str, draft_id: str) -> dict | None:
        blob = self._get_draft_meta_blob(employee_id, draft_id)
        if blob is None:
            return None
        try:
            return json.loads(blob.download_as_text())
        except Exception:
            return None

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
        blobs = [
            b
            for b in self.bucket.list_blobs(prefix=prefix)
            if not b.name.endswith("/") and f"/{HIDDEN_DRAFT_FOLDER}/" not in b.name and not b.name.endswith(".json")
        ]
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

    def create_employee_draft_folder(self, employee_id: str) -> None:
        os.makedirs(self._get_abs_path(employee_id, HIDDEN_DRAFT_FOLDER), exist_ok=True)

    def create_employee_draft(self, employee_id: str, title: str, content: bytes) -> DraftItem:
        self.create_employee_draft_folder(employee_id)
        draft_id = uuid4().hex
        now = _now_utc_iso()
        clean_title = _normalize_draft_title(title)
        item = DraftItem(
            employee_id=employee_id,
            draft_id=draft_id,
            title=clean_title,
            file_path=f"{HIDDEN_DRAFT_FOLDER}/{draft_id}.docx",
            file_name=_draft_file_name(clean_title),
            document_key=f"{draft_id}_1",
            version=1,
            size=len(content),
            content_type=DOCX_MIME_TYPE,
            created_at=now,
            updated_at=now,
        )
        self._write_draft_content(employee_id, draft_id, content)
        self._write_draft_metadata(employee_id, item)
        return item

    def delete_employee_folder(self, employee_id: str) -> None:
        emp_dir = self._get_abs_path(employee_id)
        if os.path.exists(emp_dir):
            shutil.rmtree(emp_dir)

    def list_employee_drafts(self, employee_id: str) -> list[DraftItem]:
        draft_dir = self._get_abs_path(employee_id, HIDDEN_DRAFT_FOLDER)
        if not os.path.exists(draft_dir):
            return []

        items: list[DraftItem] = []
        for file_name in os.listdir(draft_dir):
            if not file_name.endswith(".json"):
                continue
            meta_path = os.path.join(draft_dir, file_name)
            try:
                with open(meta_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                items.append(_draft_item_from_data(employee_id, data, size_hint=int(data.get("size") or 0)))
            except Exception:
                continue
        items.sort(key=lambda item: item.updated_at, reverse=True)
        return items

    def get_employee_draft(self, employee_id: str, draft_id: str) -> DraftItem:
        data = self._read_draft_metadata(employee_id, draft_id)
        if data is None:
            raise HTTPException(status_code=404, detail="Draft not found")
        return _draft_item_from_data(employee_id, data, size_hint=int(data.get("size") or 0))

    def get_employee_draft_blob(self, employee_id: str, draft_id: str) -> MockBlob:
        blob = self._get_draft_blob(employee_id, draft_id)
        if blob is None:
            raise HTTPException(status_code=404, detail="Draft not found")
        return blob

    def save_employee_draft(self, employee_id: str, draft_id: str, content: bytes, *, title: str | None = None) -> DraftItem:
        existing = self.get_employee_draft(employee_id, draft_id)
        version = existing.version + 1
        now = _now_utc_iso()
        clean_title = _normalize_draft_title(title or existing.title)
        item = DraftItem(
            employee_id=employee_id,
            draft_id=draft_id,
            title=clean_title,
            file_path=existing.file_path,
            file_name=_draft_file_name(clean_title),
            document_key=f"{draft_id}_{version}",
            version=version,
            size=len(content),
            content_type=DOCX_MIME_TYPE,
            created_at=existing.created_at,
            updated_at=now,
        )
        self._write_draft_content(employee_id, draft_id, content)
        self._write_draft_metadata(employee_id, item)
        return item

    def delete_employee_draft(self, employee_id: str, draft_id: str) -> None:
        doc_path = self._get_abs_path(employee_id, HIDDEN_DRAFT_FOLDER, f"{draft_id}.docx")
        meta_path = self._get_abs_path(employee_id, HIDDEN_DRAFT_FOLDER, f"{draft_id}.json")
        if not os.path.exists(doc_path) or not os.path.exists(meta_path):
            raise HTTPException(status_code=404, detail="Draft not found")
        os.remove(doc_path)
        os.remove(meta_path)

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
            dirs[:] = [d for d in dirs if not d.startswith(".")]
            for file_name in files:
                if file_name.endswith(".json"):
                    continue
                full_path = os.path.join(root, file_name)
                rel_path = os.path.relpath(full_path, emp_dir)
                category = rel_path.split(os.sep)[0] if os.sep in rel_path else ""
                if category.startswith("."):
                    continue
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
            dirs[:] = [d for d in dirs if not d.startswith(".")]
            for file_name in files:
                if file_name.endswith(".json"):
                    continue
                full_path = os.path.join(root, file_name)
                rel_path = os.path.relpath(full_path, emp_dir).replace(os.sep, "/")
                if rel_path.startswith(f"{HIDDEN_DRAFT_FOLDER}/"):
                    continue
                blobs.append(MockBlob(full_path, f"{employee_id}/{rel_path}"))
        return blobs

    def _get_draft_blob(self, employee_id: str, draft_id: str) -> MockBlob | None:
        doc_path = self._get_abs_path(employee_id, HIDDEN_DRAFT_FOLDER, f"{draft_id}.docx")
        if not os.path.exists(doc_path) or not os.path.isfile(doc_path):
            return None
        return MockBlob(doc_path, f"{employee_id}/{HIDDEN_DRAFT_FOLDER}/{draft_id}.docx")

    def _read_draft_metadata(self, employee_id: str, draft_id: str) -> dict | None:
        meta_path = self._get_abs_path(employee_id, HIDDEN_DRAFT_FOLDER, f"{draft_id}.json")
        if not os.path.exists(meta_path) or not os.path.isfile(meta_path):
            return None
        try:
            with open(meta_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return None

    def _write_draft_content(self, employee_id: str, draft_id: str, content: bytes) -> None:
        doc_path = self._get_abs_path(employee_id, HIDDEN_DRAFT_FOLDER, f"{draft_id}.docx")
        os.makedirs(os.path.dirname(doc_path), exist_ok=True)
        with open(doc_path, "wb") as f:
            f.write(content)

    def _write_draft_metadata(self, employee_id: str, item: DraftItem) -> None:
        meta_path = self._get_abs_path(employee_id, HIDDEN_DRAFT_FOLDER, f"{item.draft_id}.json")
        os.makedirs(os.path.dirname(meta_path), exist_ok=True)
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(
                {
                    "employee_id": item.employee_id,
                    "draft_id": item.draft_id,
                    "title": item.title,
                    "file_path": item.file_path,
                    "file_name": item.file_name,
                    "document_key": item.document_key,
                    "version": item.version,
                    "size": item.size,
                    "content_type": item.content_type,
                    "created_at": item.created_at,
                    "updated_at": item.updated_at,
                },
                f,
                ensure_ascii=True,
            )


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


def _normalize_draft_title(title: str) -> str:
    cleaned = (title or DEFAULT_DRAFT_TITLE).strip()
    cleaned = cleaned.replace("/", "-").replace("\\", "-")
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned[:128] if len(cleaned) > 128 else cleaned or DEFAULT_DRAFT_TITLE


def _draft_file_name(title: str) -> str:
    clean_title = _normalize_draft_title(title)
    return clean_title if clean_title.lower().endswith(".docx") else f"{clean_title}.docx"


def _now_utc_iso() -> str:
    return datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")


def _draft_item_from_data(employee_id: str, data: dict, *, size_hint: int = 0) -> DraftItem:
    draft_id = str(data.get("draft_id") or "").strip()
    if not draft_id:
        raise ValueError("Missing draft_id")
    title = _normalize_draft_title(str(data.get("title") or DEFAULT_DRAFT_TITLE))
    version = int(data.get("version") or 1)
    created_at = str(data.get("created_at") or _now_utc_iso())
    updated_at = str(data.get("updated_at") or created_at)
    file_path = str(data.get("file_path") or f"{HIDDEN_DRAFT_FOLDER}/{draft_id}.docx")
    file_name = str(data.get("file_name") or _draft_file_name(title))
    document_key_raw = str(data.get("document_key") or f"{draft_id}_{version}")
    document_key = document_key_raw.replace(":", "_")
    content_type = data.get("content_type") or DOCX_MIME_TYPE
    size = int(data.get("size") or size_hint or 0)
    return DraftItem(
        employee_id=employee_id,
        draft_id=draft_id,
        title=title,
        file_path=file_path,
        file_name=file_name,
        document_key=document_key,
        version=version,
        size=size,
        content_type=content_type,
        created_at=created_at,
        updated_at=updated_at,
    )
