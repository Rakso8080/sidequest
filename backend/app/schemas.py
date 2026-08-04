from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class RegisterIn(BaseModel):
    email: str
    username: str = Field(min_length=2, max_length=60)
    password: str = Field(min_length=6, max_length=128)
    display_name: str = Field(min_length=1, max_length=120)
    phone: Optional[str] = None
    invite_code: Optional[str] = None


class LoginIn(BaseModel):
    username_or_email: str
    password: str


class ForgotIn(BaseModel):
    identifier: str


class ResetIn(BaseModel):
    identifier: str
    code: str
    new_password: str = Field(min_length=6, max_length=128)


class UserOut(BaseModel):
    id: int
    email: str
    username: str
    display_name: str
    avatar: str
    avatar_file: Optional[str] = None
    bio: str
    phone: Optional[str] = None
    squad_id: Optional[int]
    total_points: int
    streak: int
    created_at: datetime
    status_text: Optional[str] = None
    status_emoji: Optional[str] = None
    pronouns: Optional[str] = None
    banner_color: Optional[str] = None
    streak_shields: int = 0

    class Config:
        from_attributes = True


class TokenOut(BaseModel):
    token: str
    user: UserOut


class UpdateProfileIn(BaseModel):
    display_name: Optional[str] = None
    username: Optional[str] = None
    avatar: Optional[str] = None
    bio: Optional[str] = None
    status_text: Optional[str] = None
    status_emoji: Optional[str] = None
    pronouns: Optional[str] = None
    banner_color: Optional[str] = None
    phone: Optional[str] = None


class PushSubscribeIn(BaseModel):
    endpoint: str
    p256dh: str
    auth: str


class CreateSquadIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class JoinSquadIn(BaseModel):
    invite_code: str


class SettingsOut(BaseModel):
    settings: Dict[str, Any]
    categories: List[str]
    punishments: List[str]


class UpdateSettingsIn(BaseModel):
    voting_rule: Optional[str] = None
    quorum_pct: Optional[int] = None
    voting_hours: Optional[int] = None
    anonymous_votes: Optional[bool] = None
    punishment_due_days: Optional[int] = None
    categories: Optional[List[str]] = None
    punishments: Optional[List[str]] = None


class MemberOut(BaseModel):
    id: int
    display_name: str
    username: str
    avatar: str
    avatar_file: Optional[str] = None
    bio: str
    total_points: int
    streak: int
    is_admin: bool
    status_text: Optional[str] = None
    status_emoji: Optional[str] = None
    pronouns: Optional[str] = None
    banner_color: Optional[str] = None
    online: bool = False
    last_seen: Optional[datetime] = None

    class Config:
        from_attributes = True


class SquadOut(BaseModel):
    id: int
    name: str
    invite_code: str
    admin_id: int
    settings: Dict[str, Any]
    members: List[MemberOut]


class QuestIn(BaseModel):
    title: str = Field(min_length=2, max_length=160)
    description: str = ""
    category: str = Field(min_length=1, max_length=60)
    difficulty: str = "medium"
    points: int = Field(ge=5, le=1000)
    proof_type: str = "photo"
    time_limit_hours: int = Field(ge=1, le=24 * 30)
    scheduled_for: Optional[datetime] = None
    squad_quest: bool = False


class QuestOut(BaseModel):
    id: int
    title: str
    description: str
    category: str
    difficulty: str
    points: int
    proof_type: str
    time_limit_hours: int
    is_active: bool
    scheduled_for: Optional[datetime] = None
    squad_quest: bool = False
    created_by: Optional[int] = None
    created_by_name: Optional[str] = None
    my_status: Optional[str] = None  # in_progress | pending | submitted/approved/etc


class QuestProposalIn(BaseModel):
    title: str = Field(min_length=2, max_length=160)
    description: str = ""
    category: str = Field(min_length=1, max_length=60)
    difficulty: str = "medium"
    points: int = Field(ge=5, le=500)
    proof_type: str = "photo"
    time_limit_hours: int = Field(ge=1, le=24 * 30)


class QuestProposalOut(BaseModel):
    id: int
    title: str
    description: str
    category: str
    difficulty: str
    points: int
    proof_type: str
    time_limit_hours: int
    status: str
    user_id: int
    user_name: str
    user_avatar: str
    created_at: datetime
    is_mine: bool


class SubmissionIn(BaseModel):
    proof_text: str = ""


class VoteIn(BaseModel):
    submission_id: int
    decision: str


class VoteOut(BaseModel):
    id: int
    voter_id: int
    decision: str
    created_at: datetime

    class Config:
        from_attributes = True


class SubmissionOut(BaseModel):
    id: int
    quest_id: int
    quest_title: str
    quest_points: int
    quest_category: str
    quest_proof_type: str
    user_id: int
    user_name: str
    user_avatar: str
    user_avatar_file: Optional[str] = None
    status: str
    proof_text: str
    proof_file: Optional[str]
    started_at: datetime
    submitted_at: Optional[datetime]
    deadline: datetime
    resolved_at: Optional[datetime]
    votes: List[VoteOut]
    approve_count: int
    reject_count: int
    my_vote: Optional[str]
    i_can_vote: bool
    can_submit: bool


class PunishmentOut(BaseModel):
    id: int
    user_id: int
    user_name: str
    user_avatar: str
    user_avatar_file: Optional[str] = None
    description: str
    status: str
    due_date: datetime
    created_at: datetime


class NotificationOut(BaseModel):
    id: int
    type: str
    title: str
    body: str
    read: bool
    created_at: datetime


class ChatReactionOut(BaseModel):
    emoji: str
    users: List[int]
    count: int
    mine: bool


class ChatMessageOut(BaseModel):
    id: int
    user_id: int
    user_name: str
    user_avatar: str
    user_avatar_file: Optional[str] = None
    recipient_id: Optional[int] = None
    reply_to_id: Optional[int] = None
    reply_snippet: Optional[str] = None
    reply_user_name: Optional[str] = None
    text: Optional[str] = None
    sticker: Optional[str] = None
    gif_url: Optional[str] = None
    gif_thumb: Optional[str] = None
    edited: bool = False
    pinned: bool = False
    reactions: List[ChatReactionOut] = []
    created_at: datetime


class ChatIn(BaseModel):
    text: Optional[str] = Field(default=None, max_length=2000)
    sticker: Optional[str] = Field(default=None, max_length=8)
    recipient_id: Optional[int] = None
    reply_to_id: Optional[int] = None
    gif_url: Optional[str] = Field(default=None, max_length=500)
    gif_thumb: Optional[str] = Field(default=None, max_length=500)


class ChatEditIn(BaseModel):
    text: Optional[str] = Field(default=None, max_length=2000)


class ChatReactIn(BaseModel):
    emoji: str = Field(min_length=1, max_length=16)


class GifOut(BaseModel):
    url: str
    thumb: str
    width: int = 0
    height: int = 0


class LeaderboardEntryOut(BaseModel):
    rank: int
    user_id: int
    display_name: str
    avatar: str
    avatar_file: Optional[str] = None
    total_points: int
    streak: int
    quests_completed: int
    is_admin: bool


class UserSearchOut(BaseModel):
    id: int
    display_name: str
    username: str
    avatar: str
    avatar_file: Optional[str] = None
    squad_name: Optional[str] = None


class GlobalQuestOut(BaseModel):
    id: int
    title: str
    description: str
    category: str
    difficulty: str
    points: int
    proof_type: str
    time_limit_hours: int

    class Config:
        from_attributes = True


class GlobalQuestIn(BaseModel):
    title: str = Field(min_length=2, max_length=160)
    description: str = ""
    category: str = Field(min_length=1, max_length=60)
    difficulty: str = "medium"
    points: int = Field(ge=5, le=1000)
    proof_type: str = "photo"
    time_limit_hours: int = Field(ge=1, le=24 * 30)


class AdminLoginIn(BaseModel):
    password: str


class AdminAdjustPointsIn(BaseModel):
    points: int = Field(ge=-10000, le=10000)


class AdminOut(BaseModel):
    token: str
    quests: List[GlobalQuestOut]
    users: List[dict]
    squads: List[dict]


class BadgeOut(BaseModel):
    key: str
    label: str
    icon: str


class StatsOut(BaseModel):
    total_points: int
    streak: int
    quests_completed: int
    quests_pending: int
    quests_rejected: int
    completion_rate: float
    favorite_category: Optional[str]
    rank: int
    badges: List[BadgeOut]


class DashboardOut(BaseModel):
    user: UserOut
    stats: StatsOut
    active_quests: List[SubmissionOut]
    pending_votes: List[SubmissionOut]
    leaderboard: List[LeaderboardEntryOut]
    my_punishments: List[PunishmentOut]
    unread_notifications: int
