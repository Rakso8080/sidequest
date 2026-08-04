from __future__ import annotations

import random
import struct
import zlib
from datetime import datetime, timedelta
from typing import Dict, List

from sqlalchemy.orm import Session

from .. import models
from ..security import hash_password
from .settings import DEFAULT_SETTINGS
from .storage import save_upload

DEFAULT_QUESTS: List[Dict] = [
    # Social / guts — the brutal ones
    {"title": "Ask for her Snap", "description": "Walk up to a girl you don't know and ask for her Snap. Screenshot the conversation as proof.", "category": "Social", "difficulty": "hard", "points": 100, "proof_type": "photo", "time_limit_hours": 72},
    {"title": "Ask someone out", "description": "Ask your crush out. The answer doesn't matter — screenshot it either way.", "category": "Social", "difficulty": "hard", "points": 100, "proof_type": "photo", "time_limit_hours": 72},
    {"title": "Rejection collection ×3", "description": "Get rejected 3 times on purpose. Ask strangers for absurd things and log every no.", "category": "Social", "difficulty": "hard", "points": 100, "proof_type": "photo", "time_limit_hours": 168},
    {"title": "Talk to 3 strangers", "description": "Have a real conversation with 3 strangers in one day. Start every one yourself.", "category": "Social", "difficulty": "hard", "points": 90, "proof_type": "photo", "time_limit_hours": 48},
    {"title": "Join a stranger group", "description": "Walk up to a group of strangers and join their conversation for 5 minutes.", "category": "Social", "difficulty": "hard", "points": 95, "proof_type": "self_report", "time_limit_hours": 72},
    {"title": "Send the bold DM", "description": "Send that DM you've been too scared to send. Screenshot it.", "category": "Social", "difficulty": "medium", "points": 70, "proof_type": "photo", "time_limit_hours": 48},
    {"title": "Dance-off vs a stranger", "description": "Challenge a stranger to a dance-off in public and record it.", "category": "Social", "difficulty": "hard", "points": 90, "proof_type": "video", "time_limit_hours": 72},
    {"title": "Compliment a stranger out loud", "description": "Give a stranger a genuine compliment, in public, out loud.", "category": "Social", "difficulty": "easy", "points": 40, "proof_type": "self_report", "time_limit_hours": 24},
    {"title": "Ask for a discount", "description": "Ask for a discount somewhere you'd never dare. Accept any outcome.", "category": "Social", "difficulty": "easy", "points": 40, "proof_type": "self_report", "time_limit_hours": 48},
    # Fitness / physical — the brutal ones
    {"title": "100 burpees", "description": "100 burpees in one session. Film it or it didn't happen.", "category": "Fitness", "difficulty": "hard", "points": 90, "proof_type": "video", "time_limit_hours": 48},
    {"title": "50 pushups straight", "description": "50 clean pushups without stopping, on camera.", "category": "Fitness", "difficulty": "hard", "points": 80, "proof_type": "video", "time_limit_hours": 48},
    {"title": "10k run", "description": "Run 10km. Log your time.", "category": "Fitness", "difficulty": "hard", "points": 90, "proof_type": "photo", "time_limit_hours": 72},
    {"title": "PR at the gym", "description": "Beat your personal best on squat, bench or deadlift. Photo of the bar.", "category": "Fitness", "difficulty": "medium", "points": 70, "proof_type": "photo", "time_limit_hours": 72},
    {"title": "20 pull-ups in a day", "description": "20 pull-ups before the day ends. Video proof.", "category": "Fitness", "difficulty": "hard", "points": 80, "proof_type": "video", "time_limit_hours": 24},
    {"title": "5 min plank", "description": "Hold a plank until you shake — minimum 5 minutes on camera.", "category": "Fitness", "difficulty": "hard", "points": 75, "proof_type": "video", "time_limit_hours": 72},
    {"title": "Handstand 30 seconds", "description": "Hold a handstand for 30 seconds, on camera.", "category": "Fitness", "difficulty": "hard", "points": 80, "proof_type": "video", "time_limit_hours": 72},
    {"title": "One-armed pushups", "description": "10 one-armed pushups. Video or it didn't happen.", "category": "Fitness", "difficulty": "hard", "points": 85, "proof_type": "video", "time_limit_hours": 72},
    {"title": "Sprint the steepest hill", "description": "Sprint up the steepest hill you can find. Photo of the view + time.", "category": "Fitness", "difficulty": "medium", "points": 65, "proof_type": "photo", "time_limit_hours": 72},
    {"title": "400m sprint", "description": "Sprint 400m and film the finish.", "category": "Fitness", "difficulty": "medium", "points": 60, "proof_type": "video", "time_limit_hours": 48},
    {"title": "Pushups every hour", "description": "10 pushups every hour for 12 straight hours. Photo-log each hour.", "category": "Fitness", "difficulty": "hard", "points": 85, "proof_type": "photo", "time_limit_hours": 24},
    {"title": "Flip a tractor tire", "description": "Flip a heavy tractor tire 10 times. Video.", "category": "Fitness", "difficulty": "hard", "points": 85, "proof_type": "video", "time_limit_hours": 72},
    {"title": "5 AM gym week", "description": "Train at 6 AM every day for a week. One photo per session.", "category": "Fitness", "difficulty": "hard", "points": 95, "proof_type": "photo", "time_limit_hours": 168},
    {"title": "Climbing gym", "description": "First time at a climbing gym, or send a route one grade above yours. Photo at the top.", "category": "Adventure", "difficulty": "medium", "points": 65, "proof_type": "photo", "time_limit_hours": 72},
    {"title": "Sleep outside", "description": "Camp out one night — tent or under the stars. Photo at night + morning.", "category": "Adventure", "difficulty": "medium", "points": 70, "proof_type": "photo", "time_limit_hours": 72},
    {"title": "Join a pickup game", "description": "Join a strangers' football or basketball pickup game. Photo/video.", "category": "Adventure", "difficulty": "medium", "points": 60, "proof_type": "photo", "time_limit_hours": 72},
    {"title": "Polar plunge", "description": "Jump into freezing water. Full send, video proof.", "category": "Wildcard", "difficulty": "hard", "points": 95, "proof_type": "video", "time_limit_hours": 72},
    {"title": "Ice bath 2 minutes", "description": "2 full minutes in an ice/cold bath. Screaming allowed. Video.", "category": "Fitness", "difficulty": "hard", "points": 85, "proof_type": "video", "time_limit_hours": 72},
    # Wildcard / performance — brutal
    {"title": "Do a flip", "description": "Front, back or side flip on camera.", "category": "Wildcard", "difficulty": "hard", "points": 90, "proof_type": "video", "time_limit_hours": 72},
    {"title": "Freestyle rap 60 seconds", "description": "60 seconds of freestyle rap, on video. No laughing.", "category": "Creativity", "difficulty": "hard", "points": 80, "proof_type": "video", "time_limit_hours": 72},
    {"title": "Scream in public", "description": "Scream at the top of your lungs in a public place, no context, on video.", "category": "Wildcard", "difficulty": "medium", "points": 50, "proof_type": "video", "time_limit_hours": 48},
    {"title": "Serenade someone", "description": "Sing a love song to someone at full volume, on camera.", "category": "Wildcard", "difficulty": "hard", "points": 90, "proof_type": "video", "time_limit_hours": 72},
    {"title": "Dance in public 1 minute", "description": "Full send public dancing for a full minute. Video.", "category": "Wildcard", "difficulty": "hard", "points": 75, "proof_type": "video", "time_limit_hours": 48},
    {"title": "Learn a TikTok dance", "description": "Learn and record a TikTok dance end to end without laughing.", "category": "Wildcard", "difficulty": "easy", "points": 40, "proof_type": "video", "time_limit_hours": 48},
    # Mind / discipline
    {"title": "Cold showers for a week", "description": "A cold shower every morning for 7 days. Log each one.", "category": "Mind/Skill", "difficulty": "hard", "points": 85, "proof_type": "self_report", "time_limit_hours": 168},
    {"title": "Wake up at 5 AM", "description": "Up at 5 AM and out of bed. Photo of the sunrise with timestamp.", "category": "Mind/Skill", "difficulty": "medium", "points": 55, "proof_type": "photo", "time_limit_hours": 48},
    {"title": "No sugar for 7 days", "description": "No candy, no soft drinks, no sugar for a full week.", "category": "Mind/Skill", "difficulty": "medium", "points": 60, "proof_type": "self_report", "time_limit_hours": 168},
    {"title": "Sell something to a stranger", "description": "Sell an item to someone you don't know. Hustle.", "category": "Mind/Skill", "difficulty": "hard", "points": 90, "proof_type": "photo", "time_limit_hours": 168},
    # Kindness
    {"title": "Help a stranger for real", "description": "Carry groceries, help jump-start a car, hold something heavy — genuinely help.", "category": "Kindness", "difficulty": "medium", "points": 50, "proof_type": "photo", "time_limit_hours": 48},
    {"title": "Buy a coffee for a stranger", "description": "Pay for a stranger's coffee and walk away without explaining.", "category": "Kindness", "difficulty": "easy", "points": 45, "proof_type": "photo", "time_limit_hours": 48},
]


def seed_global_quests(db: Session) -> None:
    """Populate the admin-managed challenge pool from the template list if empty."""
    if db.query(models.GlobalQuest).first() is not None:
        return
    for q in DEFAULT_QUESTS:
        db.add(models.GlobalQuest(**q))
    db.commit()
    print(f"Seeded {len(DEFAULT_QUESTS)} global quest templates")


def create_quests_from_templates(db: Session, squad: models.Squad) -> None:
    pool = db.query(models.GlobalQuest).all()
    templates = [q for q in pool] if pool else DEFAULT_QUESTS
    for q in templates:
        if hasattr(q, "id"):  # GlobalQuest ORM row
            db.add(
                models.Quest(
                    squad_id=squad.id,
                    is_active=True,
                    title=q.title,
                    description=q.description,
                    category=q.category,
                    difficulty=q.difficulty,
                    points=q.points,
                    proof_type=q.proof_type,
                    time_limit_hours=q.time_limit_hours,
                )
            )
        else:  # plain dict template
            db.add(models.Quest(squad_id=squad.id, is_active=True, **q))


def write_demo_png(path: str, width: int, height: int, rgb: tuple) -> bytes:
    """Build a tiny solid-color PNG so the demo has real photo proofs to show."""
    def chunk(typ: bytes, data: bytes) -> bytes:
        c = struct.pack(">I", len(data)) + typ + data
        c += struct.pack(">I", zlib.crc32(typ + data) & 0xFFFFFFFF)
        return c

    row = b"\x00" + bytes(rgb) * width
    raw = row * height
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    idat = zlib.compress(raw)
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


def generate_invite_code(db: Session) -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    for _ in range(50):
        code = "".join(random.choices(alphabet, k=6))
        exists = db.query(models.Squad).filter(models.Squad.invite_code == code).first()
        if not exists:
            return code
    return f"SQ{random.randint(10000, 99999)}"


def create_squad(
    db: Session, admin: models.User, name: str
) -> models.Squad:
    squad = models.Squad(
        name=name,
        admin_id=admin.id,
        invite_code=generate_invite_code(db),
        settings=dict(DEFAULT_SETTINGS),
    )
    db.add(squad)
    db.flush()
    admin.squad_id = squad.id
    create_quests_from_templates(db, squad)
    return squad


def seed_demo(db: Session) -> None:
    """Create a demo squad with sample activity if the DB is empty."""
    if db.query(models.Squad).first() is not None:
        return

    admin = models.User(
        email="demo@sidequest.app",
        username="demo",
        password_hash=hash_password("demo123"),
        display_name="Demo Boss",
        avatar="🦉",
        bio="Squad founder and quest master.",
    )
    db.add(admin)
    db.flush()
    squad = create_squad(db, admin, "Demo Crew")

    members = [
        ("alice@sidequest.app", "alice", "Alice", "🦊", "Runner and coffee lover."),
        ("bob@sidequest.app", "bob", "Bob", "🐻", "Will do anything for points."),
        ("carol@sidequest.app", "carol", "Carol", "🐸", "Chaos goblin with a camera."),
    ]
    users = []
    for email, uname, dname, avatar, bio in members:
        u = models.User(
            email=email,
            username=uname,
            password_hash=hash_password("demo123"),
            display_name=dname,
            avatar=avatar,
            bio=bio,
            squad_id=squad.id,
        )
        db.add(u)
        users.append(u)
    db.flush()

    all_users = [admin] + users
    quests = db.query(models.Quest).filter(models.Quest.squad_id == squad.id).all()
    rng = random.Random(42)
    demo_colors = [(139, 92, 246), (217, 70, 239), (16, 185, 129), (245, 158, 11), (14, 165, 233), (244, 63, 94)]

    # Give the demo crew some approved history for a lively leaderboard.
    photo_index = 0
    for user, n in ((users[0], 5), (users[1], 3), (users[2], 4), (admin, 2)):
        picked = rng.sample(quests, n)
        for i, q in enumerate(picked):
            created = datetime.now() - timedelta(days=10 - i)
            sub = models.Submission(
                quest_id=q.id,
                user_id=user.id,
                status="approved",
                proof_text=f"Completed “{q.title}” — proof captured on camera. 📸",
                started_at=created,
                submitted_at=created + timedelta(hours=3),
                deadline=created + timedelta(hours=q.time_limit_hours),
                resolved_at=created + timedelta(days=1),
            )
            if q.proof_type == "photo":
                fname = f"demo_photo_{photo_index}.png"
                sub.proof_file = save_upload(
                    db,
                    write_demo_png("", 640, 480, demo_colors[photo_index % len(demo_colors)]),
                    fname,
                    "image/png",
                )
                photo_index += 1
            db.add(sub)
            user.total_points += q.points
            user.streak += 1
    db.flush()

    # One submission pending votes.
    active_quest = next((q for q in quests if q.category == "Creativity"), quests[0])
    pending = models.Submission(
        quest_id=active_quest.id,
        user_id=users[2].id,
        status="pending",
        proof_text="Drew a portrait of the whole squad! It's abstract. Very abstract.",
        started_at=datetime.now() - timedelta(hours=5),
        submitted_at=datetime.now() - timedelta(hours=2),
        deadline=datetime.now() + timedelta(hours=19),
    )
    db.add(pending)
    db.flush()
    for voter in (admin, users[0]):
        db.add(
            models.Vote(
                submission_id=pending.id,
                voter_id=voter.id,
                decision="approve",
                created_at=datetime.now() - timedelta(minutes=90),
            )
        )

    # One in-progress quest for the demo user.
    fitness_quest = next((q for q in quests if q.category == "Fitness"), quests[1])
    db.add(
        models.Submission(
            quest_id=fitness_quest.id,
            user_id=admin.id,
            status="in_progress",
            started_at=datetime.now() - timedelta(hours=6),
            deadline=datetime.now() + timedelta(hours=18),
        )
    )

    # One assigned punishment.
    db.add(
        models.Punishment(
            user_id=users[1].id,
            squad_id=squad.id,
            description="Buy the group coffee",
            status="assigned",
            due_date=datetime.now() + timedelta(days=4),
        )
    )

    db.flush()
    print("Seeded demo squad 'Demo Crew' (logins: demo@sidequest.app / alice@ / bob@ / carol@ — password demo123)")
