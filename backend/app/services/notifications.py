from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session

from .. import models


def notify(
    db: Session,
    user_id: int,
    squad_id: Optional[int],
    title: str,
    body: str = "",
    ntype: str = "info",
) -> None:
    db.add(
        models.Notification(
            user_id=user_id,
            squad_id=squad_id,
            type=ntype,
            title=title,
            body=body,
        )
    )
    # Also deliver a Web Push to the phone/browser if subscribed.
    from .push import dispatch_push

    try:
        dispatch_push(db, user_id, title, body)
    except Exception:
        pass
