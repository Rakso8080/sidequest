from __future__ import annotations

from datetime import timedelta, timezone
from typing import Dict, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_user_squad, require_admin, require_member
from ..models import Quest, QuestProposal, Submission, User
from ..schemas import QuestIn, QuestOut, QuestProposalIn, QuestProposalOut
from ..services.notifications import notify
from ..services.settings import VALID_DIFFICULTIES, VALID_PROOF_TYPES, get_settings
from ..services.voting import sync_submission, utcnow

router = APIRouter(prefix="/quests", tags=["quests"])


def _quest_out(db: Session, quest: Quest, user: User) -> QuestOut:
    my = (
        db.query(Submission)
        .filter(Submission.quest_id == quest.id, Submission.user_id == user.id)
        .order_by(Submission.started_at.desc())
        .first()
    )
    creator = db.get(User, quest.created_by) if quest.created_by else None
    return QuestOut(
        id=quest.id,
        title=quest.title,
        description=quest.description,
        category=quest.category,
        difficulty=quest.difficulty,
        points=quest.points,
        proof_type=quest.proof_type,
        time_limit_hours=quest.time_limit_hours,
        is_active=quest.is_active,
        scheduled_for=quest.scheduled_for,
        squad_quest=quest.squad_quest,
        created_by=quest.created_by,
        created_by_name=creator.display_name if creator else None,
        my_status=my.status if my else None,
    )


def _validate_quest_fields(payload, settings) -> None:
    if payload.category not in settings.get("categories", []):
        raise HTTPException(
            status_code=400,
            detail=f"Category must be one of: {', '.join(settings.get('categories', []))}",
        )
    if payload.difficulty not in VALID_DIFFICULTIES:
        raise HTTPException(status_code=400, detail="Invalid difficulty")
    if payload.proof_type not in VALID_PROOF_TYPES:
        raise HTTPException(status_code=400, detail="Invalid proof type")


def _notify_mentions(db, squad, actor: User, title: str, description: str) -> None:
    """Find @username mentions in the text and ping those squad members."""
    import re

    handles = set(re.findall(r"@([a-zA-Z0-9_]{2,60})", f"{title} {description}"))
    if not handles:
        return
    members = {
        m.username: m for m in squad.members if m.squad_id == squad.id and m.id != actor.id
    }
    for h in handles:
        target = members.get(h.lower())
        if target is None:
            continue
        notify(
            db,
            target.id,
            squad.id,
            "You've been mentioned 📣",
            f"{actor.display_name} mentioned you in “{title}”.",
            ntype="mention",
        )


@router.get("", response_model=List[QuestOut])
def list_quests(
    user: User = Depends(require_member),
    db: Session = Depends(get_db),
):
    squad = get_user_squad(db, user)
    quests = (
        db.query(Quest)
        .filter(Quest.squad_id == squad.id, Quest.is_active == True)  # noqa: E712
        .all()
    )
    return [_quest_out(db, q, user) for q in quests]


class QuestStartIn(BaseModel):
    quest_id: int


@router.post("/start", response_model=QuestOut)
def start_quest(
    payload: QuestStartIn,
    user: User = Depends(require_member),
    db: Session = Depends(get_db),
):
    squad = get_user_squad(db, user)
    quest = db.get(Quest, payload.quest_id)
    if quest is None or quest.squad_id != squad.id or not quest.is_active:
        raise HTTPException(status_code=404, detail="Quest not found")
    if quest.scheduled_for is not None and quest.scheduled_for > utcnow():
        raise HTTPException(
            status_code=400,
            detail="This quest isn't available yet — wait for its start date.",
        )

    active = (
        db.query(Submission)
        .filter(
            Submission.quest_id == quest.id,
            Submission.user_id == user.id,
            Submission.status.in_(["in_progress", "pending"]),
        )
        .first()
    )
    if active is not None:
        raise HTTPException(
            status_code=400, detail="You already have this quest in progress"
        )

    sub = Submission(
        quest_id=quest.id,
        user_id=user.id,
        status="in_progress",
        deadline=utcnow() + timedelta(hours=quest.time_limit_hours),
    )
    db.add(sub)
    db.flush()
    return _quest_out(db, quest, user)


@router.post("/plan", response_model=QuestOut)
def plan_quest(
    payload: QuestIn,
    user: User = Depends(require_member),
    db: Session = Depends(get_db),
):
    squad = get_user_squad(db, user)
    settings = get_settings(squad)
    _validate_quest_fields(payload, settings)
    if payload.scheduled_for is None:
        raise HTTPException(
            status_code=400, detail="Planned quests need a start date"
        )
    # Normalize to naive UTC so we can compare with utcnow().
    sched = payload.scheduled_for
    if sched.tzinfo is not None:
        sched = sched.astimezone(timezone.utc).replace(tzinfo=None)
    if sched <= utcnow():
        raise HTTPException(
            status_code=400, detail="Pick a date in the future"
        )
    quest = Quest(
        squad_id=squad.id,
        is_active=True,
        created_by=user.id,
        scheduled_for=sched,
        **{k: v for k, v in payload.model_dump().items() if k != "scheduled_for"},
    )
    db.add(quest)
    db.flush()
    _notify_mentions(db, squad, user, quest.title, quest.description)
    for member in squad.members:
        if member.squad_id == squad.id and member.id != user.id:
            notify(
                db,
                member.id,
                squad.id,
                "A quest is planned 🗓️",
                f"{user.display_name} planned “{quest.title}” for "
                f"{quest.scheduled_for.strftime('%b %d')}.",
                ntype="info",
            )
    db.flush()
    return _quest_out(db, quest, user)


@router.post("", response_model=QuestOut)
def create_quest(
    payload: QuestIn,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    squad = get_user_squad(db, admin)
    settings = get_settings(squad)
    _validate_quest_fields(payload, settings)
    quest = Quest(squad_id=squad.id, is_active=True, created_by=admin.id, **payload.model_dump())
    db.add(quest)
    db.flush()
    _notify_mentions(db, squad, admin, quest.title, quest.description)
    db.flush()
    return _quest_out(db, quest, admin)


@router.patch("/{quest_id}", response_model=QuestOut)
def update_quest(
    quest_id: int,
    payload: QuestIn,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    squad = get_user_squad(db, admin)
    quest = db.get(Quest, quest_id)
    if quest is None or quest.squad_id != squad.id:
        raise HTTPException(status_code=404, detail="Quest not found")
    for k, v in payload.model_dump().items():
        setattr(quest, k, v)
    db.flush()
    return _quest_out(db, quest, admin)


@router.delete("/{quest_id}")
def delete_quest(
    quest_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    squad = get_user_squad(db, admin)
    quest = db.get(Quest, quest_id)
    if quest is None or quest.squad_id != squad.id:
        raise HTTPException(status_code=404, detail="Quest not found")
    db.delete(quest)
    db.flush()
    return {"ok": True}


@router.get("/categories")
def categories(
    user: User = Depends(require_member),
    db: Session = Depends(get_db),
):
    squad = get_user_squad(db, user)
    return {"categories": get_settings(squad).get("categories", [])}


@router.get("/daily")
def daily_quest(
    user: User = Depends(require_member), db: Session = Depends(get_db)
):
    """Deterministic 'Quest of the Day' for the squad, seeded by date so
    everyone sees the same challenge on the same day."""
    from datetime import date

    import hashlib

    from ..models import GlobalQuest

    squad = get_user_squad(db, user)
    templates = db.query(GlobalQuest).all()
    if not templates:
        raise HTTPException(status_code=404, detail="No quest templates")
    seed = int(hashlib.sha256(f"{squad.id}:{date.today().isoformat()}".encode()).hexdigest(), 16)
    q = templates[seed % len(templates)]
    return {
        "id": q.id,
        "title": q.title,
        "description": q.description,
        "category": q.category,
        "difficulty": q.difficulty,
        "points": q.points,
        "proof_type": q.proof_type,
        "date": date.today().isoformat(),
    }


def _proposal_out(proposal: QuestProposal, viewer_id: int) -> QuestProposalOut:
    return QuestProposalOut(
        id=proposal.id,
        title=proposal.title,
        description=proposal.description,
        category=proposal.category,
        difficulty=proposal.difficulty,
        points=proposal.points,
        proof_type=proposal.proof_type,
        time_limit_hours=proposal.time_limit_hours,
        status=proposal.status,
        user_id=proposal.user_id,
        user_name=proposal.user.display_name,
        user_avatar=proposal.user.avatar,
        created_at=proposal.created_at,
        is_mine=proposal.user_id == viewer_id,
    )


@router.post("/propose", response_model=QuestProposalOut)
def propose_quest(
    payload: QuestProposalIn,
    user: User = Depends(require_member),
    db: Session = Depends(get_db),
):
    squad = get_user_squad(db, user)
    settings = get_settings(squad)
    _validate_quest_fields(payload, settings)

    proposal = QuestProposal(
        squad_id=squad.id,
        user_id=user.id,
        status="pending",
        **payload.model_dump(),
    )
    db.add(proposal)
    db.flush()

    admin = db.get(User, squad.admin_id)
    if admin is not None:
        notify(
            db,
            admin.id,
            squad.id,
            "New quest proposal 📬",
            f"{user.display_name} suggests “{proposal.title}” (+{proposal.points} pts)",
            ntype="proposal",
        )
    _notify_mentions(db, squad, user, proposal.title, proposal.description)
    db.flush()
    return _proposal_out(proposal, user.id)


@router.get("/proposals", response_model=List[QuestProposalOut])
def list_proposals(
    user: User = Depends(require_member),
    db: Session = Depends(get_db),
):
    squad = get_user_squad(db, user)
    proposals = (
        db.query(QuestProposal)
        .filter(QuestProposal.squad_id == squad.id)
        .order_by(QuestProposal.created_at.desc())
        .limit(50)
        .all()
    )
    return [_proposal_out(p, user.id) for p in proposals]


@router.post("/proposals/{proposal_id}/approve", response_model=QuestProposalOut)
def approve_proposal(
    proposal_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    squad = get_user_squad(db, admin)
    proposal = db.get(QuestProposal, proposal_id)
    if proposal is None or proposal.squad_id != squad.id:
        raise HTTPException(status_code=404, detail="Proposal not found")
    if proposal.status != "pending":
        raise HTTPException(status_code=400, detail="Proposal already handled")

    proposal.status = "approved"
    quest = Quest(
        squad_id=squad.id,
        title=proposal.title,
        description=proposal.description,
        category=proposal.category,
        difficulty=proposal.difficulty,
        points=proposal.points,
        proof_type=proposal.proof_type,
        time_limit_hours=proposal.time_limit_hours,
        is_active=True,
    )
    db.add(quest)
    proposer = db.get(User, proposal.user_id)
    if proposer is not None:
        notify(
            db,
            proposer.id,
            squad.id,
            "Your quest made the board! 🎉",
            f"“{proposal.title}” was approved by {admin.display_name}.",
            ntype="success",
        )
    db.flush()
    return _proposal_out(proposal, admin.id)


@router.post("/proposals/{proposal_id}/reject", response_model=QuestProposalOut)
def reject_proposal(
    proposal_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    squad = get_user_squad(db, admin)
    proposal = db.get(QuestProposal, proposal_id)
    if proposal is None or proposal.squad_id != squad.id:
        raise HTTPException(status_code=404, detail="Proposal not found")
    if proposal.status != "pending":
        raise HTTPException(status_code=400, detail="Proposal already handled")

    proposal.status = "rejected"
    proposer = db.get(User, proposal.user_id)
    if proposer is not None:
        notify(
            db,
            proposer.id,
            squad.id,
            "Quest proposal declined 💔",
            f"“{proposal.title}” didn't make the cut this time.",
            ntype="info",
        )
    db.flush()
    return _proposal_out(proposal, admin.id)
