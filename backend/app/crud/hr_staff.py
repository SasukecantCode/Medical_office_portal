from __future__ import annotations

import json
import os
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.orm import Session

from app.models.hr_staff import HRStaff
from app.models.hr_staff_attachment import HRStaffAttachment
from app.schemas.hr_staff import HRStaffCreate, HRStaffUpdate


def _normalize_text_field(value: str) -> str:
    """Title-case and strip whitespace for consistent storage."""
    return " ".join(value.strip().split()).title()

# Fields that should be auto-normalized to Title Case on create/update
_TITLE_CASE_FIELDS = [
    "full_name",
    "designation",
    "cadre",
    "employment_type",
    "facility_name",
    "facility_type",
    "district",
    "block",
    "posting_place",
]

def _apply_case_normalization(data: dict) -> dict:
    for field in _TITLE_CASE_FIELDS:
        if field in data and data[field] and isinstance(data[field], str):
            data[field] = _normalize_text_field(data[field])
    return data

def create_staff(db: Session, payload: HRStaffCreate) -> HRStaff:
    data = payload.model_dump()
    _apply_case_normalization(data)
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
    district: Optional[str],
    designation: Optional[str],
    facility_name: Optional[str],
    employment_type: Optional[str],
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
                HRStaff.facility_name.ilike(like),
                HRStaff.district.ilike(like),
            )
        )

    if district:
        filters.append(func.lower(func.trim(HRStaff.district)) == district.strip().lower())
    if designation:
        filters.append(HRStaff.designation == designation)
    if facility_name:
        filters.append(HRStaff.facility_name == facility_name)
    if employment_type:
        filters.append(HRStaff.employment_type == employment_type)

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
        .where(and_(*_filters(q, district, designation, facility_name, employment_type)))
        .order_by(HRStaff.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return list(db.execute(stmt).scalars().all())


def update_staff(db: Session, staff_id: int, payload: HRStaffUpdate) -> HRStaff | None:
    staff = get_staff(db, staff_id)
    if staff is None:
        return None

    data = payload.model_dump(exclude_unset=True)
    _apply_case_normalization(data)
    for key, value in data.items():
        setattr(staff, key, value)

    db.add(staff)
    db.commit()
    db.refresh(staff)
    return staff


_SUGGESTION_FIELDS = {
    "designation": HRStaff.designation,
    "cadre": HRStaff.cadre,
    "employment_type": HRStaff.employment_type,
    "facility_name": HRStaff.facility_name,
    "facility_type": HRStaff.facility_type,
    "district": HRStaff.district,
    "block": HRStaff.block,
    "posting_place": HRStaff.posting_place,
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
    return True


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
        .where(and_(*_filters(q, district, designation, facility_name, employment_type)))
        .order_by(HRStaff.created_at.desc())
    )
    results = list(db.execute(stmt).scalars().all())

    def to_row(s: HRStaff) -> dict:
        return {
            "id": s.id,
            "full_name": s.full_name,
            "gender": s.gender,
            "date_of_birth": s.date_of_birth.isoformat() if s.date_of_birth else "",
            "designation": s.designation,
            "cadre": s.cadre or "",
            "employment_type": s.employment_type or "",
            "phone": s.phone or "",
            "email": s.email or "",
            "facility_name": s.facility_name,
            "facility_type": s.facility_type or "",
            "district": s.district,
            "block": s.block or "",
            "posting_place": s.posting_place or "",
            "date_of_joining": s.date_of_joining.isoformat() if s.date_of_joining else "",
            "remarks": s.remarks or "",
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
            out.append({"key": label, "count": r.count})
        return out

    return {
        "totals": {"staff": total_staff},
        "by_designation": grouped(HRStaff.designation),
        "by_district": grouped_case_insensitive(HRStaff.district),
        "by_employment_type": grouped(HRStaff.employment_type),
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
