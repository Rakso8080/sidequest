from __future__ import annotations

from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_user_squad, require_member
from ..models import Punishment, User
from ..schemas import PunishmentOut
from ..services.serializers import punishment_out
from ..services.voting import utcnow

router = APIRouter(prefix="/punishments", tags=["punishments"])


def _mark_overdue(p: Punishment) -> None:
    if p.status == "assigned" and utcnow() > p.due_date:
        p.status = "overdue"


@router.get("", response_model=List[PunishmentOut])
def list_punishments(
    user: User = Depends(require_member), db: Session = Depends(get_db)
):
    squad = get_user_squad(db, user)
    items = (
        db.query(Punishment)
        .filter(Punishment.squad_id == squad.id)
        .order_by(Punishment.created_at.desc())
        .limit(100)
        .all()
    )
    for p in items:
        _mark_overdue(p)
    db.flush()
    return [punishment_out(p) for p in items]


@router.get("/mine", response_model=List[PunishmentOut])
def my_punishments(
    user: User = Depends(require_member), db: Session = Depends(get_db)
):
    items = (
        db.query(Punishment)
        .filter(Punishment.user_id == user.id)
        .order_by(Punishment.created_at.desc())
        .all()
    )
    for p in items:
        _mark_overdue(p)
    db.flush()
    return [punishment_out(p) for p in items]


@router.post("/{punishment_id}/complete", response_model=PunishmentOut)
def complete_punishment(
    punishment_id: int,
    user: User = Depends(require_member),
    db: Session = Depends(get_db),
):
    p = db.get(Punishment, punishment_id)
    if p is None or p.user_id != user.id:
        raise HTTPException(status_code=404, detail="Punishment not found")
    if p.status == "completed":
        raise HTTPException(status_code=400, detail="Already completed")
    p.status = "completed"
    p.completed_at = datetime.now()
    db.flush()
    return punishment_out(p)
