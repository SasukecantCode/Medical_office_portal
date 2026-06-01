from __future__ import annotations

import re
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.auth_invite import AuthInvite
from app.services.otp_service import hash_otp_code

# Short dictionary words for human-readable invite keys (4 words + 5 digits).
_INVITE_WORDS = (
    "amber", "anchor", "arrow", "atlas", "badge", "baker", "beacon", "birch",
    "blaze", "bloom", "breeze", "brook", "cabin", "canyon", "cedar", "charm",
    "cliff", "cloud", "coral", "crown", "delta", "drift", "eagle", "ember",
    "fable", "falcon", "field", "flame", "flint", "forge", "frost", "galaxy",
    "garden", "glade", "globe", "grace", "granite", "harbor", "haven", "hazel",
    "honor", "ivory", "jade", "jewel", "knight", "lagoon", "lance", "leaf",
    "light", "linen", "lotus", "maple", "marble", "meadow", "merit", "mint",
    "mist", "moon", "moss", "noble", "north", "oasis", "ocean", "olive",
    "onyx", "orbit", "otter", "pearl", "pine", "plain", "prism", "pulse",
    "quartz", "quest", "quiet", "rain", "raven", "ridge", "river", "robin",
    "rock", "ruby", "sage", "shore", "silver", "sky", "slate", "snow",
    "solar", "spark", "sparrow", "spring", "star", "stone", "storm", "summit",
    "sun", "swan", "terra", "thorn", "tide", "timber", "torch", "tower",
    "trail", "vale", "vault", "veil", "vertex", "violet", "wave", "willow",
    "wind", "winter", "wolf", "wood", "zenith",
)


def generate_admin_token() -> str:
    words = [secrets.choice(_INVITE_WORDS) for _ in range(4)]
    digits = f"{secrets.randbelow(100_000):05d}"
    return f"{'-'.join(words)}-{digits}"


def normalize_invite_token(token: str) -> str:
    """Canonical form: four hyphenated words and five digits."""
    cleaned = re.sub(r"[\s_]+", "-", token.strip().lower())
    cleaned = re.sub(r"-+", "-", cleaned).strip("-")
    return cleaned


def token_preview(token: str) -> str:
    canonical = normalize_invite_token(token)
    match = re.fullmatch(r"([a-z]+(?:-[a-z]+){3})-(\d{5})", canonical)
    if match:
        words = match.group(1).split("-")
        return f"{words[0]}-{words[-1]}…{match.group(2)[-4:]}"
    if len(canonical) <= 28:
        return canonical
    return canonical[:10] + "…" + canonical[-5:]


def hash_admin_token(token: str) -> str:
    return hash_otp_code(f"invite:{normalize_invite_token(token)}")


def _hash_legacy_admin_token(token: str) -> str:
    """Pre–word-format keys (raw token_urlsafe string)."""
    return hash_otp_code(f"invite:{token.strip()}")


def create_invite(
    db: Session,
    *,
    role: str,
    created_by_user_id: int,
    note: str | None = None,
    expires_in_days: int = 30,
) -> tuple[AuthInvite, str]:
    token = generate_admin_token()
    invite = AuthInvite(
        role=role,
        token_hash=hash_admin_token(token),
        token_preview=token_preview(token),
        note=note,
        created_by_user_id=created_by_user_id,
        expires_at=datetime.now(timezone.utc) + timedelta(days=expires_in_days) if expires_in_days else None,
    )
    db.add(invite)
    db.commit()
    db.refresh(invite)
    return invite, token


def list_invites(db: Session) -> list[AuthInvite]:
    stmt = select(AuthInvite).order_by(AuthInvite.created_at.desc())
    return list(db.execute(stmt).scalars().all())


def get_invite_by_id(db: Session, invite_id: int) -> AuthInvite | None:
    stmt = select(AuthInvite).where(AuthInvite.id == invite_id)
    return db.execute(stmt).scalars().first()


def get_invite_by_token(db: Session, token: str) -> AuthInvite | None:
    raw = token.strip()
    if not raw:
        return None

    canonical = normalize_invite_token(raw)
    if re.fullmatch(r"[a-z]+(?:-[a-z]+){3}-\d{5}", canonical):
        stmt = select(AuthInvite).where(AuthInvite.token_hash == hash_admin_token(canonical))
        found = db.execute(stmt).scalars().first()
        if found is not None:
            return found

    # Legacy keys issued before the word+number format
    stmt = select(AuthInvite).where(AuthInvite.token_hash == _hash_legacy_admin_token(raw))
    return db.execute(stmt).scalars().first()


def delete_invite(db: Session, invite: AuthInvite) -> None:
    db.delete(invite)
    db.commit()


def clear_invite_redemption_for_user(db: Session, user_id: int) -> None:
    """Detach deleted accounts from invites; invite stays marked as used."""
    stmt = select(AuthInvite).where(AuthInvite.redeemed_by_user_id == user_id)
    for invite in db.execute(stmt).scalars().all():
        invite.redeemed_by_user_id = None
        db.add(invite)
    db.commit()


def get_invite_for_user(db: Session, user_id: int) -> AuthInvite | None:
    stmt = (
        select(AuthInvite)
        .where(AuthInvite.redeemed_by_user_id == user_id)
        .order_by(AuthInvite.redeemed_at.desc())
    )
    return db.execute(stmt).scalars().first()


def consume_invite(db: Session, invite: AuthInvite, *, redeemed_by_user_id: int) -> AuthInvite:
    invite.redeemed_by_user_id = redeemed_by_user_id
    invite.redeemed_at = datetime.now(timezone.utc)
    db.add(invite)
    db.commit()
    db.refresh(invite)
    return invite
