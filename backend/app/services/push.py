from __future__ import annotations

"""Web Push via VAPID.

The VAPID private key is generated once and stored in the app_settings table
so it survives restarts even on an ephemeral filesystem (a new key would
silently invalidate every saved subscription).
"""

import base64
import json
import logging
import threading

from sqlalchemy.orm import Session

from .. import models
from ..config import VAPID_SUBJECT

log = logging.getLogger(__name__)

_VAPID_KEY = "vapid_private_pem"
_claims = {"sub": VAPID_SUBJECT}


def _derive_public_b64(private_pem: str) -> str:
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import ec

    key = serialization.load_pem_private_key(private_pem.encode(), password=None)
    public = key.public_key().public_bytes(
        serialization.Encoding.X962,
        serialization.PublicFormat.UncompressedPoint,
    )
    return base64.urlsafe_b64encode(public).rstrip(b"=").decode()


def _generate_pem() -> str:
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import ec

    key = ec.generate_private_key(ec.SECP256R1())
    return (
        key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption(),
        )
        .decode()
        .strip()
    )


def _get_or_create_private(db: Session) -> str:
    row = (
        db.query(models.AppSetting)
        .filter(models.AppSetting.key == _VAPID_KEY)
        .first()
    )
    if row is not None and row.value:
        return row.value
    pem = _generate_pem()
    if row is None:
        row = models.AppSetting(key=_VAPID_KEY, value=pem)
        db.add(row)
    else:
        row.value = pem
    db.commit()
    return pem


def get_vapid_public_key(db: Session) -> str:
    return _derive_public_b64(_get_or_create_private(db))


def dispatch_push(
    db: Session, user_id: int, title: str, body: str, url: str = "/notifications"
) -> None:
    """Fire-and-forget: read the user's subscriptions and push in background
    threads so API requests never block on a slow push service."""
    subs = (
        db.query(models.PushSubscription)
        .filter(models.PushSubscription.user_id == user_id)
        .all()
    )
    if not subs:
        return
    private_pem = _get_or_create_private(db)
    payload = json.dumps(
        {
            "title": title,
            "body": body,
            "icon": "/icons/icon-192.png",
            "badge": "/icons/icon-192.png",
            "url": url,
        }
    )

    def worker(sub: models.PushSubscription) -> None:
        try:
            from ..database import SessionLocal

            with SessionLocal() as s:
                live = (
                    s.query(models.PushSubscription)
                    .filter(models.PushSubscription.id == sub.id)
                    .first()
                )
                if live is None:
                    return
                try:
                    from pywebpush import WebPushException, webpush

                    webpush(
                        {
                            "endpoint": live.endpoint,
                            "keys": {"p256dh": live.p256dh, "auth": live.auth},
                        },
                        payload,
                        vapid_private_key=private_pem,
                        vapid_claims=_claims,
                        ttl=24 * 3600,
                    )
                except WebPushException as exc:
                    status = getattr(exc.response, "status_code", None)
                    if status in (404, 410):
                        s.delete(live)
                        s.commit()
        except Exception as exc:  # pragma: no cover - defensive
            log.warning("Push worker error: %s", exc)

    for sub in subs:
        threading.Thread(target=worker, args=(sub,), daemon=True).start()
