from __future__ import annotations

from datetime import datetime
from typing import List

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.hr_field_def import HRFieldDef
from app.schemas.hr_field_def import HRFieldDefCreate, HRFieldDefUpdate


def list_field_defs(db: Session) -> List[HRFieldDef]:
    stmt = select(HRFieldDef).where(HRFieldDef.deleted_at.is_(None)).order_by(HRFieldDef.sort_order, HRFieldDef.id)
    return list(db.execute(stmt).scalars().all())


def get_field_def(db: Session, field_id: int) -> HRFieldDef | None:
    stmt = select(HRFieldDef).where(HRFieldDef.id == field_id)
    return db.execute(stmt).scalars().first()


def create_field_def(db: Session, payload: HRFieldDefCreate) -> HRFieldDef:
    data = payload.model_dump()
    f = HRFieldDef(**data)
    db.add(f)
    db.commit()
    db.refresh(f)
    return f


def update_field_def(db: Session, field_id: int, payload: HRFieldDefUpdate) -> HRFieldDef | None:
    f = get_field_def(db, field_id)
    if f is None:
        return None
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(f, k, v)
    db.add(f)
    db.commit()
    db.refresh(f)
    return f


def delete_field_def(db: Session, field_id: int) -> bool:
    f = get_field_def(db, field_id)
    if f is None:
        return False
    f.deleted_at = datetime.utcnow()
    db.add(f)
    db.commit()
    return True
