from __future__ import annotations

import io
import zipfile

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse

from app.schemas.documents import (
    DocumentCreateFolderRequest,
    DocumentDeleteRequest,
    DocumentListRead,
    DocumentRenameRequest,
    DocumentItemRead,
)
from app.services.document_storage import (
    get_document_storage_service,
    normalize_document_inputs,
    validate_category,
    validate_employee_id,
    validate_file_path,
    validate_upload_request,
)

router = APIRouter(prefix="/documents")


@router.post("/create-folder")
def create_folder(
    payload: DocumentCreateFolderRequest,
    storage=Depends(get_document_storage_service),
):
    employee_id = validate_employee_id(payload.employee_id)
    storage.create_employee_folder(employee_id)
    return {"status": "created", "employee_id": employee_id}


@router.post("/upload", response_model=DocumentItemRead)
def upload_document(
    employee_id: str = Query(...),
    category: str = Query(...),
    file: UploadFile = File(...),
    storage=Depends(get_document_storage_service),
):
    employee_id, category, _ = normalize_document_inputs(employee_id, category, None)
    validate_upload_request(file)
    return storage.upload_employee_document(employee_id, category, file)



@router.get("/download")
def download_document(
    employee_id: str = Query(...),
    file_path: str = Query(...),
    storage=Depends(get_document_storage_service),
):
    employee_id = validate_employee_id(employee_id)
    file_path = validate_file_path(employee_id, file_path)
    blob = storage.download_document(employee_id, file_path)
    filename = file_path.split("/", 1)[-1]
    stream = blob.open("rb")
    headers = {"Content-Disposition": f'inline; filename="{filename}"'}
    return StreamingResponse(stream, media_type=blob.content_type or "application/octet-stream", headers=headers)


@router.delete("/delete")
def delete_document(
    payload: DocumentDeleteRequest,
    storage=Depends(get_document_storage_service),
):
    employee_id = validate_employee_id(payload.employee_id)
    file_path = validate_file_path(employee_id, payload.file_path)
    storage.delete_document(employee_id, file_path)
    return {"status": "deleted"}


@router.put("/rename", response_model=DocumentItemRead)
def rename_document(
    payload: DocumentRenameRequest,
    storage=Depends(get_document_storage_service),
):
    employee_id = validate_employee_id(payload.employee_id)
    old_path = validate_file_path(employee_id, payload.old_path)
    new_path = validate_file_path(employee_id, payload.new_path)
    validate_category(new_path.split("/", 1)[0])
    return storage.rename_document(employee_id, old_path, new_path)


@router.get("/download-all/{employee_id}")
def download_employee_zip(
    employee_id: str,
    storage=Depends(get_document_storage_service),
):
    employee_id = validate_employee_id(employee_id)
    blobs = storage.download_employee_zip(employee_id)
    if not blobs:
        raise HTTPException(status_code=404, detail="No documents found")

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        prefix = f"{employee_id}/"
        for blob in blobs:
            rel_path = blob.name[len(prefix) :]
            if not rel_path:
                continue
            data = blob.download_as_bytes()
            zf.writestr(rel_path, data)

    zip_buffer.seek(0)
    headers = {"Content-Disposition": f'attachment; filename="{employee_id}_Documents.zip"'}
    return StreamingResponse(zip_buffer, media_type="application/zip", headers=headers)

@router.get("/{employee_id}", response_model=DocumentListRead)
def list_documents(
    employee_id: str,
    storage=Depends(get_document_storage_service),
):
    employee_id = validate_employee_id(employee_id)
    items = storage.list_employee_documents(employee_id)
    return {"employee_id": employee_id, "documents": items}
