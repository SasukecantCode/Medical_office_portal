from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.crud.admin_access_logs import list_admin_access_logs, record_admin_access_log
from app.crud.auth_invites import (
    consume_invite,
    create_invite,
    delete_invite,
    get_invite_by_id,
    get_invite_by_token,
    get_invite_for_user,
    list_invites,
    normalize_invite_token,
)
from app.crud.auth_users import (
    activate_user_account,
    authenticate_user,
    create_active_user,
    delete_invite_admin_account,
    get_user_by_email,
    get_user_by_id,
    is_deletable_invite_admin,
    list_logged_in_invite_admins,
    is_email_available,
    is_username_available,
    normalize_username,
    normalize_role,
    profile_handle_for,
    update_last_login,
    validate_username,
)
from app.db.session import get_db
from app.schemas.auth import (
    AuthUserRead,
    LoginRequest,
    LoginResponse,
    LogoutResponse,
    ResendOtpRequest,
    SignupRequest,
    SignupResponse,
    UsernameAvailabilityResponse,
    VerifyOtpRequest,
    VerifyOtpResponse,
    AdminInviteCreateRequest,
    AdminAccessLogListResponse,
    AdminAccessLogRead,
    AdminInviteCreateResponse,
    AdminInviteRead,
    AdminUserListResponse,
)
from app.services.auth import create_access_token

router = APIRouter(prefix="/auth")


def _is_expired(expires_at: datetime | None) -> bool:
    if expires_at is None:
        return False
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    return expires_at < datetime.now(timezone.utc)


def _user_payload(user) -> dict:
    payload = AuthUserRead.model_validate(user).model_dump()
    payload["profile_handle"] = user.profile_handle
    payload["role"] = normalize_role(user.role)
    return payload


@router.get("/check-username", response_model=UsernameAvailabilityResponse)
def check_username(
    role: str = Query(...),
    username: str = Query(...),
    db: Session = Depends(get_db),
):
    username = normalize_username(username)
    role = normalize_role(role)
    if not validate_username(username):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Username must be 3-40 characters and use only letters, numbers, dot, underscore, and hyphen")

    available = is_username_available(db, role, username)
    return UsernameAvailabilityResponse(available=available, profile_handle=profile_handle_for(role, username))


@router.post("/signup", response_model=SignupResponse)
def signup(payload: SignupRequest, db: Session = Depends(get_db)):
    invite_token = normalize_invite_token(payload.invite_token or "")
    if not invite_token:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="A master admin invite key is required to register",
        )

    invite = get_invite_by_token(db, invite_token)
    if invite is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid invite key")
    if invite.redeemed_at is not None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invite key has already been used")
    if _is_expired(invite.expires_at):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invite key has expired")
    if normalize_role(payload.role) != normalize_role(invite.role):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invite key role does not match signup role")

    username = normalize_username(payload.username)
    role = normalize_role(payload.role)
    if not validate_username(username):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Username must be 3-40 characters and use only letters, numbers, dot, underscore, and hyphen")

    if not is_username_available(db, role, username):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username not available for this role")

    if not is_email_available(db, str(payload.email)):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered")

    user = create_active_user(db, payload)
    consume_invite(db, invite, redeemed_by_user_id=user.id)

    return SignupResponse(
        message="Account created. You can sign in now.",
        profile_handle=user.profile_handle,
        email=user.email,
        otp_expires_at=None,
    )


@router.post("/verify-otp", response_model=VerifyOtpResponse)
def verify_otp(payload: VerifyOtpRequest, db: Session = Depends(get_db)):
    """Legacy endpoint: activates pending accounts without OTP while email is not integrated."""
    user = get_user_by_email(db, str(payload.email))
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No account found for that email")
    if user.is_active and user.is_email_verified:
        return VerifyOtpResponse(message="Account is already active.", profile_handle=user.profile_handle)

    activate_user_account(db, user)
    return VerifyOtpResponse(message="Account activated. You can sign in now.", profile_handle=user.profile_handle)


@router.post("/resend-otp", response_model=SignupResponse)
def resend_otp(payload: ResendOtpRequest, db: Session = Depends(get_db)):
    user = get_user_by_email(db, str(payload.email))
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No account found for that email")
    if not user.is_active or not user.is_email_verified:
        activate_user_account(db, user)

    return SignupResponse(
        message="Email verification is not required. Sign in with your username and password.",
        profile_handle=user.profile_handle,
        email=user.email,
        otp_expires_at=None,
    )


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    login_identifier = payload.login
    role = normalize_role(payload.role) if payload.role else None
    username = login_identifier

    if login_identifier.lower().startswith("admin."):
        parts = login_identifier.split(".", 2)
        if len(parts) == 3:
            role = parts[1]
            username = parts[2]

    if not role:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Role is required for login")

    user = authenticate_user(db, role=role, username=username, password=payload.password)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials or account not verified")

    invite = get_invite_for_user(db, user.id)
    if invite is not None:
        record_admin_access_log(db, user=user, invite_id=invite.id)

    update_last_login(db, user)
    token = create_access_token(
        user_id=user.id,
        role=user.role,
        username=user.username,
        profile_handle=user.profile_handle,
    )
    return LoginResponse(access_token=token, user=_user_payload(user))


@router.get("/me", response_model=AuthUserRead)
def me(current_user=Depends(get_current_user)):
    return _user_payload(current_user)


@router.get("/admin-users", response_model=AdminUserListResponse)
def admin_users(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    if normalize_role(current_user.role) != "master":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Master access required")
    users = list_logged_in_invite_admins(db)
    return AdminUserListResponse(users=[_user_payload(user) for user in users])


@router.delete("/admin-users/{user_id}", response_model=LogoutResponse)
def delete_admin_user(
    user_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if normalize_role(current_user.role) != "master":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Master access required")

    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You cannot delete your own account",
        )

    user = get_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Admin account not found")

    if not is_deletable_invite_admin(db, user):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only invite-based HR or Vaccination admins who have signed in can be deleted",
        )

    delete_invite_admin_account(db, user)
    return LogoutResponse(message="Admin account deleted")


@router.get("/admin-access-logs", response_model=AdminAccessLogListResponse)
def admin_access_logs(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    if normalize_role(current_user.role) != "master":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Master access required")
    logs = list_admin_access_logs(db)
    return AdminAccessLogListResponse(
        logs=[
            AdminAccessLogRead(
                id=entry.id,
                user_id=entry.user_id,
                invite_id=entry.invite_id,
                profile_handle=entry.profile_handle,
                role=normalize_role(entry.role),
                full_name=entry.full_name,
                logged_in_at=entry.logged_in_at,
            )
            for entry in logs
        ]
    )


@router.get("/admin-invites", response_model=list[AdminInviteRead])
def admin_invites(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    if normalize_role(current_user.role) != "master":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Master access required")
    invites = list_invites(db)
    return [AdminInviteRead.model_validate(invite) for invite in invites]


@router.post("/admin-invites", response_model=AdminInviteCreateResponse)
def create_admin_invite(payload: AdminInviteCreateRequest, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    if normalize_role(current_user.role) != "master":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Master access required")

    invite_role = normalize_role(payload.role)
    if invite_role == "master":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Master accounts cannot be provisioned with invite keys",
        )

    invite, raw_token = create_invite(
        db,
        role=invite_role,
        created_by_user_id=current_user.id,
        note=payload.note,
        expires_in_days=payload.expires_in_days,
    )

    return AdminInviteCreateResponse(
        message="Invite key created. Share it with the new admin.",
        invite=AdminInviteRead.model_validate(invite),
        token=raw_token,
    )


@router.delete("/admin-invites/{invite_id}", response_model=LogoutResponse)
def revoke_admin_invite(
    invite_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if normalize_role(current_user.role) != "master":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Master access required")

    invite = get_invite_by_id(db, invite_id)
    if invite is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invite key not found")
    if invite.redeemed_at is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Used invite keys cannot be deleted",
        )

    delete_invite(db, invite)
    return LogoutResponse(message="Invite key deleted")


@router.post("/logout", response_model=LogoutResponse)
def logout():
    return LogoutResponse(message="Logged out")