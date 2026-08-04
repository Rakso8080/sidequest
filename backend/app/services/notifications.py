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
