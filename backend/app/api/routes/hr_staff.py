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
from app.services.document_storage import list_employee_documents

router = APIRouter(prefix="/staff")


def _staff_read_with_photo_url(staff, request: Request) -> HRStaffRead:
    base_url = str(request.base_url).rstrip("/")
    r = HRStaffRead.model_validate(staff)
    r.display_id = f"NDMO/ESTT/{staff.id:03d}"
    if getattr(staff, "date_of_birth", None):
        from app.crud.hr_staff import compute_age
        r.age = compute_age(staff.date_of_birth)
    if getattr(staff, "date_of_joining", None):
        from datetime import date as _date
        doj = staff.date_of_joining
        today = _date.today()
        r.total_years_in_service = today.year - doj.year - ((today.month, today.day) < (doj.month, doj.day))
    if getattr(staff, "profile_photo_stored_filename", None):
        r.photo_url = f"{base_url}/api/hr/staff/{staff.id}/photo"
    return r

from app.utils.normalization import normalize_staff_name

@router.post("", response_model=HRStaffRead)
def create(payload: HRStaffCreate, request: Request, db: Session = Depends(get_db)):
    if payload.full_name:
        payload.full_name = normalize_staff_name(payload.full_name)
    staff = create_staff(db, payload)
    return _staff_read_with_photo_url(staff, request)


@router.get("", response_model=list[HRStaffRead])
def list_(
    request: Request,
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = Query(default=1000, le=5000),
    q: Optional[str] = None,
    designation: Optional[str] = None,
):
    items = list_staff(
        db,
        skip=skip,
        limit=limit,
        q=q,
        designation=designation,
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
    designation: Optional[str] = None,
):
    rows = export_staff_rows(
        db,
        q=q,
        designation=designation,
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
            "display_id",
            "full_name",
            "fathers_name",
            "mothers_name",
            "gender",
            "date_of_birth",
            "age",
            "designation",
            "mode_of_service",
            "head",
            "present_posting_place",
            "appointment_order_no",
            "date_of_joining",
            "total_years_in_service",
            "date_of_retirement",
            "first_macp",
            "second_macp",
            "third_macp",
            "present_basic_pay",
            "permanent_address",
            "present_address",
            "phone",
            "email",
            "aadhaar_number",
            "pan_number",
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
        ("display_id", "Staff ID", 15),
        ("full_name", "Name", 24),
        ("fathers_name", "Father's Name", 24),
        ("mothers_name", "Mother's Name", 24),
        ("gender", "Sex", 10),
        ("date_of_birth", "Date of Birth", 12),
        ("age", "Age", 6),
        ("designation", "Designation", 22),
        ("mode_of_service", "Mode of Service", 18),
        ("head", "Head", 18),
        ("present_posting_place", "Present Posting Place", 24),
        ("appointment_order_no", "Appointment Order No & Dated", 30),
        ("date_of_joining", "Date of Joining", 14),
        ("total_years_in_service", "Total Year in Service", 14),
        ("date_of_retirement", "Date of Retirement", 14),
        ("first_macp", "Date of 1st MACP", 14),
        ("second_macp", "Date of 2nd MACP", 14),
        ("third_macp", "Date of 3rd MACP", 14),
        ("present_basic_pay", "Present Basic Pay/Salary", 18),
        ("permanent_address", "Permanent Address", 30),
        ("present_address", "Present Address", 30),
        ("phone", "Contact Number", 14),
        ("email", "Email ID", 30),
        ("aadhaar_number", "Aadhaar Card Number", 18),
        ("pan_number", "PAN Card Number", 16),
        ("remarks", "Remarks", 34),
        ("profile_photo_stored_filename", "Profile Picture", 20),
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
                if key == "profile_photo_stored_filename":
                    if v:
                        img_path = Path(settings.uploads_dir) / v
                        if img_path.exists():
                            # Enlarge row to fit a tiny thumbnail
                            ws.set_row(row_idx, 60)
                            # Provide borders/cell styling if needed, but insert_image overrides cell text.
                            ws.write(row_idx, col_idx, "", cell_fmt)
                            try:
                                # Use positioning=1 (move and size with cells) and x/y scale to shrink the image.
                                ws.insert_image(row_idx, col_idx, str(img_path), {
                                    "x_scale": 0.15,
                                    "y_scale": 0.15,
                                    "positioning": 1
                                })
                            except Exception:
                                ws.write(row_idx, col_idx, "Error", cell_fmt)
                        else:
                            ws.write(row_idx, col_idx, "Not Found", cell_fmt)
                    else:
                        ws.write(row_idx, col_idx, "", cell_fmt)
                elif key in ("remarks", "present_address", "permanent_address"):
                    ws.write(row_idx, col_idx, v or "", wrap_fmt)
                elif key in ("date_of_birth", "date_of_joining", "first_macp", "second_macp", "third_macp", "date_of_retirement"):
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

    # Group by Present Posting Place into separate worksheets (case-insensitive)
    by_facility: dict[str, list[dict]] = {}
    for r in rows:
        raw = (r.get("present_posting_place") or "").strip()
        key = raw.title() if raw else "(blank)"
        if key.lower().startswith("dmo office"):
            key = "Dmo Office"
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
    if payload.full_name is not None and payload.full_name != "":
        payload.full_name = normalize_staff_name(payload.full_name)
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
