from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_user_squad, require_member
from ..models import ChatMessage, User
from ..schemas import ChatIn, ChatMessageOut

router = APIRouter(prefix="/chat", tags=["chat"])

STICKERS = [
    "🔥", "💀", "🥵", "🤡", "😭", "😂", "🥳", "💪", "🍕", "⚡",
    "😈", "🫡", "🤝", "🦈", "🫠", "🤯", "😤", "🙏", "🚀", "🎯",
    "😎", "🤌", "🫡", "💯",
]


def _utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _out(msg: ChatMessage) -> ChatMessageOut:
    return ChatMessageOut(
        id=msg.id,
        user_id=msg.user_id,
        user_name=msg.user.display_name,
        user_avatar=msg.user.avatar,
        user_avatar_file=msg.user.avatar_file,
        recipient_id=msg.recipient_id,
        text=msg.text,
        sticker=msg.sticker,
        created_at=_utc(msg.created_at),
    )


def _dm_filter(db: Session, me: User, other: int) -> list:
    return (
        db.query(ChatMessage)
        .filter(
            and_(
                ChatMessage.recipient_id.isnot(None),
                or_(
                    and_(ChatMessage.user_id == me.id, ChatMessage.recipient_id == other),
                    and_(ChatMessage.user_id == other, ChatMessage.recipient_id == me.id),
                ),
            )
        )
        .all()
    )


@router.get("", response_model=List[ChatMessageOut])
def list_messages(
    after_id: Optional[int] = None,
    limit: int = 100,
    with_user: Optional[int] = None,
    user: User = Depends(require_member),
    db: Session = Depends(get_db),
):
    squad = get_user_squad(db, user)
    if with_user is not None:
        messages = _dm_filter(db, user, with_user)
    else:
        query = db.query(ChatMessage).filter(
            ChatMessage.squad_id == squad.id, ChatMessage.recipient_id.is_(None)
        )
        if after_id:
            query = query.filter(ChatMessage.id > after_id)
        query = query.order_by(ChatMessage.id.desc()).limit(max(1, min(limit, 500)))
        messages = sorted(query.all(), key=lambda m: m.id)
    return [_out(m) for m in messages]


@router.post("", response_model=ChatMessageOut)
def send_message(
    payload: ChatIn,
    user: User = Depends(require_member),
    db: Session = Depends(get_db),
):
    squad = get_user_squad(db, user)
    text = (payload.text or "").strip()
    sticker = payload.sticker or ""
    if sticker and sticker not in STICKERS:
        raise HTTPException(status_code=400, detail="Unknown sticker")
    if not text and not sticker:
        raise HTTPException(status_code=400, detail="Message can't be empty")
    recipient_id = None
    if payload.recipient_id is not None:
        recipient = db.query(User).filter(User.id == payload.recipient_id).first()
        if recipient is None or recipient.id == user.id:
            raise HTTPException(status_code=400, detail="Invalid recipient")
        recipient_id = recipient.id
    msg = ChatMessage(
        squad_id=squad.id,
        user_id=user.id,
        recipient_id=recipient_id,
        text=text or None,
        sticker=sticker or None,
        created_at=datetime.now(timezone.utc),
    )
    db.add(msg)
    db.flush()
    db.commit()
    return _out(msg)
