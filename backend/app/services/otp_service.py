from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

from app.core.config import settings


def generate_otp_code(length: int | None = None) -> str:
    otp_length = length or settings.auth_otp_length
    upper_bound = 10**otp_length
    return f"{secrets.randbelow(upper_bound):0{otp_length}d}"


def hash_otp_code(code: str) -> str:
    payload = f"{settings.auth_jwt_secret_key}:{code.strip()}".encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def verify_otp_code(code: str, expected_hash: str | None) -> bool:
    if not expected_hash:
        return False
    return hmac.compare_digest(hash_otp_code(code), expected_hash)


def otp_expires_at(minutes: int | None = None) -> datetime:
    return datetime.now(timezone.utc) + timedelta(minutes=minutes or settings.auth_otp_expiry_minutes)