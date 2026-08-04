from __future__ import annotations

import os
import warnings

from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(BASE_DIR, ".env"))

DEFAULT_SECRET = "sidequest-dev-secret-change-me"
SECRET_KEY = os.environ.get("SECRET_KEY", DEFAULT_SECRET)
if SECRET_KEY == DEFAULT_SECRET:
    warnings.warn(
        "SECRET_KEY is still the development default — set a strong "
        "SECRET_KEY in backend/.env before deploying.",
        UserWarning,
    )

ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Oskar")

GIPHY_API_KEY = os.environ.get("GIPHY_API_KEY", "")

# Password-reset delivery. Leave unset to run in "dev mode" (the code is
# returned in the API response instead of emailed/SMS'd — fine for testing,
# insecure for production).
SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASS = os.environ.get("SMTP_PASS", "")
MAIL_FROM = os.environ.get("MAIL_FROM", "")

TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN", "")
TWILIO_FROM = os.environ.get("TWILIO_FROM", "")

# Web Push (VAPID). Private key is auto-generated and stored in the DB, so
# only SUBJECT is needed. Set a mailto: or https: address for the push
# service to contact you.
VAPID_SUBJECT = os.environ.get("VAPID_SUBJECT", "mailto:sidequest@localhost")

_cors = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]
CORS_ORIGINS = _cors or ["*"]

STATIC_DIR = os.environ.get(
    "STATIC_DIR",
    os.path.join(os.path.dirname(BASE_DIR), "frontend", "dist"),
)
