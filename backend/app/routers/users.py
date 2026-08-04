from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, is_online
from ..models import Squad, User
from ..schemas import CreateSquadIn, JoinSquadIn, SquadOut, UpdateProfileIn, UserOut, UserSearchOut
from ..services.seed import create_squad, generate_invite_code
from ..services.settings import get_settings
from ..services.storage import save_upload

router = APIRouter(tags=["users"])


@router.get("/users/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.patch("/users/me", response_model=UserOut)
def update_me(
    payload: UpdateProfileIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.display_name is not None:
        user.display_name = payload.display_name.strip() or user.display_name
    if payload.username is not None:
        new_name = payload.username.strip().lower()
        if not new_name:
            raise HTTPException(status_code=400, detail="Username can't be empty")
        if len(new_name) < 2:
            raise HTTPException(status_code=400, detail="Username too short")
        exists = (
            db.query(User)
            .filter(User.username == new_name, User.id != user.id)
            .first()
        )
        if exists:
            raise HTTPException(status_code=409, detail="Username already taken")
        user.username = new_name
    if payload.avatar is not None:
        user.avatar = payload.avatar.strip() or user.avatar
    if payload.bio is not None:
        user.bio = payload.bio
    if payload.status_text is not None:
        user.status_text = payload.status_text.strip()[:120] or None
    if payload.status_emoji is not None:
        user.status_emoji = payload.status_emoji.strip()[:8] or None
    if payload.pronouns is not None:
        user.pronouns = payload.pronouns.strip()[:40] or None
    if payload.banner_color is not None:
        color = payload.banner_color.strip()
        if color and not color.startswith("#"):
            color = f"#{color}"
        user.banner_color = color[:9] if color else None
    if payload.phone is not None:
        user.phone = payload.phone.strip() or None
    db.add(user)
    db.commit()
    return user


@router.post("/users/me/avatar", response_model=UserOut)
def upload_avatar(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files allowed")
    data = file.file.read()
    if len(data) > 12 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large (max 12 MB)")
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")
    user.avatar_file = save_upload(db, data, file.filename or "avatar", file.content_type or "image/jpeg")
    db.add(user)
    db.commit()
    return user


SHIELD_COST = 50


@router.post("/users/me/shields", response_model=UserOut)
def buy_shield(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Spend 50 points to buy a streak shield (protects a 1-day miss)."""
    if user.total_points < SHIELD_COST:
        raise HTTPException(
            status_code=400, detail=f"Need {SHIELD_COST} points for a streak shield"
        )
    user.total_points -= SHIELD_COST
    user.streak_shields = (user.streak_shields or 0) + 1
    db.add(user)
    db.commit()
    return user


@router.get("/users/search", response_model=list[UserSearchOut])
def search_users(
    q: str = "",
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(User).filter(User.id != user.id)
    if q.strip():
        like = f"%{q.strip()}%"
        query = query.filter(
            or_(
                User.display_name.ilike(like),
                User.username.ilike(like),
                User.email.ilike(like),
            )
        )
    users = query.order_by(User.display_name.asc()).limit(50).all()
    result = []
    for u in users:
        squad_name = None
        if u.squad_id is not None:
            s = db.get(Squad, u.squad_id)
            squad_name = s.name if s else None
        result.append(
            UserSearchOut(
                id=u.id,
                display_name=u.display_name,
                username=u.username,
                avatar=u.avatar,
                avatar_file=u.avatar_file,
                squad_name=squad_name,
            )
        )
    return result


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
            "avatar_file": m.avatar_file,
            "bio": m.bio,
            "total_points": m.total_points,
            "streak": m.streak,
            "is_admin": m.id == squad.admin_id,
            "status_text": m.status_text,
            "status_emoji": m.status_emoji,
            "pronouns": m.pronouns,
            "banner_color": m.banner_color,
            "online": is_online(m),
            "last_seen": m.last_seen,
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
