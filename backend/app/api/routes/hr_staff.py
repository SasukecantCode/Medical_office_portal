from __future__ import annotations

import csv
import io
import os
from pathlib import Path
from typing import Optional

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    Request,
    Response,
    UploadFile,
)
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

import xlsxwriter
from xlsxwriter.utility import get_image_properties

from app.crud.hr_staff import (
    create_staff,
    create_attachment,
    delete_staff,
    distinct_values,
    export_staff_rows,
    get_attachment,
    get_staff,
    list_attachments,
    list_attachments_for_staff_ids,
    list_staff,
    update_staff,
)
from app.core.config import settings
from app.crud import hr_field_defs as crud_defs
from app.db.session import get_db
from app.schemas.hr_staff_attachment import HRStaffAttachmentRead
from app.schemas.hr_staff import HRStaffCreate, HRStaffRead, HRStaffUpdate

router = APIRouter(prefix="/staff")


def _staff_read_with_photo_url(staff, request: Request) -> HRStaffRead:
    base_url = str(request.base_url).rstrip("/")
    r = HRStaffRead.model_validate(staff)
    if getattr(staff, "profile_photo_stored_filename", None):
        r.photo_url = f"{base_url}/api/hr/staff/{staff.id}/photo"
    return r


@router.post("", response_model=HRStaffRead)
def create(payload: HRStaffCreate, request: Request, db: Session = Depends(get_db)):
    staff = create_staff(db, payload)
    return _staff_read_with_photo_url(staff, request)


@router.get("", response_model=list[HRStaffRead])
def list_(
    request: Request,
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = Query(default=50, le=500),
    q: Optional[str] = None,
    district: Optional[str] = None,
    designation: Optional[str] = None,
    facility_name: Optional[str] = None,
    employment_type: Optional[str] = None,
):
    items = list_staff(
        db,
        skip=skip,
        limit=limit,
        q=q,
        district=district,
        designation=designation,
        facility_name=facility_name,
        employment_type=employment_type,
    )
    return [_staff_read_with_photo_url(s, request) for s in items]


@router.get("/suggestions")
def suggestions(
    field: str = Query(...),
    q: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Return distinct existing values for a field, for autocomplete suggestions."""
    values = distinct_values(db, field, q=q)
    return {"field": field, "values": values}


@router.get("/export")
def export(
    request: Request,
    db: Session = Depends(get_db),
    format: str = Query(default="xlsx", pattern="^(csv|xlsx)$"),
    q: Optional[str] = None,
    district: Optional[str] = None,
    designation: Optional[str] = None,
    facility_name: Optional[str] = None,
    employment_type: Optional[str] = None,
):
    rows = export_staff_rows(
        db,
        q=q,
        district=district,
        designation=designation,
        facility_name=facility_name,
        employment_type=employment_type,
    )

    # Fetch custom field definitions to expand extra into separate columns
    custom_field_defs = crud_defs.list_field_defs(db)

    # Unpack extra JSON into individual columns per custom field def
    def _expand_extra(row: dict) -> dict:
        import json as _json
        extra_raw = row.get("extra", "")
        if isinstance(extra_raw, str):
            try:
                extra_dict = _json.loads(extra_raw) if extra_raw else {}
            except Exception:
                extra_dict = {}
        elif isinstance(extra_raw, dict):
            extra_dict = extra_raw
        else:
            extra_dict = {}
        for fd in custom_field_defs:
            row[fd.name] = extra_dict.get(fd.name, "")
        return row

    rows = [_expand_extra(r) for r in rows]

    if format == "csv":
        fieldnames = [
            "id",
            "full_name",
            "gender",
            "date_of_birth",
            "designation",
            "cadre",
            "employment_type",
            "phone",
            "email",
            "facility_name",
            "facility_type",
            "district",
            "block",
            "posting_place",
            "date_of_joining",
            "remarks",
        ]
        # Append custom field names as individual columns
        for fd in custom_field_defs:
            fieldnames.append(fd.name)
        fieldnames += ["created_at", "updated_at"]

        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)

        content = output.getvalue()
        headers = {"Content-Disposition": 'attachment; filename="hr_staff.csv"'}
        return Response(content=content, media_type="text/csv", headers=headers)

    # XLSX export (formatted) with embedded profile photos
    base_url = str(request.base_url).rstrip("/")

    # Columns/order as requested (formatted report)
    columns = [
        ("id", "ID", 6),
        ("full_name", "Full Name", 24),
        ("gender", "Gender", 10),
        ("date_of_birth", "DOB", 12),
        ("designation", "Designation", 22),
        ("cadre", "Cadre", 14),
        ("employment_type", "Employment Type", 18),
        ("phone", "Phone", 14),
        ("email", "Email", 36),
        ("facility_name", "Facility Name", 20),
        ("facility_type", "Facility Type", 18),
        ("district", "District", 14),
        ("block", "Block", 16),
        ("posting_place", "Posting Place", 18),
        ("date_of_joining", "Date of Joining", 14),
        ("remarks", "Remarks", 34),
    ]
    # Append custom field defs as dynamic columns (before timestamps)
    for fd in custom_field_defs:
        columns.append((fd.name, fd.label, 20))
    columns += [
        ("created_at", "Created", 20),
        ("updated_at", "Updated", 20),
    ]

    out = io.BytesIO()
    workbook = xlsxwriter.Workbook(out, {"in_memory": True})
    # Formats
    title_fmt = workbook.add_format(
        {
            "bold": True,
            "font_size": 14,
            "align": "center",
            "valign": "vcenter",
        }
    )
    subtitle_fmt = workbook.add_format({"font_size": 10, "color": "#666666"})
    header_fmt = workbook.add_format(
        {
            "bold": True,
            "text_wrap": True,
            "valign": "vcenter",
            "align": "center",
            "bg_color": "#F2F2F2",
            "border": 1,
        }
    )
    cell_fmt = workbook.add_format({"border": 1, "valign": "top"})
    wrap_fmt = workbook.add_format({"border": 1, "valign": "top", "text_wrap": True})
    date_fmt = workbook.add_format({"border": 1, "num_format": "yyyy-mm-dd", "valign": "top"})
    dt_fmt = workbook.add_format({"border": 1, "num_format": "yyyy-mm-dd hh:mm:ss", "valign": "top"})
    link_fmt = workbook.add_format({"font_color": "blue", "underline": 1, "border": 1, "valign": "top"})

    def _safe_sheet_name(name: str) -> str:
        raw = (name or "(blank)").strip() or "(blank)"
        for ch in ["[", "]", ":", "*", "?", "/", "\\"]:
            raw = raw.replace(ch, " ")
        raw = " ".join(raw.split())
        return raw[:31] if len(raw) > 31 else raw

    def _parse_date(value: str):
        if not value:
            return None
        try:
            from datetime import date

            return date.fromisoformat(value)
        except Exception:
            return None

    def _parse_dt(value: str):
        if not value:
            return None
        try:
            from datetime import datetime

            dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
            if dt.tzinfo is not None:
                dt = dt.replace(tzinfo=None)
            return dt
        except Exception:
            return None

    def _write_sheet(ws, title: str, sheet_rows: list[dict]):
        # Title row
        ws.merge_range(0, 0, 0, len(columns) - 1, title, title_fmt)
        ws.write(1, 0, "Generated by Data Portal", subtitle_fmt)

        header_row = 3
        for col_idx, (_, header, width) in enumerate(columns):
            ws.write(header_row, col_idx, header, header_fmt)
            ws.set_column(col_idx, col_idx, width)

        ws.freeze_panes(header_row + 1, 0)
        ws.autofilter(header_row, 0, header_row, len(columns) - 1)
        ws.set_row(0, 22)
        ws.set_row(header_row, 28)

        for i, r in enumerate(sheet_rows):
            row_idx = header_row + 1 + i
            for col_idx, (key, _header, _width) in enumerate(columns):
                v = r.get(key, "")
                if key in ("remarks",):
                    ws.write(row_idx, col_idx, v or "", wrap_fmt)
                elif key in ("date_of_birth", "date_of_joining"):
                    d = _parse_date(v)
                    if d is not None:
                        ws.write_datetime(row_idx, col_idx, d, date_fmt)
                    else:
                        ws.write(row_idx, col_idx, v or "", cell_fmt)
                elif key in ("created_at", "updated_at"):
                    dt = _parse_dt(v)
                    if dt is not None:
                        ws.write_datetime(row_idx, col_idx, dt, dt_fmt)
                    else:
                        ws.write(row_idx, col_idx, v or "", cell_fmt)
                elif key == "email" and v:
                    ws.write_url(row_idx, col_idx, f"mailto:{v}", link_fmt, v)
                else:
                    ws.write(row_idx, col_idx, v if v is not None else "", cell_fmt)

        # Print-friendly defaults
        ws.set_landscape()
        ws.fit_to_pages(1, 0)

    # Group by Facility Name into separate worksheets (case-insensitive)
    by_facility: dict[str, list[dict]] = {}
    for r in rows:
        raw = (r.get("facility_name") or "").strip()
        key = raw.title() if raw else "(blank)"
        by_facility.setdefault(key, []).append(r)

    # All Staff sheet first
    ws_all = workbook.add_worksheet("All Staff")
    _write_sheet(ws_all, "HR Staff — All Facilities", rows)

    used_names: set[str] = {"All Staff"}
    used_names_lower: set[str] = {"all staff"}
    for facility in sorted(by_facility.keys(), key=lambda x: (x or "")):
        sheet_name = _safe_sheet_name(facility)
        base_name = sheet_name
        n = 2
        while sheet_name in used_names or sheet_name.lower() in used_names_lower:
            suffix = f" {n}"
            sheet_name = (base_name[: max(0, 31 - len(suffix))] + suffix).strip()
            n += 1
        used_names.add(sheet_name)
        used_names_lower.add(sheet_name.lower())

        ws_fac = workbook.add_worksheet(sheet_name)
        _write_sheet(ws_fac, f"HR Staff — {facility}", by_facility[facility])

    # Optional: Attachments sheet (direct download links)
    staff_ids = [int(r["id"]) for r in rows]
    atts = list_attachments_for_staff_ids(db, staff_ids) if staff_ids else []
    if atts:
        ws2 = workbook.add_worksheet("Attachments")
        att_headers = ["Staff ID", "Attachment ID", "File Name", "Content Type", "Created", "Download"]
        ws2.merge_range(0, 0, 0, len(att_headers) - 1, "HR Staff — Attachments", title_fmt)
        ws2.write(1, 0, "Generated by Data Portal", subtitle_fmt)

        header_row = 3
        for col, h in enumerate(att_headers):
            ws2.write(header_row, col, h, header_fmt)
        ws2.freeze_panes(header_row + 1, 0)
        ws2.autofilter(header_row, 0, header_row, len(att_headers) - 1)

        ws2.set_column(0, 1, 12)
        ws2.set_column(2, 2, 42)
        ws2.set_column(3, 3, 18)
        ws2.set_column(4, 4, 20)
        ws2.set_column(5, 5, 16)

        for row_idx, a in enumerate(sorted(atts, key=lambda x: (x.staff_id, x.id)), start=header_row + 1):
            download_url = f"{base_url}/api/hr/staff/{a.staff_id}/attachments/{a.id}"
            ws2.write(row_idx, 0, a.staff_id, cell_fmt)
            ws2.write(row_idx, 1, a.id, cell_fmt)
            ws2.write(row_idx, 2, a.original_filename, cell_fmt)
            ws2.write(row_idx, 3, a.content_type or "", cell_fmt)
            ws2.write(row_idx, 4, str(a.created_at), cell_fmt)
            ws2.write_url(row_idx, 5, download_url, link_fmt, "Download")

    workbook.close()
    content = out.getvalue()
    headers = {"Content-Disposition": 'attachment; filename="hr_staff.xlsx"'}
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers,
    )


@router.post("/{staff_id}/attachments", response_model=HRStaffAttachmentRead)
def upload_attachment(
    staff_id: int,
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    staff = get_staff(db, staff_id)
    if staff is None:
        raise HTTPException(status_code=404, detail="Staff record not found")

    att = create_attachment(
        db,
        staff_id=staff_id,
        original_filename=file.filename or "attachment",
        content_type=file.content_type,
    )

    uploads_root = Path(settings.uploads_dir)
    uploads_root.mkdir(parents=True, exist_ok=True)
    stored_path = uploads_root / att.stored_filename

    with stored_path.open("wb") as f:
        while True:
            chunk = file.file.read(1024 * 1024)
            if not chunk:
                break
            f.write(chunk)

    base_url = str(request.base_url).rstrip("/")
    att_read = HRStaffAttachmentRead.model_validate(att)
    att_read.url = f"{base_url}/api/hr/staff/{staff_id}/attachments/{att.id}"
    return att_read


@router.get("/{staff_id}/attachments", response_model=list[HRStaffAttachmentRead])
def list_staff_attachments(staff_id: int, request: Request, db: Session = Depends(get_db)):
    staff = get_staff(db, staff_id)
    if staff is None:
        raise HTTPException(status_code=404, detail="Staff record not found")

    base_url = str(request.base_url).rstrip("/")
    items = list_attachments(db, staff_id)
    out: list[HRStaffAttachmentRead] = []
    for a in items:
        r = HRStaffAttachmentRead.model_validate(a)
        r.url = f"{base_url}/api/hr/staff/{staff_id}/attachments/{a.id}"
        out.append(r)
    return out


@router.get("/{staff_id}/attachments/{attachment_id}")
def download_attachment(staff_id: int, attachment_id: int, db: Session = Depends(get_db)):
    att = get_attachment(db, staff_id, attachment_id)
    if att is None:
        raise HTTPException(status_code=404, detail="Attachment not found")

    stored_path = Path(settings.uploads_dir) / att.stored_filename
    if not stored_path.exists():
        raise HTTPException(status_code=404, detail="Attachment file missing on server")

    return FileResponse(
        path=str(stored_path),
        media_type=att.content_type or "application/octet-stream",
        filename=att.original_filename,
    )


@router.post("/{staff_id}/photo", response_model=HRStaffRead)
def upload_profile_photo(
    staff_id: int,
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Upload/replace the single required profile photo (JPEG) for a staff record."""
    staff = get_staff(db, staff_id)
    if staff is None:
        raise HTTPException(status_code=404, detail="Staff record not found")

    filename = (file.filename or "photo.jpg").lower()
    content_type = file.content_type or ""
    if content_type != "image/jpeg" and not (filename.endswith(".jpg") or filename.endswith(".jpeg")):
        raise HTTPException(status_code=400, detail="Profile photo must be a JPEG (.jpg/.jpeg)")

    raw = file.file.read()
    # Lightweight JPEG validation (SOI marker). Keeps MVP dependency-free.
    if len(raw) < 4 or not raw.startswith(b"\xff\xd8"):
        raise HTTPException(status_code=400, detail="Invalid JPEG file")

    try:
        kind, width, height, *_ = get_image_properties(file.filename or "photo.jpg", io.BytesIO(raw))
        if kind != "jpeg" or width <= 0 or height <= 0:
            raise ValueError("not a jpeg")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JPEG file")

    uploads_root = Path(settings.uploads_dir)
    uploads_root.mkdir(parents=True, exist_ok=True)

    # Remove old photo file if present
    old = getattr(staff, "profile_photo_stored_filename", None)
    if old:
        old_path = uploads_root / old
        try:
            if old_path.exists():
                old_path.unlink()
        except Exception:
            pass

    stored_filename = f"photo_{staff_id}_{os.urandom(8).hex()}.jpg"
    stored_path = uploads_root / stored_filename
    with stored_path.open("wb") as f:
        f.write(raw)

    from datetime import datetime

    staff.profile_photo_original_filename = file.filename or "photo.jpg"
    staff.profile_photo_stored_filename = stored_filename
    staff.profile_photo_content_type = "image/jpeg"
    staff.profile_photo_uploaded_at = datetime.utcnow()

    db.add(staff)
    db.commit()
    db.refresh(staff)

    return _staff_read_with_photo_url(staff, request)


@router.get("/{staff_id}/photo")
def download_profile_photo(staff_id: int, db: Session = Depends(get_db)):
    staff = get_staff(db, staff_id)
    if staff is None:
        raise HTTPException(status_code=404, detail="Staff record not found")

    stored = getattr(staff, "profile_photo_stored_filename", None)
    if not stored:
        raise HTTPException(status_code=404, detail="Profile photo not set")

    stored_path = Path(settings.uploads_dir) / stored
    if not stored_path.exists():
        raise HTTPException(status_code=404, detail="Profile photo file missing on server")

    return FileResponse(
        path=str(stored_path),
        media_type="image/jpeg",
        filename=staff.profile_photo_original_filename or "photo.jpg",
    )


@router.get("/{staff_id}", response_model=HRStaffRead)
def get_one(staff_id: int, request: Request, db: Session = Depends(get_db)):
    staff = get_staff(db, staff_id)
    if staff is None:
        raise HTTPException(status_code=404, detail="Staff record not found")
    return _staff_read_with_photo_url(staff, request)


@router.patch("/{staff_id}", response_model=HRStaffRead)
def patch(staff_id: int, payload: HRStaffUpdate, request: Request, db: Session = Depends(get_db)):
    staff = update_staff(db, staff_id, payload)
    if staff is None:
        raise HTTPException(status_code=404, detail="Staff record not found")
    return _staff_read_with_photo_url(staff, request)


@router.delete("/{staff_id}")
def delete(staff_id: int, db: Session = Depends(get_db)):
    ok = delete_staff(db, staff_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Staff record not found")
    return {"status": "deleted"}
