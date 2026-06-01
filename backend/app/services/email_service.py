from __future__ import annotations

import logging
import smtplib
import ssl
from email.message import EmailMessage

from app.core.config import settings

logger = logging.getLogger(__name__)


def _smtp_sender() -> str:
    return settings.auth_smtp_from_email or settings.auth_smtp_user or "no-reply@localhost"


def _send_email(message: EmailMessage) -> None:
    if not settings.auth_smtp_host:
        logger.info("SMTP not configured; OTP email for %s: %s", message["To"], message.get_content())
        return

    context = ssl.create_default_context()
    with smtplib.SMTP(settings.auth_smtp_host, settings.auth_smtp_port, timeout=settings.auth_smtp_timeout_seconds) as server:
        if settings.auth_smtp_use_tls:
            server.starttls(context=context)
        if settings.auth_smtp_user and settings.auth_smtp_password:
            server.login(settings.auth_smtp_user, settings.auth_smtp_password)
        server.send_message(message)


def send_signup_otp_email(*, to_email: str, full_name: str, profile_handle: str, otp_code: str) -> None:
    message = EmailMessage()
    message["Subject"] = "Verify your Medical Office Portal account"
    message["From"] = _smtp_sender()
    message["To"] = to_email
    message.set_content(
        f"""Hello {full_name},

Your verification code for {profile_handle} is: {otp_code}

This code expires in {settings.auth_otp_expiry_minutes} minutes.
If you did not request this account, you can ignore this email.
"""
    )
    _send_email(message)


def send_welcome_email(*, to_email: str, full_name: str, profile_handle: str) -> None:
    message = EmailMessage()
    message["Subject"] = "Your Medical Office Portal account is verified"
    message["From"] = _smtp_sender()
    message["To"] = to_email
    message.set_content(
        f"""Hello {full_name},

Your account {profile_handle} is now verified and ready to use.
"""
    )
    _send_email(message)