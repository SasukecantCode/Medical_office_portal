from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse

from app.api.dependencies import require_roles
from app.schemas.drafts import DraftCreateRequest, DraftListRead, DraftRead, DraftRenameRequest
from app.services.document_storage import (
    DOCX_MIME_TYPE,
    get_document_storage_service,
    validate_employee_id,
)

router = APIRouter(prefix="/documents/drafts")

def _draft_to_read(draft) -> DraftRead:
    return DraftRead.model_validate(draft)

def build_blank_docx_bytes(title: str) -> bytes:
    import base64
    valid_docx_b64 = "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"
    return base64.b64decode(valid_docx_b64)


from sqlalchemy.orm import Session
from app.db.session import get_db
from app.crud.hr_drafts import (
    create_draft as crud_create_draft,
    get_employee_drafts,
    get_draft as crud_get_draft,
    update_draft as crud_update_draft,
    delete_draft as crud_delete_draft
)
from app.models.hr_draft import HRDraft
from datetime import datetime, timezone
import uuid

@router.post("/create", response_model=DraftRead)
def create_draft(
    payload: DraftCreateRequest,
    request: Request,
    current_user=Depends(require_roles("hr", "master")),
    storage=Depends(get_document_storage_service),
    db: Session = Depends(get_db),
):
    import logging
    employee_id = validate_employee_id(payload.employee_id)
    title = (payload.title or "Untitled Draft").strip() or "Untitled Draft"
    
    # NEW RECOVERY LOGIC: Never create a new blank draft when an existing draft is available
    if hasattr(storage, "list_employee_drafts"):
        existing_storage_drafts = storage.list_employee_drafts(employee_id)
        if existing_storage_drafts:
            # Find the first one that actually has a source file
            valid_existing = None
            for sd in existing_storage_drafts:
                if sd.title == title and hasattr(storage, "_get_draft_blob") and storage._get_draft_blob(employee_id, sd.draft_id):
                    valid_existing = sd
                    break
                    
            if valid_existing:
                existing = valid_existing
                logging.info(f"Reusing existing draft {existing.draft_id} for {employee_id} instead of creating a new one")
                # Ensure it is in DB
                db_draft = crud_get_draft(db, existing.draft_id)
                if not db_draft:
                    db_draft = HRDraft(
                        employee_id=existing.employee_id,
                        draft_id=existing.draft_id,
                        title=existing.title,
                        file_path=existing.file_path,
                        file_name=existing.file_name,
                        document_key=existing.document_key,
                        version=existing.version,
                        size=existing.size,
                        content_type=existing.content_type,
                        created_at=existing.created_at,
                        updated_at=existing.updated_at,
                    )
                    crud_create_draft(db, db_draft)
                return _draft_to_read(db_draft)

    logging.info(f"No existing draft found for {employee_id}, creating new draft '{title}'")
    draft_id = uuid.uuid4().hex
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    
    # Store content in GCS/Local
    content = build_blank_docx_bytes(title)
    if hasattr(storage, "_write_draft_content"):
        storage._write_draft_content(employee_id, draft_id, content)
    
    # Store metadata in DB
    draft = HRDraft(
        employee_id=employee_id,
        draft_id=draft_id,
        title=title,
        file_path=f".drafts/{draft_id}.docx",
        file_name=f"{title}.docx",
        document_key=f"{draft_id}_1",
        version=1,
        size=len(content),
        content_type=DOCX_MIME_TYPE,
        created_at=now,
        updated_at=now
    )
    crud_create_draft(db, draft)
    
    # Store metadata in GCS so it can be discovered by list_employee_drafts
    if hasattr(storage, "_write_draft_metadata"):
        from app.schemas.drafts import DraftItem
        draft_item = DraftItem(
            employee_id=draft.employee_id,
            draft_id=draft.draft_id,
            title=draft.title,
            file_path=draft.file_path,
            file_name=draft.file_name,
            document_key=draft.document_key,
            version=draft.version,
            size=draft.size,
            content_type=draft.content_type,
            created_at=draft.created_at,
            updated_at=draft.updated_at
        )
        storage._write_draft_metadata(employee_id, draft_item)
        
    return _draft_to_read(draft)


@router.get("/{employee_id}", response_model=DraftListRead)
def list_drafts(
    employee_id: str,
    current_user=Depends(require_roles("hr", "master")),
    storage=Depends(get_document_storage_service),
    db: Session = Depends(get_db),
):
    import logging
    employee_id = validate_employee_id(employee_id)
    
    # Sync orphaned drafts from GCS to database
    if hasattr(storage, "list_employee_drafts"):
        try:
            raw_storage_drafts = storage.list_employee_drafts(employee_id)
            
            # Filter out broken drafts (e.g. .json exists but .docx doesn't)
            storage_drafts = []
            for sd in raw_storage_drafts:
                if hasattr(storage, "_get_draft_blob") and not storage._get_draft_blob(employee_id, sd.draft_id):
                    logging.info(f"Skipping broken storage draft {sd.draft_id} (missing source file)")
                    continue
                storage_drafts.append(sd)
                
            logging.info(f"GCS files discovered: {len(storage_drafts)} valid drafts for {employee_id}")
            
            db_drafts = get_employee_drafts(db, employee_id)
            db_draft_ids = {d.draft_id for d in db_drafts}
            
            recovered_count = 0
            for sd in storage_drafts:
                if sd.draft_id not in db_draft_ids:
                    logging.info(f"Recovered draft mapping: {sd.draft_id} for {employee_id}")
                    new_draft = HRDraft(
                        employee_id=sd.employee_id,
                        draft_id=sd.draft_id,
                        title=sd.title,
                        file_path=sd.file_path,
                        file_name=sd.file_name,
                        document_key=sd.document_key,
                        version=sd.version,
                        size=sd.size,
                        content_type=sd.content_type,
                        created_at=sd.created_at,
                        updated_at=sd.updated_at,
                    )
                    crud_create_draft(db, new_draft)
                    recovered_count += 1
            if recovered_count > 0:
                logging.info(f"Rebuilt {recovered_count} database records automatically from GCS.")
                
            # Remove phantom drafts from DB if they don't exist in storage
            storage_draft_ids = {sd.draft_id for sd in storage_drafts}
            phantom_drafts = [d for d in db_drafts if d.draft_id not in storage_draft_ids]
            for pd in phantom_drafts:
                logging.info(f"Removing phantom draft mapping: {pd.draft_id} for {employee_id}")
                crud_delete_draft(db, pd)
                
        except Exception as e:
            logging.warning(f"Failed to sync storage drafts for {employee_id}: {e}")

    drafts = get_employee_drafts(db, employee_id)
    logging.info(f"Draft lookup result: returning {len(drafts)} drafts for {employee_id}")
    return DraftListRead(employee_id=employee_id, drafts=[_draft_to_read(draft) for draft in drafts])


@router.get("/{employee_id}/{draft_id}", response_model=DraftRead)
def get_draft(
    employee_id: str,
    draft_id: str,
    current_user=Depends(require_roles("hr", "master")),
    db: Session = Depends(get_db),
):
    employee_id = validate_employee_id(employee_id)
    draft = crud_get_draft(db, draft_id)
    if not draft or draft.employee_id != employee_id:
        raise HTTPException(status_code=404, detail="Draft not found")
    return _draft_to_read(draft)


@router.get("/{employee_id}/{draft_id}/source")
def draft_source(
    employee_id: str,
    draft_id: str,
    current_user=Depends(require_roles("hr", "master")),
    storage=Depends(get_document_storage_service),
):
    employee_id = validate_employee_id(employee_id)
    blob = storage.get_employee_draft_blob(employee_id, draft_id)
    if not blob:
        raise HTTPException(status_code=404, detail="Draft source file not found in storage")
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


@router.put("/{employee_id}/{draft_id}/content")
async def update_draft_content(
    employee_id: str,
    draft_id: str,
    request: Request,
    expected_version: int,
    current_user=Depends(require_roles("hr", "master")),
    storage=Depends(get_document_storage_service),
    db: Session = Depends(get_db),
):
    employee_id = validate_employee_id(employee_id)
    draft = crud_get_draft(db, draft_id)
    if not draft or draft.employee_id != employee_id:
        raise HTTPException(status_code=404, detail="Draft not found")

    if expected_version is not None and draft.version != expected_version:
        raise HTTPException(status_code=409, detail=f"Conflict: Expected version {expected_version}, but current version is {draft.version}")

    content = await request.body()
    if not content:
        raise HTTPException(status_code=400, detail="Empty body")
    
    # Store content in GCS/Local
    if hasattr(storage, "_write_draft_content"):
        storage._write_draft_content(employee_id, draft_id, content)

    # Store metadata in DB
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    draft.version += 1
    draft.document_key = f"{draft_id}_{draft.version}"
    draft.size = len(content)
    draft.updated_at = now
    crud_update_draft(db, draft)
    
    # Update metadata in GCS
    if hasattr(storage, "_write_draft_metadata"):
        from app.schemas.drafts import DraftItem
        draft_item = DraftItem(
            employee_id=draft.employee_id,
            draft_id=draft.draft_id,
            title=draft.title,
            file_path=draft.file_path,
            file_name=draft.file_name,
            document_key=draft.document_key,
            version=draft.version,
            size=draft.size,
            content_type=draft.content_type,
            created_at=draft.created_at,
            updated_at=draft.updated_at
        )
        storage._write_draft_metadata(employee_id, draft_item)
    
    return {"status": "success", "version": draft.version}


@router.delete("/{employee_id}/{draft_id}")
def remove_draft(
    employee_id: str,
    draft_id: str,
    current_user=Depends(require_roles("hr", "master")),
    storage=Depends(get_document_storage_service),
    db: Session = Depends(get_db),
):
    employee_id = validate_employee_id(employee_id)
    draft = crud_get_draft(db, draft_id)
    if not draft or draft.employee_id != employee_id:
        raise HTTPException(status_code=404, detail="Draft not found")
        
    crud_delete_draft(db, draft)
    
    # Delete content in GCS/Local
    if hasattr(storage, "_get_draft_blob"):
        blob = storage._get_draft_blob(employee_id, draft_id)
        if blob:
            blob.delete()

    return {"status": "deleted", "employee_id": employee_id, "draft_id": draft_id}


@router.put("/{employee_id}/{draft_id}/rename", response_model=DraftRead)
def rename_draft(
    employee_id: str,
    draft_id: str,
    payload: DraftRenameRequest,
    current_user=Depends(require_roles("hr", "master")),
    db: Session = Depends(get_db),
):
    employee_id = validate_employee_id(employee_id)
    draft = crud_get_draft(db, draft_id)
    if not draft or draft.employee_id != employee_id:
        raise HTTPException(status_code=404, detail="Draft not found")
        
    new_title = payload.title.strip()
    if not new_title:
        raise HTTPException(status_code=400, detail="Title cannot be empty")
        
    draft.title = new_title
    draft.file_name = f"{new_title}.docx"
    draft.updated_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    
    crud_update_draft(db, draft)
    return _draft_to_read(draft)