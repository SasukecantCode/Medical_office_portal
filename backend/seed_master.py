from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from app.crud.auth_users import get_user_by_username_role, normalize_username
from app.db.session import SessionLocal
from app.models.auth_user import AuthUser
from app.services.auth import hash_password


MASTER_ROLE = "master"
MASTER_USERNAME = "roshan"
MASTER_PASSWORD = "1234"
MASTER_EMAIL = "admin.master.roshan@namsai.example"
MASTER_FULL_NAME = "Roshan Master"


def seed_master() -> None:
    db = SessionLocal()
    try:
        username = normalize_username(MASTER_USERNAME)
        user = get_user_by_username_role(db, MASTER_ROLE, username)

        if user is None:
            user = AuthUser(
                full_name=MASTER_FULL_NAME,
                phone_number=None,
                username=username,
                role=MASTER_ROLE,
                email=MASTER_EMAIL,
                password_hash=hash_password(MASTER_PASSWORD),
                is_email_verified=True,
                is_active=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            print(f"seed_master: created {user.profile_handle}")
            return

        user.full_name = MASTER_FULL_NAME
        user.email = MASTER_EMAIL
        user.password_hash = hash_password(MASTER_PASSWORD)
        user.is_email_verified = True
        user.is_active = True
        user.otp_code_hash = None
        user.otp_expires_at = None
        user.otp_sent_at = None
        db.add(user)
        db.commit()
        db.refresh(user)
        print(f"seed_master: updated {user.profile_handle}")
    finally:
        db.close()


if __name__ == "__main__":
    seed_master()