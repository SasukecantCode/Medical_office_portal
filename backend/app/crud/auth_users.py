from __future__ import annotations

import re
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.auth_user import AuthUser, UserRole
from app.schemas.auth import SignupRequest
from app.services.auth import hash_password, verify_password
from app.services.otp_service import hash_otp_code, verify_otp_code

USERNAME_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9._-]{2,39}$")


def normalize_username(username: str) -> str:
    return " ".join(username.strip().split()).lower()


def normalize_role(role: str | UserRole) -> str:
    if isinstance(role, UserRole):
        return role.value
    return str(role).strip().lower()


def validate_username(username: str) -> bool:
    return bool(USERNAME_RE.fullmatch(username))


def profile_handle_for(role: str | UserRole, username: str) -> str:
    return f"admin.{normalize_role(role)}.{normalize_username(username)}"


def get_user_by_id(db: Session, user_id: int) -> AuthUser | None:
    stmt = select(AuthUser).where(AuthUser.id == user_id)
    return db.execute(stmt).scalars().first()


def get_user_by_email(db: Session, email: str) -> AuthUser | None:
    stmt = select(AuthUser).where(func.lower(AuthUser.email) == email.strip().lower())
    return db.execute(stmt).scalars().first()


def get_user_by_username_role(db: Session, role: str | UserRole, username: str) -> AuthUser | None:
    stmt = select(AuthUser).where(
        AuthUser.role == normalize_role(role),
        func.lower(AuthUser.username) == normalize_username(username).lower(),
    )
    return db.execute(stmt).scalars().first()


def is_username_available(db: Session, role: str | UserRole, username: str, *, exclude_user_id: int | None = None) -> bool:
    user = get_user_by_username_role(db, role, username)
    if user is None:
        return True
    return exclude_user_id is not None and user.id == exclude_user_id


def is_email_available(db: Session, email: str, *, exclude_user_id: int | None = None) -> bool:
    user = get_user_by_email(db, email)
    if user is None:
        return True
    return exclude_user_id is not None and user.id == exclude_user_id


def create_active_user(db: Session, payload: SignupRequest) -> AuthUser:
    """Create a verified, active account (no email OTP step)."""
    user = AuthUser(
        full_name=payload.full_name.strip(),
        phone_number=payload.phone_number.strip() if payload.phone_number else None,
        username=normalize_username(payload.username),
        role=normalize_role(payload.role),
        email=str(payload.email).strip().lower(),
        password_hash=hash_password(payload.password),
        is_email_verified=True,
        is_active=True,
        otp_code_hash=None,
        otp_expires_at=None,
        otp_sent_at=None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def create_pending_user(db: Session, payload: SignupRequest, *, otp_code: str, otp_expires_at: datetime) -> AuthUser:
    user = AuthUser(
        full_name=payload.full_name.strip(),
        phone_number=payload.phone_number.strip() if payload.phone_number else None,
        username=normalize_username(payload.username),
        role=normalize_role(payload.role),
        email=str(payload.email).strip().lower(),
        password_hash=hash_password(payload.password),
        is_email_verified=False,
        is_active=False,
        otp_code_hash=hash_otp_code(otp_code),
        otp_expires_at=otp_expires_at,
        otp_sent_at=datetime.now(timezone.utc),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def activate_user_account(db: Session, user: AuthUser) -> AuthUser:
    user.is_email_verified = True
    user.is_active = True
    user.otp_code_hash = None
    user.otp_expires_at = None
    user.otp_sent_at = None
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def refresh_user_otp(db: Session, user: AuthUser, *, otp_code: str, otp_expires_at: datetime) -> AuthUser:
    user.otp_code_hash = hash_otp_code(otp_code)
    user.otp_expires_at = otp_expires_at
    user.otp_sent_at = datetime.now(timezone.utc)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def verify_signup_otp(db: Session, user: AuthUser, otp_code: str) -> bool:
    if user.otp_expires_at and user.otp_expires_at < datetime.now(timezone.utc):
        return False
    if not verify_otp_code(otp_code, user.otp_code_hash):
        return False

    user.is_email_verified = True
    user.is_active = True
    user.otp_code_hash = None
    user.otp_expires_at = None
    db.add(user)
    db.commit()
    db.refresh(user)
    return True


def update_last_login(db: Session, user: AuthUser) -> AuthUser:
    user.last_login_at = datetime.now(timezone.utc)
    user.is_online = True
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, *, role: str | UserRole, username: str, password: str) -> AuthUser | None:
    user = get_user_by_username_role(db, role, username)
    if user is None:
        return None
    if not user.is_active or not user.is_email_verified:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


def list_auth_users(db: Session) -> list[AuthUser]:
    stmt = select(AuthUser).order_by(AuthUser.created_at.desc())
    return list(db.execute(stmt).scalars().all())


def is_deletable_invite_admin(db: Session, user: AuthUser) -> bool:
    """Invite-based HR/vaccination admins who have signed in at least once."""
    from app.crud.auth_invites import get_invite_for_user

    if normalize_role(user.role) == "master":
        return False
    if user.last_login_at is None:
        return False
    return get_invite_for_user(db, user.id) is not None


def delete_invite_admin_account(db: Session, user: AuthUser) -> None:
    from app.crud.admin_access_logs import delete_access_logs_for_user
    from app.crud.auth_invites import clear_invite_redemption_for_user

    delete_access_logs_for_user(db, user.id)
    clear_invite_redemption_for_user(db, user.id)
    db.delete(user)
    db.commit()


def list_logged_in_invite_admins(db: Session) -> list[AuthUser]:
    """Admins who registered with a master invite key and have signed in at least once."""
    from app.models.auth_invite import AuthInvite

    stmt = (
        select(AuthUser)
        .join(AuthInvite, AuthInvite.redeemed_by_user_id == AuthUser.id)
        .where(AuthUser.last_login_at.is_not(None))
        .order_by(AuthUser.last_login_at.desc())
        .distinct()
    )
    return list(db.execute(stmt).scalars().all())
