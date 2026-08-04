from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_user_squad, require_member
from ..models import ChatMessage, User
from ..schemas import ChatIn, ChatMessageOut

router = APIRouter(prefix="/chat", tags=["chat"])


def _out(msg: ChatMessage) -> ChatMessageOut:
    return ChatMessageOut(
        id=msg.id,
        user_id=msg.user_id,
        user_name=msg.user.display_name,
        user_avatar=msg.user.avatar,
        text=msg.text,
        created_at=msg.created_at,
    )


@router.get("", response_model=List[ChatMessageOut])
def list_messages(
    after_id: Optional[int] = None,
    limit: int = 100,
    user: User = Depends(require_member),
    db: Session = Depends(get_db),
):
    squad = get_user_squad(db, user)
    query = db.query(ChatMessage).filter(ChatMessage.squad_id == squad.id)
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
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Message can't be empty")
    msg = ChatMessage(squad_id=squad.id, user_id=user.id, text=text)
    db.add(msg)
    db.flush()
    return _out(msg)
