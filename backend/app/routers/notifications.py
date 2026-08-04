from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, require_member
from ..models import Notification, PushSubscription, User
from ..schemas import NotificationOut, PushSubscribeIn
from ..services import push

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/vapid-public-key")
def vapid_public_key(db: Session = Depends(get_db)):
    return {"public_key": push.get_vapid_public_key(db)}


@router.post("/subscribe")
def subscribe(
    payload: PushSubscribeIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = (
        db.query(PushSubscription)
        .filter(PushSubscription.endpoint == payload.endpoint)
        .first()
    )
    if existing is None:
        db.add(
            PushSubscription(
                user_id=user.id,
                endpoint=payload.endpoint,
                p256dh=payload.p256dh,
                auth=payload.auth,
            )
        )
        db.commit()
    else:
        existing.user_id = user.id
        existing.p256dh = payload.p256dh
        existing.auth = payload.auth
        db.commit()
    return {"ok": True}


@router.post("/unsubscribe")
def unsubscribe(
    payload: PushSubscribeIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.query(PushSubscription).filter(
        PushSubscription.endpoint == payload.endpoint,
        PushSubscription.user_id == user.id,
    ).delete()
    db.commit()
    return {"ok": True}


@router.get("", response_model=List[NotificationOut])
def list_notifications(
    user: User = Depends(require_member),
    db: Session = Depends(get_db),
    unread_only: bool = False,
):
    query = (
        db.query(Notification)
        .filter(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .limit(100)
    )
    if unread_only:
        query = query.filter(Notification.read == False)  # noqa: E712
    return query.all()


@router.get("/unread-count")
def unread_count(
    user: User = Depends(require_member), db: Session = Depends(get_db)
):
    n = (
        db.query(Notification)
        .filter(Notification.user_id == user.id, Notification.read == False)  # noqa: E712
        .count()
    )
    return {"count": n}


@router.post("/read")
def mark_read(
    notification_id: int,
    user: User = Depends(require_member),
    db: Session = Depends(get_db),
):
    n = db.get(Notification, notification_id)
    if n is not None and n.user_id == user.id:
        n.read = True
        db.flush()
    return {"ok": True}


@router.post("/read-all")
def mark_all_read(
    user: User = Depends(require_member), db: Session = Depends(get_db)
):
    items = (
        db.query(Notification)
        .filter(Notification.user_id == user.id, Notification.read == False)  # noqa: E712
        .all()
    )
    for n in items:
        n.read = True
    db.flush()
    return {"ok": True}
