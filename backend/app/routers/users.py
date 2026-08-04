from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Squad, User
from ..schemas import CreateSquadIn, JoinSquadIn, SquadOut, UpdateProfileIn, UserOut
from ..services.seed import create_squad, generate_invite_code
from ..services.settings import get_settings

router = APIRouter(tags=["users"])


@router.get("/users/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.patch("/users/me", response_model=UserOut)
def update_me(payload: UpdateProfileIn, user: User = Depends(get_current_user)):
    if payload.display_name is not None:
        user.display_name = payload.display_name.strip() or user.display_name
    if payload.avatar is not None:
        user.avatar = payload.avatar.strip() or user.avatar
    if payload.bio is not None:
        user.bio = payload.bio
    return user


class RegisterOut(BaseModel):
    user: UserOut
    squad: SquadOut


@router.get("/users/me/squad", response_model=RegisterOut)
def my_squad(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.squad_id is None:
        return RegisterOut(user=user, squad=None)  # type: ignore[arg-type]
    squad = db.get(Squad, user.squad_id)
    if squad is None:
        return RegisterOut(user=user, squad=None)  # type: ignore[arg-type]
    return RegisterOut(user=user, squad=_squad_out(db, squad))


def _squad_out(db: Session, squad: Squad) -> SquadOut:
    settings = get_settings(squad)
    members = [
        {
            "id": m.id,
            "display_name": m.display_name,
            "username": m.username,
            "avatar": m.avatar,
            "bio": m.bio,
            "total_points": m.total_points,
            "streak": m.streak,
            "is_admin": m.id == squad.admin_id,
        }
        for m in squad.members
        if m.squad_id == squad.id
    ]
    return SquadOut(
        id=squad.id,
        name=squad.name,
        invite_code=squad.invite_code,
        admin_id=squad.admin_id,
        settings=settings,
        members=members,
    )
