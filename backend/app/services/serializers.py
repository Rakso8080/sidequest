from __future__ import annotations

from typing import Dict, List, Optional

from sqlalchemy import func as sqlfunc
from sqlalchemy.orm import Session

from .. import models
from ..schemas import (
    BadgeOut,
    LeaderboardEntryOut,
    PunishmentOut,
    StatsOut,
    SubmissionOut,
    VoteOut,
)
from .levels import icon_for, level_for, title_for
from .settings import get_settings


def submission_out(
    db: Session, sub: models.Submission, viewer_id: int
) -> SubmissionOut:
    votes = (
        db.query(models.Vote)
        .filter(models.Vote.submission_id == sub.id)
        .order_by(models.Vote.created_at.asc())
        .all()
    )
    approve_count = sum(1 for v in votes if v.decision == "approve")
    reject_count = len(votes) - approve_count
    my_vote = next((v.decision for v in votes if v.voter_id == viewer_id), None)
    squad = sub.quest.squad
    settings = get_settings(squad)
    i_can_vote = (
        sub.status == "pending"
        and sub.user_id != viewer_id
        and viewer_id in {m.id for m in squad.members}
    )
    return SubmissionOut(
        id=sub.id,
        quest_id=sub.quest_id,
        quest_title=sub.quest.title,
        quest_points=sub.quest.points,
        quest_category=sub.quest.category,
        quest_proof_type=sub.quest.proof_type,
        user_id=sub.user_id,
        user_name=sub.user.display_name,
        user_avatar=sub.user.avatar,
        user_avatar_file=sub.user.avatar_file,
        status=sub.status,
        proof_text=sub.proof_text,
        proof_file=sub.proof_file,
        started_at=sub.started_at,
        submitted_at=sub.submitted_at,
        deadline=sub.deadline,
        resolved_at=sub.resolved_at,
        votes=[VoteOut.model_validate(v) for v in votes]
        if not settings.get("anonymous_votes")
        else [
            VoteOut(
                id=v.id,
                voter_id=v.voter_id if v.voter_id == viewer_id else -1,
                decision=v.decision,
                created_at=v.created_at,
            )
            for v in votes
        ],
        approve_count=approve_count,
        reject_count=reject_count,
        my_vote=my_vote,
        i_can_vote=i_can_vote,
        can_submit=sub.status == "in_progress",
    )


def punishment_out(p: models.Punishment) -> PunishmentOut:
    return PunishmentOut(
        id=p.id,
        user_id=p.user_id,
        user_name=p.user.display_name,
        user_avatar=p.user.avatar,
        user_avatar_file=p.user.avatar_file,
        description=p.description,
        status=p.status,
        due_date=p.due_date,
        created_at=p.created_at,
    )


def quest_counts(db: Session, squad_id: int) -> Dict[int, int]:
    rows = (
        db.query(
            models.Submission.user_id,
            models.Submission.status,
            sqlfunc.count(models.Submission.id),
        )
        .join(models.Quest)
        .filter(models.Quest.squad_id == squad_id)
        .group_by(models.Submission.user_id, models.Submission.status)
        .all()
    )
    counts: Dict[int, int] = {}
    for user_id, status, n in rows:
        counts[user_id] = counts.get(user_id, 0) + n
    return counts


def leaderboard(db: Session, squad: models.Squad) -> List[LeaderboardEntryOut]:
    counts = quest_counts(db, squad.id)
    members = [
        m
        for m in squad.members
        if m.squad_id == squad.id and m.id != squad.admin_id
    ]
    admin = next((m for m in squad.members if m.id == squad.admin_id), None)
    ordered = []
    if admin is not None:
        ordered.append(admin)
    ordered.extend(sorted(members, key=lambda m: (-m.total_points, -m.streak)))

    entries: List[LeaderboardEntryOut] = []
    prev_points = None
    for i, m in enumerate(ordered, start=1):
        rank = i if prev_points != m.total_points or i == 1 else entries[-1].rank
        entries.append(
            LeaderboardEntryOut(
                rank=rank,
                user_id=m.id,
                display_name=m.display_name,
                avatar=m.avatar,
                avatar_file=m.avatar_file,
                total_points=m.total_points,
                streak=m.streak,
                quests_completed=counts.get(m.id, 0),
                is_admin=m.id == squad.admin_id,
            )
        )
        prev_points = m.total_points
    return entries


def mvp(squad: models.Squad) -> Optional[models.User]:
    """Most Valuable Player: highest points this week, admin excluded."""
    members = [m for m in squad.members if m.squad_id == squad.id and m.id != squad.admin_id]
    if not members:
        return None
    return max(members, key=lambda m: (m.total_points, m.streak))


def compute_stats(db: Session, user: models.User, squad: models.Squad) -> StatsOut:
    base = db.query(models.Submission).filter(models.Submission.user_id == user.id)
    approved = base.filter(models.Submission.status == "approved").all()
    pending = base.filter(models.Submission.status.in_(["pending", "in_progress"])).count()
    rejected = base.filter(models.Submission.status.in_(["rejected", "expired"])).count()
    total = approved_count = len(approved)
    completion_rate = round(approved_count / (approved_count + rejected) * 100, 1) if (approved_count + rejected) else 0.0

    cat_counts: Dict[str, int] = {}
    for a in approved:
        cat_counts[a.quest.category] = cat_counts.get(a.quest.category, 0) + 1
    favorite = max(cat_counts, key=cat_counts.get) if cat_counts else None

    rank = 1
    for entry in leaderboard(db, squad):
        if entry.user_id == user.id:
            rank = entry.rank
            break

    badges: List[BadgeOut] = []
    badges.append(
        BadgeOut(
            key=f"level_{level_for(user.total_points)}",
            label=f"{title_for(user.total_points)}",
            icon=icon_for(user.total_points),
        )
    )
    if approved_count >= 1:
        badges.append(BadgeOut(key="first_quest", label="First quest", icon="🌱"))
    if approved_count >= 10:
        badges.append(BadgeOut(key="quest_10", label="10 quests done", icon="⚡"))
    if approved_count >= 25:
        badges.append(BadgeOut(key="quest_25", label="25 quests done", icon="🏆"))
    if user.streak >= 3:
        badges.append(BadgeOut(key="streak_3", label="3-quest streak", icon="🔥"))
    if user.streak >= 7:
        badges.append(BadgeOut(key="streak_7", label="7-quest streak", icon="🌋"))
    if favorite is not None and cat_counts[favorite] >= 5:
        badges.append(
            BadgeOut(
                key="cat_5",
                label=f"5× {favorite}",
                icon="🎯",
            )
        )
    if user.total_points >= 500:
        badges.append(BadgeOut(key="points_500", label="500 pts", icon="💎"))
    if not badges:
        badges.append(BadgeOut(key="rookie", label="Rookie", icon="🐣"))

    return StatsOut(
        total_points=user.total_points,
        streak=user.streak,
        quests_completed=approved_count,
        quests_pending=pending,
        quests_rejected=rejected,
        completion_rate=completion_rate,
        favorite_category=favorite,
        rank=rank,
        badges=badges,
    )


def pending_votes_for(db: Session, squad: models.Squad, user_id: int) -> List[SubmissionOut]:
    subs = (
        db.query(models.Submission)
        .join(models.Quest)
        .filter(
            models.Quest.squad_id == squad.id,
            models.Submission.status == "pending",
            models.Submission.user_id != user_id,
        )
        .all()
    )
    result = []
    for sub in subs:
        sync = sub
        if any(v.voter_id == user_id for v in sub.votes):
            continue
        result.append(submission_out(db, sub, user_id))
    return result
