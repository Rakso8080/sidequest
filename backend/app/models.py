from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    LargeBinary,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    return datetime.now()


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    username: Mapped[str] = mapped_column(String(60), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    display_name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    avatar: Mapped[str] = mapped_column(String(8), default="😎")
    avatar_file: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    bio: Mapped[str] = mapped_column(Text, default="")
    squad_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("squads.id", ondelete="SET NULL"), nullable=True, index=True
    )
    total_points: Mapped[int] = mapped_column(Integer, default=0)
    streak: Mapped[int] = mapped_column(Integer, default=0)
    last_streak_date: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    # Advanced profile fields (Discord/Telegram style)
    status_text: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    status_emoji: Mapped[Optional[str]] = mapped_column(String(8), nullable=True)
    pronouns: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    banner_color: Mapped[Optional[str]] = mapped_column(String(9), nullable=True)
    last_seen: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_read_id: Mapped[int] = mapped_column(Integer, default=0)
    streak_shields: Mapped[int] = mapped_column(Integer, default=0)

    squad: Mapped[Optional["Squad"]] = relationship(
        back_populates="members", foreign_keys=[squad_id]
    )


class Squad(Base):
    __tablename__ = "squads"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    invite_code: Mapped[str] = mapped_column(String(10), unique=True, index=True)
    admin_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    settings: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    members: Mapped[List["User"]] = relationship(
        back_populates="squad", foreign_keys="[User.squad_id]"
    )
    quests: Mapped[List["Quest"]] = relationship(
        back_populates="squad", cascade="all, delete-orphan"
    )


class Quest(Base):
    __tablename__ = "quests"

    id: Mapped[int] = mapped_column(primary_key=True)
    squad_id: Mapped[int] = mapped_column(
        ForeignKey("squads.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[str] = mapped_column(String(60), index=True)
    difficulty: Mapped[str] = mapped_column(String(20), default="medium")
    points: Mapped[int] = mapped_column(Integer, default=50)
    proof_type: Mapped[str] = mapped_column(String(20), default="photo")
    time_limit_hours: Mapped[int] = mapped_column(Integer, default=72)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    scheduled_for: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    squad_quest: Mapped[bool] = mapped_column(Boolean, default=False)
    created_by: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    squad: Mapped["Squad"] = relationship(back_populates="quests")
    submissions: Mapped[List["Submission"]] = relationship(
        back_populates="quest", cascade="all, delete-orphan"
    )


class GlobalQuest(Base):
    __tablename__ = "global_quests"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[str] = mapped_column(String(60), index=True)
    difficulty: Mapped[str] = mapped_column(String(20), default="medium")
    points: Mapped[int] = mapped_column(Integer, default=50)
    proof_type: Mapped[str] = mapped_column(String(20), default="photo")
    time_limit_hours: Mapped[int] = mapped_column(Integer, default=72)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class QuestProposal(Base):
    __tablename__ = "quest_proposals"

    id: Mapped[int] = mapped_column(primary_key=True)
    squad_id: Mapped[int] = mapped_column(
        ForeignKey("squads.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[str] = mapped_column(String(60))
    difficulty: Mapped[str] = mapped_column(String(20), default="medium")
    points: Mapped[int] = mapped_column(Integer, default=50)
    proof_type: Mapped[str] = mapped_column(String(20), default="photo")
    time_limit_hours: Mapped[int] = mapped_column(Integer, default=72)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending | approved | rejected
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    user: Mapped["User"] = relationship()


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    squad_id: Mapped[int] = mapped_column(
        ForeignKey("squads.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    recipient_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    reply_to_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("chat_messages.id"), nullable=True
    )
    sticker: Mapped[Optional[str]] = mapped_column(String(8), nullable=True)
    gif_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    gif_thumb: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    edited: Mapped[bool] = mapped_column(Boolean, default=False)
    pinned: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, server_default=func.now()
    )

    user: Mapped["User"] = relationship(foreign_keys=[user_id])
    reply_to: Mapped[Optional["ChatMessage"]] = relationship(
        foreign_keys=[reply_to_id], remote_side=[id]
    )
    reactions: Mapped[List["ChatReaction"]] = relationship(
        back_populates="message", cascade="all, delete-orphan"
    )


class ChatReaction(Base):
    __tablename__ = "chat_reactions"
    __table_args__ = (
        UniqueConstraint("message_id", "user_id", "emoji", name="uq_reaction"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    message_id: Mapped[int] = mapped_column(
        ForeignKey("chat_messages.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    emoji: Mapped[str] = mapped_column(String(16))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    message: Mapped["ChatMessage"] = relationship(back_populates="reactions")


class Submission(Base):
    __tablename__ = "submissions"

    id: Mapped[int] = mapped_column(primary_key=True)
    quest_id: Mapped[int] = mapped_column(
        ForeignKey("quests.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    status: Mapped[str] = mapped_column(
        String(20), default="in_progress", index=True
    )  # in_progress | pending | approved | rejected | expired
    proof_text: Mapped[str] = mapped_column(Text, default="")
    proof_file: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    deadline: Mapped[datetime] = mapped_column(DateTime)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    quest: Mapped["Quest"] = relationship(back_populates="submissions")
    user: Mapped["User"] = relationship()
    votes: Mapped[List["Vote"]] = relationship(
        back_populates="submission", cascade="all, delete-orphan"
    )


class Vote(Base):
    __tablename__ = "votes"
    __table_args__ = (
        UniqueConstraint("submission_id", "voter_id", name="uq_vote"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    submission_id: Mapped[int] = mapped_column(
        ForeignKey("submissions.id", ondelete="CASCADE"), index=True
    )
    voter_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    decision: Mapped[str] = mapped_column(String(10))  # approve | reject
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    submission: Mapped["Submission"] = relationship(back_populates="votes")


class Punishment(Base):
    __tablename__ = "punishments"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    squad_id: Mapped[int] = mapped_column(
        ForeignKey("squads.id", ondelete="CASCADE"), index=True
    )
    description: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(20), default="assigned")
    due_date: Mapped[datetime] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    user: Mapped["User"] = relationship()


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    squad_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("squads.id", ondelete="CASCADE"), nullable=True
    )
    type: Mapped[str] = mapped_column(String(30), default="info")
    title: Mapped[str] = mapped_column(String(160))
    body: Mapped[str] = mapped_column(Text, default="")
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, server_default=func.now()
    )


class UploadedFile(Base):
    """Photo/video proof stored in the database so it survives server
    restarts on hosts with no persistent disk (e.g. free-tier web apps)."""

    __tablename__ = "uploaded_files"

    id: Mapped[int] = mapped_column(primary_key=True)
    filename: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(120), default="application/octet-stream")
    size: Mapped[int] = mapped_column(Integer, default=0)
    data: Mapped[bytes] = mapped_column(LargeBinary)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, server_default=func.now()
    )


class PasswordReset(Base):
    """One-time code for resetting a forgotten password."""

    __tablename__ = "password_resets"

    id: Mapped[int] = mapped_column(primary_key=True)
    identifier: Mapped[str] = mapped_column(String(255), index=True)
    code_hash: Mapped[str] = mapped_column(String(255))
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class PushSubscription(Base):
    """A browser/phone's Web Push subscription for a user."""

    __tablename__ = "push_subscriptions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    endpoint: Mapped[str] = mapped_column(String(500), unique=True)
    p256dh: Mapped[str] = mapped_column(String(255))
    auth: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, server_default=func.now()
    )


class AppSetting(Base):
    """Tiny key/value store for app-generated secrets (e.g. VAPID keys)
    that must survive restarts even on an ephemeral filesystem."""

    __tablename__ = "app_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(60), unique=True)
    value: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
