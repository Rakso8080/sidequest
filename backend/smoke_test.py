from __future__ import annotations

import io
import os
import pathlib
import sys

os.environ["DATABASE_URL"] = "sqlite:///./test_smoke.db"

# Fresh DB each run so the suite is re-runnable.
pathlib.Path("./test_smoke.db").unlink(missing_ok=True)

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


def register(client, username: str, email: str, name: str):
    r = client.post(
        "/auth/register",
        json={
            "email": email,
            "username": username,
            "password": "secret123",
            "display_name": name,
        },
    )
    assert r.status_code == 200, r.text
    return r.json()


def auth(token: str):
    return {"Authorization": f"Bearer {token}"}


def test_full_flow(client: TestClient):
    # Demo seed present
    r = client.get("/health")
    assert r.status_code == 200

    # Login as demo admin
    r = client.post(
        "/auth/login", json={"username_or_email": "demo@sidequest.app", "password": "demo123"}
    )
    assert r.status_code == 200, r.text
    admin = r.json()
    admin_h = auth(admin["token"])
    assert admin["user"]["squad_id"] is not None

    # Squad info
    r = client.get("/squads/me", headers=admin_h)
    assert r.status_code == 200, r.text
    squad = r.json()
    assert len(squad["members"]) == 4
    assert len(squad["settings"]["categories"]) >= 5
    invite = squad["invite_code"]

    # Register fresh members and join via invite code
    members = []
    for i in range(2):
        u = register(client, f"member{i}", f"member{i}@test.dev", f"Member {i}")
        r = client.post(
            "/squads/join", json={"invite_code": invite}, headers=auth(u["token"])
        )
        assert r.status_code == 200, r.text
        members.append(u)

    # Create a quest as admin
    r = client.post(
        "/quests",
        json={
            "title": "Smoke test quest",
            "description": "Test",
            "category": "Fitness",
            "difficulty": "easy",
            "points": 30,
            "proof_type": "photo",
            "time_limit_hours": 72,
        },
        headers=admin_h,
    )
    assert r.status_code == 200, r.text
    quest = r.json()
    assert quest["id"]

    # Member starts quest
    m0 = members[0]
    r = client.post(
        "/quests/start", json={"quest_id": quest["id"]}, headers=auth(m0["token"])
    )
    assert r.status_code == 200, r.text

    # Member submits text proof
    r = client.get("/submissions?mine=true", headers=auth(m0["token"]))
    sub = r.json()[0]
    assert sub["status"] == "in_progress"
    assert sub["can_submit"] is True
    r = client.post(
        f"/submissions/{sub['id']}/submit",
        data={"proof_text": "Done it! Trust me."},
        headers=auth(m0["token"]),
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "pending"

    # Member can't vote on own
    r = client.post(
        "/votes",
        json={"submission_id": sub["id"], "decision": "approve"},
        headers=auth(m0["token"]),
    )
    assert r.status_code == 400

    # Others vote approve -> majority (3/5 eligible) approved
    r = client.post(
        "/votes",
        json={"submission_id": sub["id"], "decision": "approve"},
        headers=auth(members[1]["token"]),
    )
    assert r.status_code == 200, r.text
    r = client.post(
        "/votes",
        json={"submission_id": sub["id"], "decision": "approve"},
        headers=admin_h,
    )
    assert r.status_code == 200, r.text
    alice = client.post(
        "/auth/login", json={"username_or_email": "alice@sidequest.app", "password": "demo123"}
    ).json()
    r = client.post(
        "/votes",
        json={"submission_id": sub["id"], "decision": "approve"},
        headers=auth(alice["token"]),
    )
    assert r.status_code == 200, r.text
    approved = r.json()
    assert approved["status"] == "approved"

    # Points awarded
    r = client.get("/users/me", headers=auth(m0["token"]))
    assert r.json()["total_points"] == 30
    assert r.json()["streak"] == 1

    # Leaderboard reflects it
    r = client.get("/leaderboard", headers=admin_h)
    lb = r.json()
    assert lb[0]["rank"] == 1

    # A rejected vote path: new quest, submit, both reject
    r = client.post(
        "/quests",
        json={
            "title": "Will fail quest",
            "description": "x",
            "category": "Wildcard",
            "difficulty": "hard",
            "points": 90,
            "proof_type": "text",
            "time_limit_hours": 24,
        },
        headers=admin_h,
    )
    q2 = r.json()
    r = client.post("/quests/start", json={"quest_id": q2["id"]}, headers=auth(m0["token"]))
    r = client.get("/submissions?mine=true", headers=auth(m0["token"]))
    sub2 = next(s for s in r.json() if s["quest_id"] == q2["id"])
    client.post(
        f"/submissions/{sub2['id']}/submit",
        data={"proof_text": "Meh"},
        headers=auth(m0["token"]),
    )
    for tok in (auth(members[1]["token"]), admin_h, auth(alice["token"])):
        client.post(
            "/votes",
            json={"submission_id": sub2["id"], "decision": "reject"},
            headers=tok,
        )
    r = client.get(f"/submissions/{sub2['id']}", headers=auth(m0["token"]))
    assert r.json()["status"] == "rejected"

    # Punishment assigned, streak reset
    r = client.get("/punishments/mine", headers=auth(m0["token"]))
    assert any(p["status"] == "assigned" for p in r.json())
    r = client.get("/users/me", headers=auth(m0["token"]))
    assert r.json()["streak"] == 0

    # Dashboard works
    r = client.get("/dashboard", headers=admin_h)
    assert r.status_code == 200
    body = r.json()
    assert "leaderboard" in body
    assert body["stats"]["rank"] >= 1

    # Settings update (admin)
    r = client.patch(
        "/squads/me/settings",
        json={"voting_rule": "unanimous", "voting_hours": 48},
        headers=admin_h,
    )
    assert r.status_code == 200, r.text
    assert r.json()["settings"]["voting_rule"] == "unanimous"

    # Non-admin cannot change settings
    r = client.patch(
        "/squads/me/settings",
        json={"voting_rule": "majority"},
        headers=auth(members[0]["token"]),
    )
    assert r.status_code == 403

    # Notifications present for the punished member
    r = client.get("/notifications", headers=auth(m0["token"]))
    assert len(r.json()) >= 1

    # --- Quest proposals ---
    r = client.post(
        "/quests/propose",
        json={
            "title": "My custom challenge",
            "description": "Custom quest from a member.",
            "category": "Creativity",
            "difficulty": "medium",
            "points": 55,
            "proof_type": "text",
            "time_limit_hours": 48,
        },
        headers=auth(m0["token"]),
    )
    assert r.status_code == 200, r.text
    proposal = r.json()
    assert proposal["status"] == "pending"
    assert proposal["is_mine"] is True

    # Admin sees it; member sees only own
    r = client.get("/quests/proposals", headers=admin_h)
    pending = [p for p in r.json() if p["status"] == "pending"]
    assert any(p["id"] == proposal["id"] for p in pending)

    # Member cannot approve
    r = client.post(
        f"/quests/proposals/{proposal['id']}/approve", headers=auth(m0["token"])
    )
    assert r.status_code == 403

    # Admin approves -> quest created
    r = client.post(
        f"/quests/proposals/{proposal['id']}/approve", headers=admin_h
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "approved"
    r = client.get("/quests", headers=admin_h)
    assert any(q["title"] == "My custom challenge" for q in r.json())

    # Reject path
    r = client.post(
        "/quests/propose",
        json={
            "title": "Bad idea",
            "description": "Nope.",
            "category": "Wildcard",
            "difficulty": "hard",
            "points": 99,
            "proof_type": "self_report",
            "time_limit_hours": 24,
        },
        headers=auth(m0["token"]),
    )
    bad = r.json()
    r = client.post(f"/quests/proposals/{bad['id']}/reject", headers=admin_h)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "rejected"

    # Proposer got notifications
    r = client.get("/notifications", headers=auth(m0["token"]))
    titles = [n["title"] for n in r.json()]
    assert any("approved" in t.lower() or "made the board" in t for t in titles)
    assert any("declined" in t.lower() or "didn't make" in t for t in titles)

    # --- Group chat ---
    r = client.post("/chat", json={"text": "Let's crush this week!"}, headers=auth(m0["token"]))
    assert r.status_code == 200, r.text
    assert r.json()["text"] == "Let's crush this week!"
    r = client.get("/chat", headers=auth(members[1]["token"]))
    msgs = r.json()
    assert len(msgs) >= 1
    assert any(m["text"] == "Let's crush this week!" for m in msgs)
    # after_id paging
    r = client.get(f"/chat?after_id={msgs[-1]['id']}", headers=admin_h)
    assert r.json() == []

    # --- Planned quests ---
    from datetime import datetime, timedelta, timezone

    future = (datetime.now() + timedelta(days=3)).isoformat()
    r = client.post(
        "/quests/plan",
        json={
            "title": "Weekend beach run",
            "description": "Group run on Saturday.",
            "category": "Fitness",
            "difficulty": "medium",
            "points": 50,
            "proof_type": "photo",
            "time_limit_hours": 72,
            "scheduled_for": future,
        },
        headers=auth(m0["token"]),
    )
    assert r.status_code == 200, r.text
    planned = r.json()
    assert planned["scheduled_for"] is not None
    assert planned["created_by_name"] is not None

    # TZ-aware ISO string (what the frontend sends) must be accepted
    r = client.post(
        "/quests/plan",
        json={
            "title": "TZ aware plan",
            "description": "x",
            "category": "Wildcard",
            "difficulty": "easy",
            "points": 20,
            "proof_type": "text",
            "time_limit_hours": 24,
            "scheduled_for": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        },
        headers=auth(m0["token"]),
    )
    assert r.status_code == 200, r.text

    # Not startable yet
    r = client.post("/quests/start", json={"quest_id": planned["id"]}, headers=auth(m0["token"]))
    assert r.status_code == 400

    # A plan with a past date becomes startable (admin schedules it)
    past = (datetime.now() - timedelta(minutes=5)).isoformat()
    r = client.post(
        "/quests",
        json={
            "title": "Already due plan",
            "description": "x",
            "category": "Wildcard",
            "difficulty": "easy",
            "points": 20,
            "proof_type": "text",
            "time_limit_hours": 24,
            "scheduled_for": past,
        },
        headers=admin_h,
    )
    due = r.json()
    r = client.post("/quests/start", json={"quest_id": due["id"]}, headers=auth(m0["token"]))
    assert r.status_code == 200, r.text

    # --- Daily streak semantics ---
    from app.database import SessionLocal
    from app.models import User

    bob_h = auth(client.post("/auth/login", json={"username_or_email": "bob@sidequest.app", "password": "demo123"}).json()["token"])
    carol_h = auth(client.post("/auth/login", json={"username_or_email": "carol@sidequest.app", "password": "demo123"}).json()["token"])

    def approve_next(client, token, admin_h, title):
        r = client.post(
            "/quests",
            json={
                "title": title,
                "description": "x",
                "category": "Wildcard",
                "difficulty": "easy",
                "points": 20,
                "proof_type": "text",
                "time_limit_hours": 24,
            },
            headers=admin_h,
        )
        q = r.json()
        client.post("/quests/start", json={"quest_id": q["id"]}, headers=auth(token))
        subs = client.get("/submissions?mine=true", headers=auth(token)).json()
        sub = next(s for s in subs if s["quest_id"] == q["id"])
        client.post(
            f"/submissions/{sub['id']}/submit",
            data={"proof_text": "done!"},
            headers=auth(token),
        )
        for tok in (auth(members[1]["token"]), admin_h, auth(alice["token"]), bob_h, carol_h):
            client.post(
                "/votes",
                json={"submission_id": sub["id"], "decision": "approve"},
                headers=tok,
            )
        r = client.get(f"/submissions/{sub['id']}", headers=auth(token))
        assert r.json()["status"] == "approved", r.text

    # Streak reset by the punishment above → first approval since reset is day 1
    approve_next(client, m0["token"], admin_h, "Streak day one")
    assert client.get("/users/me", headers=auth(m0["token"])).json()["streak"] == 1

    # Second approval the same day keeps the streak at 1
    approve_next(client, m0["token"], admin_h, "Streak same day")
    assert client.get("/users/me", headers=auth(m0["token"])).json()["streak"] == 1

    # A completion on a new day bumps it to 2
    db = SessionLocal()
    u = db.query(User).filter(User.id == m0["user"]["id"]).one()
    u.last_streak_date = (datetime.now() - timedelta(days=1)).date().isoformat()
    db.commit()
    db.close()
    approve_next(client, m0["token"], admin_h, "Streak day two")
    assert client.get("/users/me", headers=auth(m0["token"])).json()["streak"] == 2

    # --- Recap (photo memories) ---
    r = client.post(
        "/quests",
        json={
            "title": "Photo memory quest",
            "description": "x",
            "category": "Creativity",
            "difficulty": "easy",
            "points": 15,
            "proof_type": "photo",
            "time_limit_hours": 24,
        },
        headers=admin_h,
    )
    qr = r.json()
    client.post("/quests/start", json={"quest_id": qr["id"]}, headers=auth(m0["token"]))
    subs = client.get("/submissions?mine=true", headers=auth(m0["token"])).json()
    subp = next(s for s in subs if s["quest_id"] == qr["id"])
    png = io.BytesIO(b"\x89PNG\r\n\x1a\n" + b"\x00" * 64)
    client.post(
        f"/submissions/{subp['id']}/submit",
        data={"proof_text": "pic!"},
        files={"file": ("photo.png", png, "image/png")},
        headers=auth(m0["token"]),
    )
    for tok in (auth(members[1]["token"]), admin_h, auth(alice["token"]), bob_h, carol_h):
        client.post(
            "/votes",
            json={"submission_id": subp["id"], "decision": "approve"},
            headers=tok,
        )
    r = client.get(f"/submissions/{subp['id']}", headers=auth(m0["token"]))
    assert r.json()["status"] == "approved"
    r = client.get("/recap", headers=admin_h)
    assert r.status_code == 200, r.text
    assert r.json()["count"] >= 1
    assert any(i["title"] == "Photo memory quest" for i in r.json()["items"])

    # --- Rate limiting ---
    code = None
    for _ in range(11):
        r = client.post(
            "/auth/login",
            json={"username_or_email": "member0", "password": "wrong"},
        )
        code = r.status_code
    assert code == 429

    print("ALL SMOKE TESTS PASSED")


if __name__ == "__main__":
    with TestClient(app) as client:
        test_full_flow(client)
