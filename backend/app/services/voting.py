from __future__ import annotations

import math
import random
from datetime import datetime, timedelta
from typing import List, Optional

from sqlalchemy.orm import Session

from .. import models
from .notifications import notify
from .settings import get_settings


def utcnow() -> datetime:
    return datetime.now()


def _eligible_voters(squad: models.Squad, submitter_id: int) -> List[models.User]:
    return [m for m in squad.members if m.id != submitter_id]


def _decide(
    submission: models.Submission,
    votes: List[models.Vote],
    squad: models.Squad,
    settings: dict,
    eligible_count: int,
) -> Optional[str]:
    approves = sum(1 for v in votes if v.decision == "approve")
    rejects = len(votes) - approves
    remaining = max(0, eligible_count - len(votes))

    rule = settings.get("voting_rule")
    if rule == "unanimous":
        if eligible_count == 0:
            return "approved"
        if rejects > 0:
            return "rejected"
        if approves >= eligible_count:
            return "approved"
        return None
    if rule == "majority":
        need = eligible_count // 2 + 1
        if approves >= need:
            return "approved"
        if rejects >= need:
            return "rejected"
        return None
    # quorum
    need = math.ceil(eligible_count * int(settings.get("quorum_pct", 60)) / 100)
    if need <= 0:
        need = 1
    if approves >= need:
        return "approved"
    if approves + remaining < need:
        return "rejected"
    return None


def _today_str() -> str:
    return utcnow().date().isoformat()


def _award(db: Session, submission: models.Submission, squad: models.Squad) -> None:
    user = submission.user
    user.total_points += submission.quest.points
    # Daily streak: one approved quest per day keeps the flame alive.
    today = _today_str()
    if user.last_streak_date == today:
        pass  # already counted today
    elif user.last_streak_date == (utcnow().date() - timedelta(days=1)).isoformat():
        user.streak += 1
    else:
        user.streak = 1
    user.last_streak_date = today
    notify(
        db,
        user.id,
        squad.id,
        "Quest approved! 🎉",
        f"+{submission.quest.points} pts · “{submission.quest.title}”"
        + (f" · 🔥 {user.streak}-day streak" if user.streak > 1 else ""),
        ntype="success",
    )


def _punish(
    db: Session, submission: models.Submission, squad: models.Squad, reason: str
) -> None:
    settings = get_settings(squad)
    user = submission.user
    if (user.streak_shields or 0) > 0:
        # A shield absorbs the streak reset (but not the punishment itself).
        user.streak_shields = (user.streak_shields or 0) - 1
        notify(
            db,
            user.id,
            squad.id,
            "🛡️ Streak shield used",
            f"A shield protected your {user.streak}-day streak from resetting.",
            ntype="info",
        )
    else:
        user.streak = 0
        user.last_streak_date = None
    pool = settings.get("punishments") or ["Buy the group coffee"]
    description = random.choice(pool)
    due = utcnow() + timedelta(days=int(settings.get("punishment_due_days", 7)))
    db.add(
        models.Punishment(
            user_id=user.id,
            squad_id=squad.id,
            description=description,
            status="assigned",
            due_date=due,
        )
    )
    notify(
        db,
        user.id,
        squad.id,
        "Punishment assigned 😈",
        f"{reason} · {description} (due {due.strftime('%b %d')})",
        ntype="punishment",
    )


def _apply_outcome(
    db: Session,
    submission: models.Submission,
    outcome: str,
    squad: models.Squad,
) -> None:
    submission.status = outcome
    submission.resolved_at = utcnow()
    if outcome == "approved":
        _award(db, submission, squad)
    else:
        reason = "Rejected by the squad" if outcome == "rejected" else "Deadline missed"
        _punish(db, submission, squad, reason)
        # Squad quests: everyone must participate. Anyone who never submitted
        # loses a slice of points when a teammate's squad-quest expires.
        quest = submission.quest
        if quest.squad_quest and outcome == "expired":
            _penalize_idle_members(db, squad, quest, submission.user_id)


def _penalize_idle_members(
    db: Session, squad: models.Squad, quest: models.Quest, submitter_id: int
) -> None:
    """Idle squad members lose points when a squad quest expires without their
    participation. The submitter who missed the deadline is already punished."""
    participant_ids = {
        s.user_id
        for s in db.query(models.Submission)
        .filter(models.Submission.quest_id == quest.id)
        .all()
    }
    for m in squad.members:
        if m.squad_id != squad.id or m.id == submitter_id:
            continue
        if m.id in participant_ids:
            continue
        penalty = min(30, max(10, quest.points // 3))
        m.total_points = max(0, m.total_points - penalty)
        notify(
            db,
            m.id,
            squad.id,
            "Squad quest failed 😤",
            f"“{quest.title}” expired and you never submitted — lost {penalty} pts.",
            ntype="punishment",
        )
    db.flush()


def sync_submission(
    db: Session, submission: models.Submission, squad: models.Squad
) -> bool:
    """Advance a submission's lifecycle (expire / resolve voting). Returns True if changed."""
    settings = get_settings(squad)
    now = utcnow()

    if submission.status == "in_progress":
        if now > submission.deadline:
            _apply_outcome(db, submission, "expired", squad)
            db.flush()
            return True
        return False

    if submission.status != "pending":
        return False

    votes = (
        db.query(models.Vote)
        .filter(models.Vote.submission_id == submission.id)
        .all()
    )
    eligible_count = len(_eligible_voters(squad, submission.user_id))

    if eligible_count == 0:
        _apply_outcome(db, submission, "approved", squad)
        db.flush()
        return True

    outcome = _decide(submission, votes, squad, settings, eligible_count)
    if outcome is not None:
        _apply_outcome(db, submission, outcome, squad)
        db.flush()
        return True

    window_end = submission.submitted_at + timedelta(
        hours=int(settings.get("voting_hours", 24))
    )
    if now > window_end:
        approves = sum(1 for v in votes if v.decision == "approve")
        outcome = "approved" if approves > len(votes) - approves else "rejected"
        _apply_outcome(db, submission, outcome, squad)
        db.flush()
        return True

    return False


def votes_for(submission: models.Submission) -> List[models.Vote]:
    return list(submission.votes)


def user_has_voted(submission: models.Submission, user_id: int) -> bool:
    return any(v.voter_id == user_id for v in submission.votes)


def sync_all_pending(db: Session, squad: models.Squad) -> None:
    pending = (
        db.query(models.Submission)
        .join(models.Quest)
        .filter(
            models.Quest.squad_id == squad.id,
            models.Submission.status.in_(["pending", "in_progress"]),
        )
        .all()
    )
    for sub in pending:
        sync_submission(db, sub, squad)
    if pending:
        db.flush()
