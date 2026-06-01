from __future__ import annotations

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.admin_access_log import AdminAccessLog
from app.models.auth_user import AuthUser


def record_admin_access_log(
    db: Session,
    *,
    user: AuthUser,
    invite_id: int | None,
) -> AdminAccessLog:
    entry = AdminAccessLog(
        user_id=user.id,
        invite_id=invite_id,
        profile_handle=user.profile_handle,
        role=user.role,
        full_name=user.full_name,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def delete_access_logs_for_user(db: Session, user_id: int) -> None:
    db.execute(delete(AdminAccessLog).where(AdminAccessLog.user_id == user_id))
    db.commit()


def list_admin_access_logs(db: Session, *, limit: int = 200) -> list[AdminAccessLog]:
    stmt = (
        select(AdminAccessLog)
        .order_by(AdminAccessLog.logged_in_at.desc())
        .limit(limit)
    )
    return list(db.execute(stmt).scalars().all())
