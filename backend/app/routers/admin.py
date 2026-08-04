from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from ..config import ADMIN_PASSWORD
from ..database import get_db
from ..deps import get_current_user
from ..models import GlobalQuest, Squad, Submission, User
from ..schemas import AdminLoginIn, GlobalQuestIn, GlobalQuestOut
from ..security import create_admin_token, decode_admin_token

router = APIRouter(prefix="/admin", tags=["admin"])


def require_admin(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Admin auth required")
    token = authorization.removeprefix("Bearer ").strip()
    try:
        if not decode_admin_token(token):
            raise ValueError
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired admin token")
    return True


@router.post("/login")
def admin_login(payload: AdminLoginIn):
    if payload.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Wrong password")
    return {"token": create_admin_token()}


@router.get("/overview")
def admin_overview(
    _: bool = Depends(require_admin),
    db: Session = Depends(get_db),
):
    quests = db.query(GlobalQuest).order_by(GlobalQuest.category.asc(), GlobalQuest.points.asc()).all()
    users = db.query(User).order_by(User.created_at.desc()).limit(200).all()
    squads = db.query(Squad).order_by(Squad.created_at.desc()).limit(200).all()
    return {
        "quests": [GlobalQuestOut.model_validate(q) for q in quests],
        "users": [
            {
                "id": u.id,
                "display_name": u.display_name,
                "username": u.username,
                "email": u.email,
                "avatar": u.avatar,
                "avatar_file": u.avatar_file,
                "total_points": u.total_points,
                "streak": u.streak,
                "squad_id": u.squad_id,
                "created_at": u.created_at.isoformat(),
            }
            for u in users
        ],
        "squads": [
            {
                "id": s.id,
                "name": s.name,
                "invite_code": s.invite_code,
                "admin_id": s.admin_id,
                "member_count": len([m for m in s.members if m.squad_id == s.id]),
                "created_at": s.created_at.isoformat(),
            }
            for s in squads
        ],
    }


@router.post("/quests", response_model=GlobalQuestOut)
def add_quest(
    payload: GlobalQuestIn,
    _: bool = Depends(require_admin),
    db: Session = Depends(get_db),
):
    quest = GlobalQuest(**payload.model_dump())
    db.add(quest)
    db.commit()
    db.refresh(quest)
    return quest


@router.patch("/quests/{quest_id}", response_model=GlobalQuestOut)
def update_quest(
    quest_id: int,
    payload: GlobalQuestIn,
    _: bool = Depends(require_admin),
    db: Session = Depends(get_db),
):
    quest = db.get(GlobalQuest, quest_id)
    if quest is None:
        raise HTTPException(status_code=404, detail="Quest not found")
    for k, v in payload.model_dump().items():
        setattr(quest, k, v)
    db.commit()
    db.refresh(quest)
    return quest


@router.delete("/quests/{quest_id}")
def delete_quest(
    quest_id: int,
    _: bool = Depends(require_admin),
    db: Session = Depends(get_db),
):
    quest = db.get(GlobalQuest, quest_id)
    if quest is None:
        raise HTTPException(status_code=404, detail="Quest not found")
    db.delete(quest)
    db.commit()
    return {"ok": True}


@router.post("/quests/{quest_id}/push")
def push_quest_to_all(
    quest_id: int,
    _: bool = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Add one template quest to the board of every active squad."""
    template = db.get(GlobalQuest, quest_id)
    if template is None:
        raise HTTPException(status_code=404, detail="Quest not found")
    from ..models import Quest

    pushed = 0
    for squad in db.query(Squad).all():
        exists = (
            db.query(Quest)
            .filter(Quest.squad_id == squad.id, Quest.title == template.title)
            .first()
        )
        if exists:
            continue
        db.add(
            Quest(
                squad_id=squad.id,
                title=template.title,
                description=template.description,
                category=template.category,
                difficulty=template.difficulty,
                points=template.points,
                proof_type=template.proof_type,
                time_limit_hours=template.time_limit_hours,
            )
        )
        pushed += 1
    db.commit()
    return {"ok": True, "pushed": pushed}
