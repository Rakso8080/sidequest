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
    {"title": "Morning run 5k", "description": "Run 5km before noon and log your time.", "category": "Fitness", "difficulty": "medium", "points": 60, "proof_type": "photo", "time_limit_hours": 24},
    {"title": "100 pushups in a day", "description": "Accumulate 100 pushups over the day.", "category": "Fitness", "difficulty": "hard", "points": 80, "proof_type": "video", "time_limit_hours": 24},
    {"title": "Gym session + photo", "description": "Do a full workout and snap the post-sweat pic.", "category": "Fitness", "difficulty": "easy", "points": 40, "proof_type": "photo", "time_limit_hours": 48},
    {"title": "Cold shower challenge", "description": "A full cold shower. Optional screaming.", "category": "Fitness", "difficulty": "easy", "points": 30, "proof_type": "text", "time_limit_hours": 24},
    {"title": "Dinner with a friend", "description": "Catch up with someone you haven't seen in a month+.", "category": "Social", "difficulty": "easy", "points": 40, "proof_type": "photo", "time_limit_hours": 168},
    {"title": "Invite the squad for game night", "description": "Host a game or movie night for the group.", "category": "Social", "difficulty": "medium", "points": 70, "proof_type": "photo", "time_limit_hours": 168},
    {"title": "Call a family member", "description": "Call someone in your family you've neglected.", "category": "Social", "difficulty": "easy", "points": 30, "proof_type": "self_report", "time_limit_hours": 48},
    {"title": "Draw something for a squadmate", "description": "Draw or paint something for another member.", "category": "Creativity", "difficulty": "medium", "points": 50, "proof_type": "photo", "time_limit_hours": 72},
    {"title": "Write a short story", "description": "Write a 300-word story. Any genre.", "category": "Creativity", "difficulty": "medium", "points": 55, "proof_type": "text", "time_limit_hours": 72},
    {"title": "Learn a magic trick", "description": "Learn and record a magic trick for the squad.", "category": "Creativity", "difficulty": "hard", "points": 75, "proof_type": "video", "time_limit_hours": 168},
    {"title": "Explore a new neighborhood", "description": "Go somewhere you've never been and document it.", "category": "Adventure", "difficulty": "medium", "points": 60, "proof_type": "photo", "time_limit_hours": 168},
    {"title": "Sunrise hike", "description": "Catch the sunrise from a viewpoint.", "category": "Adventure", "difficulty": "hard", "points": 90, "proof_type": "photo", "time_limit_hours": 72},
    {"title": "Read 30 pages", "description": "Read 30 pages of a book, share your favorite line.", "category": "Mind/Skill", "difficulty": "easy", "points": 35, "proof_type": "text", "time_limit_hours": 72},
    {"title": "Learn 20 new words", "description": "Learn 20 words of a new language, teach the squad one.", "category": "Mind/Skill", "difficulty": "medium", "points": 45, "proof_type": "text", "time_limit_hours": 72},
    {"title": "Meditate 7 days", "description": "Meditate at least 10 minutes daily for a week.", "category": "Mind/Skill", "difficulty": "hard", "points": 85, "proof_type": "self_report", "time_limit_hours": 168},
    {"title": "Do a random act of kindness", "description": "Do something kind for a stranger, document it.", "category": "Kindness", "difficulty": "easy", "points": 45, "proof_type": "photo", "time_limit_hours": 48},
    {"title": "Volunteer for an afternoon", "description": "Volunteer somewhere local for 2+ hours.", "category": "Kindness", "difficulty": "hard", "points": 100, "proof_type": "photo", "time_limit_hours": 168},
    {"title": "Say hi to a stranger", "description": "Have a real conversation with a stranger.", "category": "Kindness", "difficulty": "easy", "points": 25, "proof_type": "self_report", "time_limit_hours": 24},
    {"title": "Eat something weird", "description": "Try a food you've never dared to eat.", "category": "Wildcard", "difficulty": "medium", "points": 50, "proof_type": "photo", "time_limit_hours": 72},
    {"title": "24h digital detox", "description": "No screens for 24 hours. Painful but glorious.", "category": "Wildcard", "difficulty": "hard", "points": 95, "proof_type": "self_report", "time_limit_hours": 168},
    {"title": "Dance like nobody's watching", "description": "Film 30s of your best (worst) dancing.", "category": "Wildcard", "difficulty": "easy", "points": 30, "proof_type": "video", "time_limit_hours": 24},
]


def create_quests_from_templates(db: Session, squad: models.Squad) -> None:
    for q in DEFAULT_QUESTS:
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
