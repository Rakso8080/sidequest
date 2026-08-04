from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_user_squad, is_online, require_member
from ..models import ChatMessage, ChatReaction, User
from ..schemas import (
    ChatEditIn,
    ChatIn,
    ChatMessageOut,
    ChatReactIn,
    GifOut,
)
from ..services.giphy import fetch_gifs

router = APIRouter(prefix="/chat", tags=["chat"])

STICKERS = [
    "🔥", "💀", "🥵", "🤡", "😭", "😂", "🥳", "💪", "🍕", "⚡",
    "😈", "🫡", "🤝", "🦈", "🫠", "🤯", "😤", "🙏", "🚀", "🎯",
    "😎", "🤌", "🫡", "💯",
]

REACTION_EMOJIS = ["👍", "😂", "🔥", "❤️", "😮", "😢", "🙏", "💯"]


def _utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _reactions_out(msg: ChatMessage, me: int) -> list:
    grouped: dict[str, dict] = {}
    for r in msg.reactions:
        g = grouped.setdefault(r.emoji, {"emoji": r.emoji, "users": [], "count": 0, "mine": False})
        g["users"].append(r.user_id)
        g["count"] += 1
        if r.user_id == me:
            g["mine"] = True
    return list(grouped.values())


def _out(msg: ChatMessage, me: int) -> ChatMessageOut:
    reply_snippet = None
    reply_user_name = None
    if msg.reply_to_id is not None and msg.reply_to is not None:
        r = msg.reply_to
        if r.text:
            reply_snippet = r.text[:90]
        elif r.sticker:
            reply_snippet = f"Sticker {r.sticker}"
        elif r.gif_url:
            reply_snippet = "GIF"
        else:
            reply_snippet = "…"
        reply_user_name = r.user.display_name if r.user else None
    return ChatMessageOut(
        id=msg.id,
        user_id=msg.user_id,
        user_name=msg.user.display_name,
        user_avatar=msg.user.avatar,
        user_avatar_file=msg.user.avatar_file,
        recipient_id=msg.recipient_id,
        reply_to_id=msg.reply_to_id,
        reply_snippet=reply_snippet,
        reply_user_name=reply_user_name,
        text=msg.text,
        sticker=msg.sticker,
        gif_url=msg.gif_url,
        gif_thumb=msg.gif_thumb,
        edited=msg.edited,
        pinned=msg.pinned,
        reactions=_reactions_out(msg, me),
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


def _load_reactions(db: Session, messages: List[ChatMessage]) -> None:
    ids = [m.id for m in messages]
    if not ids:
        return
    reacts = (
        db.query(ChatReaction)
        .filter(ChatReaction.message_id.in_(ids))
        .order_by(ChatReaction.message_id)
        .all()
    )
    by_msg: dict[int, list] = {}
    for r in reacts:
        by_msg.setdefault(r.message_id, []).append(r)
    for m in messages:
        m.reactions = by_msg.get(m.id, [])


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
    _load_reactions(db, messages)
    return [_out(m, user.id) for m in messages]


@router.get("/pinned", response_model=List[ChatMessageOut])
def pinned_messages(
    user: User = Depends(require_member), db: Session = Depends(get_db)
):
    squad = get_user_squad(db, user)
    messages = (
        db.query(ChatMessage)
        .filter(
            ChatMessage.squad_id == squad.id,
            ChatMessage.recipient_id.is_(None),
            ChatMessage.pinned.is_(True),
        )
        .order_by(ChatMessage.id.desc())
        .limit(10)
        .all()
    )
    _load_reactions(db, messages)
    return [_out(m, user.id) for m in messages]


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
    if not text and not sticker and not payload.gif_url:
        raise HTTPException(status_code=400, detail="Message can't be empty")
    recipient_id = None
    if payload.recipient_id is not None:
        recipient = db.query(User).filter(User.id == payload.recipient_id).first()
        if recipient is None or recipient.id == user.id:
            raise HTTPException(status_code=400, detail="Invalid recipient")
        recipient_id = recipient.id
    reply_to_id = None
    if payload.reply_to_id is not None:
        reply = db.get(ChatMessage, payload.reply_to_id)
        if reply is None or reply.squad_id != squad.id:
            raise HTTPException(status_code=400, detail="Invalid reply target")
        reply_to_id = reply.id
    msg = ChatMessage(
        squad_id=squad.id,
        user_id=user.id,
        recipient_id=recipient_id,
        reply_to_id=reply_to_id,
        text=text or None,
        sticker=sticker or None,
        gif_url=payload.gif_url,
        gif_thumb=payload.gif_thumb,
        created_at=datetime.now(timezone.utc),
    )
    db.add(msg)
    db.flush()
    db.refresh(msg)
    db.commit()
    return _out(msg, user.id)


@router.patch("/{message_id}", response_model=ChatMessageOut)
def edit_message(
    message_id: int,
    payload: ChatEditIn,
    user: User = Depends(require_member),
    db: Session = Depends(get_db),
):
    squad = get_user_squad(db, user)
    msg = db.get(ChatMessage, message_id)
    if msg is None or msg.squad_id != squad.id:
        raise HTTPException(status_code=404, detail="Message not found")
    if msg.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not your message")
    if msg.text is None and not msg.sticker:
        raise HTTPException(status_code=400, detail="Can't edit this message")
    text = (payload.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Message can't be empty")
    msg.text = text
    msg.edited = True
    db.commit()
    return _out(msg, user.id)


@router.delete("/{message_id}", status_code=200)
def delete_message(
    message_id: int,
    user: User = Depends(require_member),
    db: Session = Depends(get_db),
):
    squad = get_user_squad(db, user)
    msg = db.get(ChatMessage, message_id)
    if msg is None or msg.squad_id != squad.id:
        raise HTTPException(status_code=404, detail="Message not found")
    if msg.user_id != user.id and squad.admin_id != user.id:
        raise HTTPException(status_code=403, detail="Only the author or admin can delete")
    db.delete(msg)
    db.commit()
    return {"ok": True}


@router.post("/{message_id}/react", response_model=ChatMessageOut)
def react(
    message_id: int,
    payload: ChatReactIn,
    user: User = Depends(require_member),
    db: Session = Depends(get_db),
):
    squad = get_user_squad(db, user)
    msg = db.get(ChatMessage, message_id)
    if msg is None or msg.squad_id != squad.id:
        raise HTTPException(status_code=404, detail="Message not found")
    if payload.emoji not in REACTION_EMOJIS:
        raise HTTPException(status_code=400, detail="Unknown reaction")
    existing = (
        db.query(ChatReaction)
        .filter(
            ChatReaction.message_id == msg.id,
            ChatReaction.user_id == user.id,
            ChatReaction.emoji == payload.emoji,
        )
        .first()
    )
    if existing:
        db.delete(existing)
    else:
        db.add(ChatReaction(message_id=msg.id, user_id=user.id, emoji=payload.emoji))
    db.commit()
    _load_reactions(db, [msg])
    return _out(msg, user.id)


@router.post("/{message_id}/pin", response_model=ChatMessageOut)
def toggle_pin(
    message_id: int,
    user: User = Depends(require_member),
    db: Session = Depends(get_db),
):
    squad = get_user_squad(db, user)
    if squad.admin_id != user.id:
        raise HTTPException(status_code=403, detail="Only the squad admin can pin")
    msg = db.get(ChatMessage, message_id)
    if msg is None or msg.squad_id != squad.id:
        raise HTTPException(status_code=404, detail="Message not found")
    msg.pinned = not msg.pinned
    db.commit()
    _load_reactions(db, [msg])
    return _out(msg, user.id)


@router.post("/read", status_code=200)
def mark_read(
    last_read_id: int,
    user: User = Depends(require_member),
    db: Session = Depends(get_db),
):
    user.last_read_id = max(user.last_read_id, last_read_id)
    db.commit()
    return {"ok": True}


@router.get("/presence", status_code=200)
def presence(
    user: User = Depends(require_member),
    db: Session = Depends(get_db),
):
    squad = get_user_squad(db, user)
    members = db.query(User).filter(User.squad_id == squad.id).all()
    return [
        {
            "user_id": m.id,
            "display_name": m.display_name,
            "avatar": m.avatar,
            "avatar_file": m.avatar_file,
            "online": is_online(m),
            "last_seen": _utc(m.last_seen) if m.last_seen else None,
            "last_read_id": m.last_read_id,
        }
        for m in members
    ]


@router.get("/gifs", response_model=List[GifOut])
def gif_search(
    q: str = "",
    user: User = Depends(require_member),
):
    try:
        return fetch_gifs(q, limit=24)
    except HTTPException:
        raise
    except Exception:
        return []
