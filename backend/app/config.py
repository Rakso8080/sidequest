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

_cors = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]
CORS_ORIGINS = _cors or ["*"]

STATIC_DIR = os.environ.get(
    "STATIC_DIR",
    os.path.join(os.path.dirname(BASE_DIR), "frontend", "dist"),
)
