from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_user_squad, require_member
from ..models import Notification, Submission, User
from ..schemas import DashboardOut, LeaderboardEntryOut, PunishmentOut, StatsOut
from ..services.serializers import (
    compute_stats,
    leaderboard,
    punishment_out,
    submission_out,
)
from ..services.voting import sync_submission, sync_all_pending

router = APIRouter(tags=["overview"])


@router.get("/dashboard", response_model=DashboardOut)
def dashboard(
    user: User = Depends(require_member), db: Session = Depends(get_db)
):
    squad = get_user_squad(db, user)
    sync_all_pending(db, squad)

    from ..models import Quest

    active_subs = (
        db.query(Submission)
        .join(Quest)
        .filter(
            Quest.squad_id == squad.id,
            Submission.user_id == user.id,
            Submission.status == "in_progress",
        )
        .order_by(Submission.deadline.asc())
        .all()
    )

    pending_subs = []
    for sub in (
        db.query(Submission)
        .join(Quest)
        .filter(
            Quest.squad_id == squad.id,
            Submission.status == "pending",
            Submission.user_id != user.id,
        )
        .all()
    ):
        if any(v.voter_id == user.id for v in sub.votes):
            continue
        pending_subs.append(sub)

    from ..models import Punishment

    my_puns = (
        db.query(Punishment)
        .filter(Punishment.user_id == user.id, Punishment.status != "completed")
        .order_by(Punishment.due_date.asc())
        .all()
    )
    from ..models import Notification

    unread = (
        db.query(Notification)
        .filter(Notification.user_id == user.id, Notification.read == False)  # noqa: E712
        .count()
    )

    stats = compute_stats(db, user, squad)
    board = leaderboard(db, squad)
    return DashboardOut(
        user=user,
        stats=stats,
        active_quests=[submission_out(db, s, user.id) for s in active_subs],
        pending_votes=[submission_out(db, s, user.id) for s in pending_subs],
        leaderboard=board[:5],
        my_punishments=[punishment_out(p) for p in my_puns],
        unread_notifications=unread,
    )


@router.get("/stats", response_model=StatsOut)
def stats(user: User = Depends(require_member), db: Session = Depends(get_db)):
    squad = get_user_squad(db, user)
    return compute_stats(db, user, squad)
