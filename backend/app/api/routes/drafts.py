from __future__ import annotations

import httpx

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse

from app.api.dependencies import require_roles
from app.core.config import settings
from app.schemas.drafts import DraftConfigRead, DraftCreateRequest, DraftListRead, DraftRead
from app.services.document_storage import (
    DOCX_MIME_TYPE,
    get_document_storage_service,
    validate_employee_id,
)
from app.services.onlyoffice_drafts import (
    build_access_token,
    build_blank_docx_bytes,
    sign_onlyoffice_config,
    verify_access_token,
)

router = APIRouter(prefix="/documents/drafts")


def _base_url(request: Request) -> str:
    return (settings.public_base_url or str(request.base_url)).rstrip("/")


def _draft_to_read(draft) -> DraftRead:
    return DraftRead.model_validate(draft)


@router.post("/create", response_model=DraftRead)
def create_draft(
    payload: DraftCreateRequest,
    request: Request,
    current_user=Depends(require_roles("hr", "master")),
    storage=Depends(get_document_storage_service),
):
    employee_id = validate_employee_id(payload.employee_id)
    title = (payload.title or "Untitled Draft").strip() or "Untitled Draft"
    draft = storage.create_employee_draft(employee_id, title, build_blank_docx_bytes(title))
    return _draft_to_read(draft)


@router.get("/{employee_id}", response_model=DraftListRead)
def list_drafts(
    employee_id: str,
    current_user=Depends(require_roles("hr", "master")),
    storage=Depends(get_document_storage_service),
):
    employee_id = validate_employee_id(employee_id)
    drafts = storage.list_employee_drafts(employee_id)
    return DraftListRead(employee_id=employee_id, drafts=[_draft_to_read(draft) for draft in drafts])


@router.get("/{employee_id}/{draft_id}", response_model=DraftRead)
def get_draft(
    employee_id: str,
    draft_id: str,
    current_user=Depends(require_roles("hr", "master")),
    storage=Depends(get_document_storage_service),
):
    employee_id = validate_employee_id(employee_id)
    draft = storage.get_employee_draft(employee_id, draft_id)
    return _draft_to_read(draft)


@router.get("/{employee_id}/{draft_id}/source")
def draft_source(
    employee_id: str,
    draft_id: str,
    token: str = Query(...),
    storage=Depends(get_document_storage_service),
):
    employee_id = validate_employee_id(employee_id)
    try:
        verify_access_token(token, employee_id, draft_id, "source")
    except Exception as exc:
        raise HTTPException(status_code=403, detail="Invalid draft access token") from exc
    blob = storage.get_employee_draft_blob(employee_id, draft_id)
    filename = f"{draft_id}.docx"

    if hasattr(blob, "download_as_bytes"):
        content = blob.download_as_bytes()
    else:
        with blob.open("rb") as f:
            content = f.read()

    headers = {
        "Content-Disposition": f'inline; filename="{filename}"',
        "Content-Length": str(len(content)),
        "Accept-Ranges": "bytes",
    }
    return StreamingResponse(iter([content]), media_type=DOCX_MIME_TYPE, headers=headers)


@router.get("/{employee_id}/{draft_id}/onlyoffice-config", response_model=DraftConfigRead)
def onlyoffice_config(
    employee_id: str,
    draft_id: str,
    request: Request,
    current_user=Depends(require_roles("hr", "master")),
    storage=Depends(get_document_storage_service),
):
    employee_id = validate_employee_id(employee_id)
    draft = storage.get_employee_draft(employee_id, draft_id)
    access_token = build_access_token(employee_id, draft_id, "source")
    callback_token = build_access_token(employee_id, draft_id, "callback")
    source_url = f"{_base_url(request)}/api/documents/drafts/{employee_id}/{draft_id}/source?token={access_token}"
    callback_url = f"{_base_url(request)}/api/documents/drafts/{employee_id}/{draft_id}/callback?token={callback_token}"
    current_user_name = getattr(current_user, "full_name", None) or getattr(current_user, "username", None) or "User"
    editor_config = {
        "documentType": "word",
        "document": {
            "fileType": "docx",
            "key": draft.document_key,
            "title": draft.file_name,
            "url": source_url,
            "permissions": {
                "edit": True,
                "download": True,
                "print": True,
                "copy": True,
            },
        },
        "editorConfig": {
            "mode": "edit",
            "callbackUrl": callback_url,
            "lang": "en",
            "user": {
                "id": str(getattr(current_user, "id", "0")),
                "name": current_user_name,
            },
        },
    }
    editor_config = sign_onlyoffice_config(editor_config)
    return DraftConfigRead(employee_id=employee_id, draft=_draft_to_read(draft), editor_config=editor_config)


@router.post("/{employee_id}/{draft_id}/callback")
async def onlyoffice_callback(
    employee_id: str,
    draft_id: str,
    request: Request,
    token: str = Query(...),
    storage=Depends(get_document_storage_service),
):
    employee_id = validate_employee_id(employee_id)
    try:
        verify_access_token(token, employee_id, draft_id, "callback")
    except Exception as exc:
        raise HTTPException(status_code=403, detail="Invalid draft access token") from exc
    payload = await request.json()
    status = int(payload.get("status") or 0)
    if status not in {2, 6}:
        return {"error": 0}

    url = payload.get("url")
    if not url:
        raise HTTPException(status_code=400, detail="ONLYOFFICE callback did not include a document URL")

    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.get(url)
        response.raise_for_status()
        content = response.content

    title = payload.get("title") or None
    storage.save_employee_draft(employee_id, draft_id, content, title=title)
    return {"error": 0}


@router.delete("/{employee_id}/{draft_id}")
def remove_draft(
    employee_id: str,
    draft_id: str,
    current_user=Depends(require_roles("hr", "master")),
    storage=Depends(get_document_storage_service),
):
    employee_id = validate_employee_id(employee_id)
    storage.delete_employee_draft(employee_id, draft_id)
    return {"status": "deleted", "employee_id": employee_id, "draft_id": draft_id}