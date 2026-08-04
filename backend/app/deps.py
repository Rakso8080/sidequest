from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .database import get_db
from .models import Squad, User
from .security import decode_token

bearer_scheme = HTTPBearer(auto_error=False)

ONLINE_WINDOW = timedelta(seconds=120)


def is_online(user: User) -> bool:
    if user.last_seen is None:
        return False
    ls = user.last_seen
    if ls.tzinfo is None:
        ls = ls.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) - ls < ONLINE_WINDOW


def touch_presence(db: Session, user: User) -> None:
    """Throttled last-seen bump so presence polling doesn't hammer the DB."""
    if user.last_seen is None or datetime.now(timezone.utc) - _utc(user.last_seen) > timedelta(seconds=30):
        user.last_seen = datetime.now(timezone.utc)
        db.flush()


def _utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
        )
    try:
        user_id = decode_token(credentials.credentials)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        )
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        )
    touch_presence(db, user)
    return user


def require_member(user: User = Depends(get_current_user)) -> User:
    if user.squad_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must join a squad first",
        )
    return user


def get_user_squad(db: Session, user: User) -> Squad:
    squad = db.get(Squad, user.squad_id)
    if squad is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Squad not found"
        )
    return squad


def require_admin(user: User = Depends(require_member)) -> User:
    from .models import Squad

    if user.squad is None or user.squad.admin_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the squad admin can do this",
        )
    return user
