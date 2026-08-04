from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_user_squad, require_member
from ..models import Quest, Submission, UploadedFile, User

router = APIRouter(prefix="/recap", tags=["recap"])


class RecapItemOut(BaseModel):
    id: int
    title: str
    category: str
    points: int
    proof_file: str
    created_at: Optional[str] = None
    user_name: str
    user_avatar: str
    user_avatar_file: Optional[str] = None


class RecapOut(BaseModel):
    squad_name: str
    year: Optional[int] = None
    count: int
    items: List[RecapItemOut]


@router.get("", response_model=RecapOut)
def get_recap(
    year: Optional[int] = None,
    user: User = Depends(require_member),
    db: Session = Depends(get_db),
):
    """Approved photo/video memories, oldest first — the raw material for the
    yearly recap video and the in-app memories page."""
    squad = get_user_squad(db, user)
    q = (
        db.query(Submission)
        .join(Quest)
        .filter(
            Quest.squad_id == squad.id,
            Submission.status == "approved",
            Submission.proof_file.isnot(None),
            Submission.proof_file != "",
        )
    )
    if year is not None:
        q = q.filter(func.strftime("%Y", Submission.resolved_at) == str(year))
    subs = q.order_by(Submission.resolved_at.asc()).all()

    upload_ids = []
    for s in subs:
        if s.proof_file and s.proof_file.startswith("/uploads/"):
            try:
                upload_ids.append(int(s.proof_file.rsplit("/", 1)[-1]))
            except ValueError:
                pass
    content_types = {
        uf.id: uf.content_type
        for uf in db.query(UploadedFile).filter(UploadedFile.id.in_(upload_ids)).all()
    }

    items = []
    for s in subs:
        if not s.proof_file or not s.proof_file.startswith("/uploads/"):
            continue
        fid = int(s.proof_file.rsplit("/", 1)[-1])
        if not content_types.get(fid, "").startswith("image/"):
            continue  # montage is photo-based; skip video proofs
        items.append(
            RecapItemOut(
                id=s.id,
                title=s.quest.title,
                category=s.quest.category,
                points=s.quest.points,
                proof_file=s.proof_file,
                created_at=s.resolved_at.isoformat() if s.resolved_at else None,
                user_name=s.user.display_name,
                user_avatar=s.user.avatar,
                user_avatar_file=s.user.avatar_file,
            )
        )
    return RecapOut(
        squad_name=squad.name,
        year=year,
        count=len(items),
        items=items,
    )
