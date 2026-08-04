from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_user_squad, require_member
from ..models import User
from ..schemas import LeaderboardEntryOut
from ..services.serializers import leaderboard

router = APIRouter(prefix="/leaderboard", tags=["leaderboard"])


@router.get("", response_model=List[LeaderboardEntryOut])
def get_leaderboard(
    user: User = Depends(require_member), db: Session = Depends(get_db)
):
    squad = get_user_squad(db, user)
    return leaderboard(db, squad)
