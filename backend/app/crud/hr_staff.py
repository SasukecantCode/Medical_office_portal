from __future__ import annotations

import json
import os
import re
import uuid
from datetime import date, datetime
from typing import Optional

from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.orm import Session

from app.models.hr_staff import HRStaff
from app.models.hr_staff_attachment import HRStaffAttachment
from app.schemas.hr_staff import HRStaffCreate, HRStaffUpdate


def _normalize_text_field(value: str, field_name: str = "") -> str:
    """Title-case and strip whitespace for consistent storage, preserving abbreviations."""
    val = " ".join(value.strip().split()).title()
    abbrevs = [
        "Dmo", "Drcho", "Dpo", "Cmo", "Chc", "Phc", "Hwc", "Dh", 
        "Anm", "Gnm", "Ndmo", "Estt", "Macp", "Hr", "Id", "Deo", 
        "Lhv", "Bpm", "Bcm", "Bam", "Dto", "Cpo", "Ldc", "Smi", 
        "Sml", "Mi", "Si", "Dhv", "Ha", "Cea", "Idsp", "Nvbdcp", 
        "Ncd", "Nhm", "Ntep", "Nlep", "Ost", "Atf", "Rbsk", "Fi-Art", 
        "Cmaay", "Dvbd", "Ictc", "Pmjas", "Npcdcs", "Epi", "Mmrkk", 
        "Ecg", "Bcg", "Ent", "Mo", "Smo", "Gdmo", "No", "Sno", "Bdm", 
        "Dcm", "Ddm", "Dam", "Dpm", "Dm", "Dpc", "Pmw", "Po", "Sts", 
        "Mt", "Lt", "Mts", "Msi", "Sfw", "Rfw", "Hwo", "Ob&G", 
        "Ahc", "Bcc", "Bds", "Mpw", "Hcw", "Tb", "Sg", "Ds", "Arc", "Ri"
    ]
    if field_name in ("designation", "present_posting_place", "head", "facility_name"):
        abbrevs.extend(["Ca", "Da", "Fa", "Na", "Rm", "Oa", "Sc", "Ms", "Sa", "Sb", "Nc", "Vc"])

    for abbr in abbrevs:
        val = re.sub(rf'\b{abbr}\b', abbr.upper(), val)
    return val

# Fields that should be auto-normalized to Title Case on create/update
_TITLE_CASE_FIELDS = [
    "full_name",
    "fathers_name",
    "mothers_name",
    "designation",
    "present_posting_place",
    "head",
]

def _apply_case_normalization(data: dict) -> dict:
    for field in _TITLE_CASE_FIELDS:
        if field in data and data[field] and isinstance(data[field], str):
            data[field] = _normalize_text_field(data[field], field)
    return data


def _compute_macp_dates(data: dict) -> dict:
    """Auto-calculate MACP dates from date_of_joining if not explicitly provided."""
    doj = data.get("date_of_joining")
    if doj and isinstance(doj, date):
        if not data.get("first_macp"):
            try:
                data["first_macp"] = doj.replace(year=doj.year + 10)
            except ValueError:
                data["first_macp"] = doj.replace(year=doj.year + 10, day=28)

        first = data.get("first_macp")
        if first and not data.get("second_macp"):
            try:
                data["second_macp"] = first.replace(year=first.year + 10)
            except ValueError:
                data["second_macp"] = first.replace(year=first.year + 10, day=28)

        second = data.get("second_macp")
        if second and not data.get("third_macp"):
            try:
                data["third_macp"] = second.replace(year=second.year + 10)
            except ValueError:
                data["third_macp"] = second.replace(year=second.year + 10, day=28)
    return data


def _compute_retirement_date(data: dict) -> dict:
    """Auto-calculate retirement date if missing (defaults to DOB + 60)."""
    dob = data.get("date_of_birth")
    if dob and isinstance(dob, date):
        if not data.get("date_of_retirement"):
            try:
                data["date_of_retirement"] = dob.replace(year=dob.year + 60)
            except ValueError:
                data["date_of_retirement"] = dob.replace(year=dob.year + 60, day=28)
    return data


def compute_age(dob: date | None) -> int | None:
    """Calculate age from date of birth."""
    if not dob:
        return None
    today = date.today()
    age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    return age


def create_staff(db: Session, payload: HRStaffCreate) -> HRStaff:
    data = payload.model_dump()
    _apply_case_normalization(data)
    _compute_macp_dates(data)
    _compute_retirement_date(data)
    staff = HRStaff(**data)
    db.add(staff)
    db.commit()
    db.refresh(staff)
    return staff


def get_staff(db: Session, staff_id: int) -> HRStaff | None:
    stmt = select(HRStaff).where(and_(HRStaff.id == staff_id, HRStaff.deleted_at.is_(None)))
    return db.execute(stmt).scalars().first()


def _filters(
    q: Optional[str],
    designation: Optional[str],
):
    filters = [HRStaff.deleted_at.is_(None)]

    if q:
        like = f"%{q.strip()}%"
        filters.append(
            or_(
                HRStaff.full_name.ilike(like),
                HRStaff.phone.ilike(like),
                HRStaff.email.ilike(like),
                HRStaff.designation.ilike(like),
                HRStaff.present_posting_place.ilike(like),
                HRStaff.fathers_name.ilike(like),
            )
        )

    if designation:
        filters.append(HRStaff.designation == designation)

    return filters


def list_staff(
    db: Session,
    *,
    skip: int = 0,
    limit: int = 50,
    q: Optional[str] = None,
    district: Optional[str] = None,
    designation: Optional[str] = None,
    facility_name: Optional[str] = None,
    employment_type: Optional[str] = None,
) -> list[HRStaff]:
    stmt = (
        select(HRStaff)
        .where(and_(*_filters(q, designation)))
        .order_by(HRStaff.id.asc())
        .offset(skip)
        .limit(limit)
    )
    return list(db.execute(stmt).scalars().all())


def update_staff(db: Session, staff_id: int, payload: HRStaffUpdate) -> HRStaff | None:
    staff = get_staff(db, staff_id)
    if staff is None:
        return None

    old_name = staff.full_name

    data = payload.model_dump(exclude_unset=True)
    _apply_case_normalization(data)
    
    # Recalculate MACP if DOJ changed
    if "date_of_joining" in data:
        _compute_macp_dates(data)
    
    # Recalculate retirement date if DOB changed
    if "date_of_birth" in data:
        merged = {
            "date_of_birth": data.get("date_of_birth", staff.date_of_birth),
            "date_of_retirement": data.get("date_of_retirement"),
        }
        _compute_retirement_date(merged)
        if "date_of_retirement" not in data:
            data["date_of_retirement"] = merged.get("date_of_retirement")

    for key, value in data.items():
        setattr(staff, key, value)

    new_name = staff.full_name

    if old_name != new_name:
        import re
        def _safe_name(n: str) -> str:
            n = (n or 'Unknown').strip()
            n = re.sub(r'[^a-zA-Z0-9_\-\s]', '', n)
            return re.sub(r'\s+', '_', n)

        old_emp_id = f"{_safe_name(old_name)}_EMP{staff_id:03d}"
        new_emp_id = f"{_safe_name(new_name)}_EMP{staff_id:03d}"
        
        from app.services.document_storage import get_document_storage_service
        try:
            storage = get_document_storage_service()
            if hasattr(storage, "rename_employee_folder"):
                storage.rename_employee_folder(old_emp_id, new_emp_id)
        except Exception as e:
            import logging
            logging.error(f"Failed to rename document folder on name change: {e}")

    db.add(staff)
    db.commit()
    db.refresh(staff)
    return staff


_SUGGESTION_FIELDS = {
    "designation": HRStaff.designation,
    "present_posting_place": HRStaff.present_posting_place,
}

def distinct_values(db: Session, field: str, q: Optional[str] = None, limit: int = 30) -> list[str]:
    """Return distinct non-null values for a given field, optionally filtered by prefix/substring."""
    col = _SUGGESTION_FIELDS.get(field)
    if col is None:
        return []
    stmt = (
        select(col)
        .where(HRStaff.deleted_at.is_(None), col.isnot(None), col != "")
        .group_by(col)
        .order_by(func.count().desc())
        .limit(limit)
    )
    if q:
        stmt = stmt.where(col.ilike(f"%{q.strip()}%"))
    rows = db.execute(stmt).scalars().all()
    return [str(r) for r in rows if r]


def delete_staff(db: Session, staff_id: int) -> bool:
    staff = get_staff(db, staff_id)
    if staff is None:
        return False

    staff.deleted_at = datetime.utcnow()
    db.add(staff)
    db.commit()

    # Clear attachments from cloud
    try:
        from app.services.document_storage import get_document_storage_service
        storage = get_document_storage_service()
        employee_id = f"{staff.full_name}_EMP{staff.id:03d}"
        storage.delete_employee_folder(employee_id)
    except Exception as e:
        import logging
        logging.warning(f"Failed to delete document folder for staff {staff.id}: {e}")

    return True


def delete_all_staff(db: Session) -> int:
    # Get all non-deleted staff before updating
    staff_to_delete = db.execute(select(HRStaff).where(HRStaff.deleted_at.is_(None))).scalars().all()
    
    stmt = (
        update(HRStaff)
        .where(HRStaff.deleted_at.is_(None))
        .values(deleted_at=datetime.utcnow())
    )
    result = db.execute(stmt)
    db.commit()
    
    # Clear all attachments from cloud
    try:
        from app.services.document_storage import get_document_storage_service
        storage = get_document_storage_service()
        for staff in staff_to_delete:
            employee_id = f"{staff.full_name}_EMP{staff.id:03d}"
            storage.delete_employee_folder(employee_id)
    except Exception as e:
        import logging
        logging.warning(f"Failed to delete document folders during bulk delete: {e}")
        
    return result.rowcount


def export_staff_rows(
    db: Session,
    *,
    q: Optional[str] = None,
    district: Optional[str] = None,
    designation: Optional[str] = None,
    facility_name: Optional[str] = None,
    employment_type: Optional[str] = None,
) -> list[dict]:
    stmt = (
        select(HRStaff)
        .where(and_(*_filters(q, designation)))
        .order_by(HRStaff.created_at.desc())
    )
    results = list(db.execute(stmt).scalars().all())

    def _total_years(doj):
        if not doj:
            return ""
        today = date.today()
        return today.year - doj.year - ((today.month, today.day) < (doj.month, doj.day))

    def to_row(s: HRStaff) -> dict:
        return {
            "id": s.id,
            "display_id": f"NDMO/ESTT/{s.id:03d}",
            "full_name": s.full_name,
            "fathers_name": s.fathers_name or "",
            "mothers_name": s.mothers_name or "",
            "gender": s.gender,
            "date_of_birth": s.date_of_birth.isoformat() if s.date_of_birth else "",
            "age": compute_age(s.date_of_birth) if s.date_of_birth else "",
            "designation": s.designation,
            "mode_of_service": s.mode_of_service or "",
            "head": s.head or "",
            "present_posting_place": s.present_posting_place or "",
            "appointment_order_no": s.appointment_order_no or "",
            "date_of_joining": s.date_of_joining.isoformat() if s.date_of_joining else "",
            "total_years_in_service": _total_years(s.date_of_joining),
            "first_macp": s.first_macp.isoformat() if s.first_macp else "",
            "second_macp": s.second_macp.isoformat() if s.second_macp else "",
            "third_macp": s.third_macp.isoformat() if s.third_macp else "",
            "date_of_retirement": s.date_of_retirement.isoformat() if s.date_of_retirement else "",
            "present_basic_pay": s.present_basic_pay or "",
            "present_address": s.present_address or "",
            "permanent_address": s.permanent_address or "",
            "phone": s.phone or "",
            "email": s.email or "",
            "aadhaar_number": s.aadhaar_number or "",
            "pan_number": s.pan_number or "",
            "remarks": s.remarks or "",
            "profile_photo_stored_filename": s.profile_photo_stored_filename or "",
            "extra": json.dumps(s.extra or {}, ensure_ascii=False),
            "created_at": s.created_at.isoformat() if s.created_at else "",
            "updated_at": s.updated_at.isoformat() if s.updated_at else "",
        }

    return [to_row(s) for s in results]


def dashboard_summary(db: Session) -> dict:
    base_where = HRStaff.deleted_at.is_(None)

    total_staff = db.execute(select(func.count()).select_from(HRStaff).where(base_where)).scalar_one()

    def grouped(field):
        stmt = (
            select(field.label("key"), func.count().label("count"))
            .select_from(HRStaff)
            .where(base_where)
            .group_by(field)
            .order_by(func.count().desc())
        )
        rows = db.execute(stmt).all()
        return [{"key": r.key or "(blank)", "count": r.count} for r in rows]

    def grouped_case_insensitive(field):
        key_lower = func.lower(func.trim(field))
        stmt = (
            select(key_lower.label("key_lower"), func.count().label("count"))
            .select_from(HRStaff)
            .where(base_where)
            .group_by(key_lower)
            .order_by(func.count().desc())
        )
        rows = db.execute(stmt).all()
        out = []
        for r in rows:
            raw = r.key_lower
            if not raw:
                label = "(blank)"
            else:
                label = raw.title()
                abbrevs = [
                    "Dmo", "Drcho", "Dpo", "Cmo", "Chc", "Phc", "Hwc", "Dh", 
                    "Anm", "Gnm", "Ndmo", "Estt", "Macp", "Hr", "Id", "Deo", 
                    "Lhv", "Bpm", "Bcm", "Bam", "Dto", "Cpo", "Ldc", "Smi", 
                    "Sml", "Mi", "Si", "Dhv", "Ha", "Cea", "Idsp", "Nvbdcp", 
                    "Ncd", "Nhm", "Ntep", "Nlep", "Ost", "Atf", "Rbsk", "Fi-Art", 
                    "Cmaay", "Dvbd", "Ictc", "Pmjas", "Npcdcs", "Epi", "Mmrkk", 
                    "Ecg", "Bcg", "Ent", "Mo", "Smo", "Gdmo", "No", "Sno", "Bdm", 
                    "Dcm", "Ddm", "Dam", "Dpm", "Dm", "Dpc", "Pmw", "Po", "Sts", 
                    "Mt", "Lt", "Mts", "Msi", "Sfw", "Rfw", "Hwo", "Ob&G",
                    "Ahc", "Bcc", "Bds", "Mpw", "Hcw", "Tb", "Sg", "Ds", "Arc", "Ri",
                    "Ca", "Da", "Fa", "Na", "Rm", "Oa", "Sc", "Ms", "Sa", "Sb", "Nc", "Vc"
                ]
                for abbr in abbrevs:
                    label = re.sub(rf'\b{abbr}\b', abbr.upper(), label)
            out.append({"key": label, "count": r.count})
        return out

    # Monthly trend using date_of_joining
    dates = db.execute(select(HRStaff.date_of_joining).where(base_where)).scalars().all()
    by_month = {}
    for d in dates:
        if d:
            month_key = d.strftime("%Y-%m")
            by_month[month_key] = by_month.get(month_key, 0) + 1
    
    monthly_trend = [{"key": k, "count": v} for k, v in sorted(by_month.items())]

    return {
        "totals": {"staff": total_staff},
        "by_designation": grouped(HRStaff.designation),
        "by_head": grouped_case_insensitive(HRStaff.head),
        "by_facility": grouped_case_insensitive(HRStaff.present_posting_place),
        "by_month": monthly_trend,
    }


def list_attachments(db: Session, staff_id: int) -> list[HRStaffAttachment]:
    stmt = (
        select(HRStaffAttachment)
        .where(HRStaffAttachment.staff_id == staff_id)
        .order_by(HRStaffAttachment.created_at.desc())
    )
    return list(db.execute(stmt).scalars().all())


def get_attachment(db: Session, staff_id: int, attachment_id: int) -> HRStaffAttachment | None:
    stmt = select(HRStaffAttachment).where(
        and_(HRStaffAttachment.staff_id == staff_id, HRStaffAttachment.id == attachment_id)
    )
    return db.execute(stmt).scalars().first()


def create_attachment(
    db: Session,
    *,
    staff_id: int,
    original_filename: str,
    content_type: str | None,
) -> HRStaffAttachment:
    _, ext = os.path.splitext(original_filename)
    stored_filename = f"{uuid.uuid4().hex}{ext}" if ext else uuid.uuid4().hex

    att = HRStaffAttachment(
        staff_id=staff_id,
        original_filename=original_filename,
        stored_filename=stored_filename,
        content_type=content_type,
    )
    db.add(att)
    db.commit()
    db.refresh(att)
    return att


def list_attachments_for_staff_ids(db: Session, staff_ids: list[int]) -> list[HRStaffAttachment]:
    if not staff_ids:
        return []
    stmt = select(HRStaffAttachment).where(HRStaffAttachment.staff_id.in_(staff_ids))
    return list(db.execute(stmt).scalars().all())
