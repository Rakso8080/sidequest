from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_user_squad, require_member
from ..models import Submission, User, Vote
from ..schemas import SubmissionOut, VoteIn
from ..services.serializers import submission_out
from ..services.voting import sync_submission

router = APIRouter(prefix="/votes", tags=["votes"])


@router.post("", response_model=SubmissionOut)
def cast_vote(
    payload: VoteIn,
    user: User = Depends(require_member),
    db: Session = Depends(get_db),
):
    squad = get_user_squad(db, user)
    if payload.decision not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="Decision must be approve/reject")

    sub = db.get(Submission, payload.submission_id)
    if sub is None or sub.quest.squad_id != squad.id:
        raise HTTPException(status_code=404, detail="Submission not found")
    if sub.user_id == user.id:
        raise HTTPException(status_code=400, detail="You can't vote on your own quest")
    sync_submission(db, sub, squad)
    if sub.status != "pending":
        raise HTTPException(status_code=400, detail="Voting is closed for this submission")

    existing = (
        db.query(Vote)
        .filter(
            Vote.submission_id == sub.id,
            Vote.voter_id == user.id,
        )
        .first()
    )
    if existing is not None:
        existing.decision = payload.decision
        db.flush()
    else:
        db.add(Vote(submission_id=sub.id, voter_id=user.id, decision=payload.decision))
        db.flush()

    sync_submission(db, sub, squad)
    db.flush()
    return submission_out(db, sub, user.id)
