from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, require_admin
from ..models import Squad, User
from ..schemas import (
    CreateSquadIn,
    JoinSquadIn,
    MemberOut,
    SquadOut,
    UpdateSettingsIn,
)
from ..services.seed import create_squad, generate_invite_code
from ..services.settings import get_settings, sanitize_settings

router = APIRouter(prefix="/squads", tags=["squads"])


def _squad_out(db: Session, squad: Squad) -> SquadOut:
    settings = get_settings(squad)
    members = []
    for m in squad.members:
        if m.squad_id != squad.id:
            continue
        members.append(
            MemberOut(
                id=m.id,
                display_name=m.display_name,
                username=m.username,
                avatar=m.avatar,
                bio=m.bio,
                total_points=m.total_points,
                streak=m.streak,
                is_admin=m.id == squad.admin_id,
            )
        )
    return SquadOut(
        id=squad.id,
        name=squad.name,
        invite_code=squad.invite_code,
        admin_id=squad.admin_id,
        settings=settings,
        members=members,
    )


@router.post("", response_model=SquadOut)
def create_squad_ep(
    payload: CreateSquadIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.squad_id is not None:
        raise HTTPException(
            status_code=400, detail="You already belong to a squad"
        )
    squad = create_squad(db, user, payload.name.strip())
    db.flush()
    return _squad_out(db, squad)


@router.post("/join", response_model=SquadOut)
def join_squad(
    payload: JoinSquadIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.squad_id is not None:
        raise HTTPException(
            status_code=400, detail="You already belong to a squad"
        )
    squad = (
        db.query(Squad)
        .filter(Squad.invite_code == payload.invite_code.strip().upper())
        .first()
    )
    if squad is None:
        raise HTTPException(status_code=404, detail="Invite code not found")
    user.squad_id = squad.id
    db.flush()
    return _squad_out(db, squad)


@router.get("/me", response_model=SquadOut)
def get_my_squad(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    if user.squad_id is None:
        raise HTTPException(status_code=404, detail="No squad yet")
    squad = db.get(Squad, user.squad_id)
    if squad is None:
        raise HTTPException(status_code=404, detail="No squad yet")
    return _squad_out(db, squad)


@router.patch("/me/settings", response_model=SquadOut)
def update_settings(
    payload: UpdateSettingsIn,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    squad = db.get(Squad, admin.squad_id)
    if squad is None:
        raise HTTPException(status_code=404, detail="No squad yet")
    values = payload.model_dump(exclude_none=True)
    current = dict(get_settings(squad))
    current.update(values)
    squad.settings = sanitize_settings(current)
    db.flush()
    return _squad_out(db, squad)


@router.post("/invite/rotate", response_model=SquadOut)
def rotate_invite(
    admin: User = Depends(require_admin), db: Session = Depends(get_db)
):
    squad = db.get(Squad, admin.squad_id)
    if squad is None:
        raise HTTPException(status_code=404, detail="No squad yet")
    squad.invite_code = generate_invite_code(db)
    db.flush()
    return _squad_out(db, squad)
