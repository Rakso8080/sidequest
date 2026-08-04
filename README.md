# SideQuest 🎮

A social accountability game for a private group of friends ("Squad"): complete
real-life quests, submit proof, get peer-voted, earn points, and face
lighthearted punishments when you fail. Mobile-first web app.

## Features

- **Accounts & Squads** — email/password auth, create a squad, join via invite code.
- **Quest board** — categorized quests (Fitness, Social, Creativity, Adventure,
  Mind/Skill, Kindness, Wildcard) with difficulty, point values, proof type and
  time limits. Admins add/remove quests.
- **Proof & voting** — submit photo/video/text proof, squad votes Approve/Reject
  (majority, unanimous, or quorum %, configurable). Anonymous voting option.
- **Points & punishments** — approved quests award points and build streaks;
  rejected/expired quests assign a random punishment from an admin-editable pool
  with a due date.
- **Leaderboard, stats, badges** — live rankings, streaks, completion rate,
  favorite category, achievements.
- **Notifications** — new submissions to vote on, vote results, punishments.
- **Admin tools** — manage categories, punishment pool, voting rules, invite code.

## Tech stack

- **Backend**: FastAPI + SQLAlchemy + SQLite (zero-config DB), JWT auth,
  local file uploads served at `/uploads`.
- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS, TanStack Query,
  Zustand, React Router.

## Quick start

You need Python 3.9+ and Node 18+.

### 1. Backend (terminal 1)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

The API runs at `http://localhost:8000` (docs at `/docs`). On first launch it
creates `app.db` and seeds a demo squad.

### 2. Frontend (terminal 2)

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The dev server proxies `/api` and `/uploads` to
the backend on `:8000`.

### Demo logins

| Account             | Password |
| ------------------- | -------- |
| demo@sidequest.app  | demo123  |
| alice@sidequest.app | demo123  |
| bob@sidequest.app   | demo123  |
| carol@sidequest.app | demo123  |

The demo squad has quests, votes, an in-progress quest, and a punishment ready
to play with. Create your own squad from the **Squad** tab to start fresh.

## Tests

```bash
cd backend
source .venv/bin/activate
python smoke_test.py   # end-to-end API test (register → join → quest → submit → vote → punish)
```

## Deployment notes

- The frontend expects the API at the same origin (`/api` → backend). In dev,
  Vite proxies it. In production, serve the built `frontend/dist` behind a
  reverse proxy that forwards `/api` and `/uploads` to the FastAPI process, or
  mount it via FastAPI static files.
- Set a strong `SECRET_KEY` env var for the backend in production.
- For real multi-user deployments, swap `DATABASE_URL` to Postgres (SQLAlchemy
  handles it). Photo/video uploads store to `backend/uploads` by default.
