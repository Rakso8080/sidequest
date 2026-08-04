from __future__ import annotations

"""One-time verification codes for password reset.

Delivery is pluggable:
  - email via SMTP when SMTP_HOST is configured,
  - SMS via Twilio when TWILIO_ACCOUNT_SID is configured,
  - otherwise "dev mode": the code is returned in the API response so the
    flow can be tested end-to-end without any provider. The dev fallback is
    intentionally NOT silent — callers surface it to the UI.
"""

import hashlib
import hmac
import logging
import random
import smtplib
import time
from datetime import datetime, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

import httpx

from ..config import (
    MAIL_FROM,
    SMTP_HOST,
    SMTP_PASS,
    SMTP_PORT,
    SMTP_USER,
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    TWILIO_FROM,
)

log = logging.getLogger(__name__)

CODE_TTL_SECONDS = 15 * 60

# Cooldown so a user can't spam the "send code" button.
_last_sent: dict[str, float] = {}


def normalize_identifier(value: str) -> str:
    value = value.strip().lower()
    if "@" not in value and value.startswith("00"):
        value = "+" + value[2:]
    return value


def is_phone(identifier: str) -> bool:
    return "@" not in identifier


def _hash_code(code: str, salt: str) -> str:
    return hmac.new(salt.encode(), code.encode(), hashlib.sha256).hexdigest()


def new_code() -> str:
    return f"{random.randint(0, 999999):06d}"


def make_code_hash(code: str) -> str:
    salt = f"{time.time():.6f}"
    return f"{salt}:{_hash_code(code, salt)}"


def check_code_hash(code: str, stored: str) -> bool:
    if ":" not in stored:
        return False
    salt, digest = stored.split(":", 1)
    return hmac.compare_digest(_hash_code(code, salt), digest)


def expires_at() -> datetime:
    return datetime.utcnow() + timedelta(seconds=CODE_TTL_SECONDS)


def allow_send(identifier: str) -> bool:
    last = _last_sent.get(identifier)
    if last is not None and time.time() - last < 60:
        return False
    _last_sent[identifier] = time.time()
    return True


def _send_email(to_email: str, code: str) -> bool:
    if not SMTP_HOST:
        return False
    subject = "SideQuest — code for password reset"
    body = (
        f"Your SideQuest verification code is: {code}\n\n"
        "It expires in 15 minutes. If you didn't request this, you can ignore it."
    )
    msg = MIMEMultipart()
    msg["From"] = MAIL_FROM or SMTP_USER or SMTP_HOST
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain"))
    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            server.starttls()
            if SMTP_USER:
                server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(msg["From"], [to_email], msg.as_string())
        return True
    except Exception as exc:  # pragma: no cover - depends on external SMTP
        log.warning("Email send failed: %s", exc)
        return False


def _send_sms(to_phone: str, code: str) -> bool:
    if not TWILIO_ACCOUNT_SID:
        return False
    url = (
        f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_ACCOUNT_SID}"
        "/Messages.json"
    )
    data = {
        "To": to_phone,
        "From": TWILIO_FROM,
        "Body": f"SideQuest verification code: {code} (valid 15 min)",
    }
    try:
        resp = httpx.post(
            url,
            data=data,
            auth=(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN),
            timeout=15,
        )
        return resp.status_code < 400
    except Exception as exc:  # pragma: no cover - external service
        log.warning("SMS send failed: %s", exc)
        return False


def send_code(identifier: str, code: str) -> tuple[str, bool]:
    """Return (delivery_mode, sent). delivery is 'email'|'sms'|'dev'."""
    if is_phone(identifier):
        if _send_sms(identifier, code):
            return ("sms", True)
    else:
        if _send_email(identifier, code):
            return ("email", True)
    return ("dev", False)


def is_email_configured() -> bool:
    return bool(SMTP_HOST)


def is_sms_configured() -> bool:
    return bool(TWILIO_ACCOUNT_SID)
