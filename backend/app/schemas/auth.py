from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.auth_user import UserRole


class SignupRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)
    phone_number: str | None = Field(default=None, max_length=50)
    username: str = Field(min_length=3, max_length=80)
    role: UserRole
    email: EmailStr
    password: str = Field(min_length=4, max_length=128)
    access_code: str | None = Field(default=None, max_length=128)
    invite_token: str | None = Field(default=None, max_length=256)

    @field_validator("full_name", "username", "phone_number", "access_code", "invite_token", mode="before")
    @classmethod
    def strip_strings(cls, value):
        if isinstance(value, str):
            return value.strip()
        return value


class LoginRequest(BaseModel):
    login: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=1, max_length=128)
    role: UserRole | None = None

    @field_validator("login", mode="before")
    @classmethod
    def strip_login(cls, value):
        if isinstance(value, str):
            return value.strip()
        return value


class VerifyOtpRequest(BaseModel):
    email: EmailStr
    otp_code: str = Field(min_length=4, max_length=12)

    @field_validator("otp_code", mode="before")
    @classmethod
    def strip_otp(cls, value):
        if isinstance(value, str):
            return value.strip()
        return value


class ResendOtpRequest(BaseModel):
    email: EmailStr


class UsernameAvailabilityResponse(BaseModel):
    available: bool
    profile_handle: str


class AuthUserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    phone_number: str | None = None
    username: str
    role: UserRole
    email: EmailStr
    profile_handle: str
    is_email_verified: bool
    is_active: bool
    created_at: datetime
    last_login_at: datetime | None = None


class SignupResponse(BaseModel):
    message: str
    profile_handle: str
    email: EmailStr
    otp_expires_at: datetime | None = None


class VerifyOtpResponse(BaseModel):
    message: str
    profile_handle: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: AuthUserRead


class AdminInviteCreateRequest(BaseModel):
    role: UserRole
    note: str | None = Field(default=None, max_length=255)
    expires_in_days: int = Field(default=30, ge=1, le=365)


class AdminInviteRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    role: UserRole
    token_preview: str
    note: str | None = None
    created_by_user_id: int
    redeemed_by_user_id: int | None = None
    expires_at: datetime | None = None
    redeemed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class AdminInviteCreateResponse(BaseModel):
    message: str
    invite: AdminInviteRead
    token: str


class AdminUserListResponse(BaseModel):
    users: list[AuthUserRead]


class AdminAccessLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    invite_id: int | None = None
    profile_handle: str
    role: UserRole
    full_name: str
    logged_in_at: datetime


class AdminAccessLogListResponse(BaseModel):
    logs: list[AdminAccessLogRead]


class LogoutResponse(BaseModel):
    message: str