from __future__ import annotations

import os
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from ..database import UPLOAD_DIR, get_db
from ..deps import get_user_squad, require_member
from ..models import Notification, Submission, User
from ..schemas import SubmissionOut
from ..services.notifications import notify
from ..services.serializers import submission_out
from ..services.voting import sync_submission, utcnow

router = APIRouter(prefix="/submissions", tags=["submissions"])

ALLOWED_IMAGE = {"jpg", "jpeg", "png", "gif", "webp", "heic"}
ALLOWED_VIDEO = {"mp4", "mov", "webm", "m4v"}
MAX_UPLOAD_BYTES = 50 * 1024 * 1024


def _save_upload(file: UploadFile) -> str:
    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED_IMAGE and ext not in ALLOWED_VIDEO:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Upload a photo or video.",
        )
    content = file.file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="File too large (max 50 MB)")
    name = f"{uuid.uuid4().hex}.{ext}"
    with open(os.path.join(UPLOAD_DIR, name), "wb") as fh:
        fh.write(content)
    return f"/uploads/{name}"


@router.get("", response_model=List[SubmissionOut])
def list_submissions(
    status_filter: Optional[str] = None,
    mine: bool = False,
    user: User = Depends(require_member),
    db: Session = Depends(get_db),
):
    squad = get_user_squad(db, user)
    from ..models import Quest

    query = (
        db.query(Submission)
        .join(Quest)
        .filter(Quest.squad_id == squad.id)
        .order_by(Submission.submitted_at.desc().nullslast(), Submission.id.desc())
    )
    if mine:
        query = query.filter(Submission.user_id == user.id)
    if status_filter:
        query = query.filter(Submission.status == status_filter)
    subs = query.limit(200).all()
    for sub in subs:
        sync_submission(db, sub, squad)
    db.flush()
    return [submission_out(db, sub, user.id) for sub in subs]


@router.get("/pending-for-me", response_model=List[SubmissionOut])
def pending_for_me(
    user: User = Depends(require_member), db: Session = Depends(get_db)
):
    squad = get_user_squad(db, user)
    from ..models import Quest

    subs = (
        db.query(Submission)
        .join(Quest)
        .filter(
            Quest.squad_id == squad.id,
            Submission.status == "pending",
            Submission.user_id != user.id,
        )
        .all()
    )
    result = []
    for sub in subs:
        sync_submission(db, sub, squad)
        if sub.status != "pending":
            continue
        if any(v.voter_id == user.id for v in sub.votes):
            continue
        result.append(submission_out(db, sub, user.id))
    db.flush()
    return result


@router.post("/{submission_id}/submit", response_model=SubmissionOut)
async def submit_proof(
    submission_id: int,
    proof_text: str = Form(""),
    file: Optional[UploadFile] = File(None),
    user: User = Depends(require_member),
    db: Session = Depends(get_db),
):
    squad = get_user_squad(db, user)
    sub = db.get(Submission, submission_id)
    if sub is None or sub.user_id != user.id or sub.quest.squad_id != squad.id:
        raise HTTPException(status_code=404, detail="Submission not found")
    if sub.status != "in_progress":
        raise HTTPException(
            status_code=400, detail="This submission is not in progress"
        )
    if file is not None:
        sub.proof_file = _save_upload(file)
    sub.proof_text = proof_text.strip()
    if not sub.proof_file and not sub.proof_text:
        raise HTTPException(
            status_code=400, detail="Add a photo/video or a text description"
        )
    sub.status = "pending"
    sub.submitted_at = utcnow()
    db.flush()

    # Notify squad members that a submission needs their vote.
    for member in squad.members:
        if member.id == user.id:
            continue
        if member.squad_id != squad.id:
            continue
        notify(
            db,
            member.id,
            squad.id,
            "A quest needs your vote 🗳️",
            f"{user.display_name} submitted “{sub.quest.title}”",
            ntype="vote",
        )
    db.flush()
    return submission_out(db, sub, user.id)


@router.get("/{submission_id}", response_model=SubmissionOut)
def get_submission(
    submission_id: int,
    user: User = Depends(require_member),
    db: Session = Depends(get_db),
):
    squad = get_user_squad(db, user)
    sub = db.get(Submission, submission_id)
    if sub is None or sub.quest.squad_id != squad.id:
        raise HTTPException(status_code=404, detail="Submission not found")
    sync_submission(db, sub, squad)
    db.flush()
    return submission_out(db, sub, user.id)
