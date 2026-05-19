from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.crud.hr_staff import dashboard_summary
from app.db.session import get_db

router = APIRouter(prefix="/dashboard")


@router.get("")
def get_dashboard(db: Session = Depends(get_db)):
    return dashboard_summary(db)
