from __future__ import annotations

from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt

from app.core.config import settings


def hash_password(password: str) -> str:
    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
    return hashed.decode("utf-8")


def verify_password(plain_password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            password_hash.encode("utf-8"),
        )
    except (ValueError, TypeError):
        return False


def create_access_token(*, user_id: int, role: str, username: str, profile_handle: str) -> str:
    now = datetime.now(timezone.utc)
    expires = now + timedelta(minutes=settings.auth_jwt_expiry_minutes)
    payload = {
        "sub": str(user_id),
        "role": role,
        "username": username,
        "profile_handle": profile_handle,
        "iat": int(now.timestamp()),
        "exp": int(expires.timestamp()),
    }
    return jwt.encode(payload, settings.auth_jwt_secret_key, algorithm=settings.auth_jwt_algorithm)


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, settings.auth_jwt_secret_key, algorithms=[settings.auth_jwt_algorithm])


def token_subject(token: str) -> str | None:
    try:
        payload = decode_access_token(token)
    except JWTError:
        return None
    return payload.get("sub")
