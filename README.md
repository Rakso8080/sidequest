# SideQuest 🎮

A social accountability game for a private group of friends ("Squad"): complete
real-life quests, submit proof, get peer-voted, earn points, and face
lighthearted punishments when you fail. Mobile-first web app.

## Features

- **Accounts & Squads** — email/password auth, create a squad, join via invite code.
- **Quest board** — categorized quests (Fitness, Social, Creativity, Adventure,
  Mind/Skill, Kindness, Wildcard) with difficulty, point values, proof type and
  time limits. Admins add/remove quests.
- **Your own quests** — any member can **propose** a custom quest; the admin
  approves or declines it. Approved proposals land on the board.
- **Plan quests ahead** — any member can schedule a quest for a future date; it
  appears as "Planned" on the board and unlocks when the date arrives.
- **Spin wheel** — 🎡 spin to let fate pick your next challenge from the board.
- **Proof & voting** — submit photo/video/text proof, squad votes Approve/Reject
  (majority, unanimous, or quorum %, configurable). Anonymous voting option.
- **Group chat** — real-time squad chat with unread badges on the tab.
- **Sound effects** — synthesized UI sounds (clicks, dings, wheel ticks,
  victory jingles), toggleable from your profile. Muted state is remembered.
- **Points & punishments** — approved quests award points and build streaks;
  rejected/expired quests assign a random punishment from an admin-editable pool
  with a due date.
- **Daily streaks** — complete at least one quest per day to keep your 🔥 flame
  alive (Duolingo-style). A rejected/expired quest resets it.
- **Yearly recap video** — every approved quest photo is saved; generate a
  cinematic recap slideshow video in the browser and download it. After a year
  of questing that's your annual recap.
- **Leaderboard, stats, badges** — live rankings, streaks, completion rate,
  favorite category, achievements.
- **Notifications** — new submissions to vote on, vote results, punishments,
  quest proposals.
- **Admin tools** — manage categories, punishment pool, voting rules, invite code.
- **Installable (PWA)** — add to your phone's home screen and it runs like an app.

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

Configuration lives in `backend/.env` — copy `backend/.env.example` and set a
strong `SECRET_KEY`. Auth logins are rate-limited (10 tries / 5 min per IP).

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

## Deployment

### Option A — Render (free) + Neon Postgres (recommended)

The included `render.yaml` Blueprint deploys to Render as a free web service.
Proof photos are stored in the database (free tiers have no persistent disk),
so nothing is lost when the service restarts.

1. **Create a free Neon database** at https://neon.tech — copy the connection
   string (looks like `postgresql://user:pass@host/db`).
2. **Create a free Render account** at https://render.com → **New → Blueprint**,
   connect this GitHub repo (`Rakso8080/sidequest`). Render detects
   `render.yaml` and builds the Docker image automatically.
3. In the service's **Environment** tab, set:
   - `DATABASE_URL` → your Neon connection string
   - `CORS_ORIGINS` → `https://sidequest.onrender.com` (your Render URL)
   - `SECRET_KEY` → a long random string (Render can auto-generate)
4. Deploy, wait a couple of minutes, open `https://sidequest.onrender.com`.

Free-tier notes: the service sleeps after ~15 min of inactivity and wakes on
the next visit (first load can take ~30s). Neon's free DB pauses after idle;
set "Suspend compute" to off in Neon for always-ready DB.

### Option B — Docker + Caddy (VPS)

The included `Dockerfile` builds the frontend with Node and serves both the SPA
and the API from a single Python container, so you only need one process.

1. Set up a domain pointing at your server.
2. Copy and fill the config:

   ```bash
   cp backend/.env.example backend/.env
   # edit backend/.env — SECRET_KEY, CORS_ORIGINS=https://your.domain
   ```

3. Run it:

   ```bash
   docker compose up -d --build
   ```

   The container listens on `127.0.0.1:8000` (not exposed publicly).

4. Install [Caddy](https://caddyserver.com), copy `Caddyfile`, replace
   `sidequest.example.com` with your domain, and run `caddy run`. Caddy
   automatically provisions a TLS certificate, so you get HTTPS for free.

Persistent data lives in Docker volumes (`sidequest-data` for the DB,
`sidequest-uploads` for proof photos).

### Option C — same-origin production build

1. Build the frontend: `cd frontend && npm run build`.
2. Run only the backend — `STATIC_DIR` defaults to `frontend/dist`, so FastAPI
   serves the app and `/api` + `/uploads` from one process:

   ```bash
   cd backend && source .venv/bin/activate
   SECRET_KEY=<strong-key> CORS_ORIGINS=https://your.domain uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```

3. Put Caddy or nginx in front with TLS, forwarding everything to `:8000`.

### Config

| Env var            | Purpose                                                        | Default |
| ------------------ | -------------------------------------------------------------- | ------- |
| `SECRET_KEY`       | JWT signing key — **set a strong value in prod**               | dev default (warns) |
| `DATABASE_URL`     | SQLAlchemy URL; swap to free Postgres for deployment           | local SQLite |
| `CORS_ORIGINS`     | Comma-separated allowed browser origins                        | `*` in dev |
| `STATIC_DIR`       | Directory of the built SPA                                     | `frontend/dist` |
| `UPLOAD_DIR`       | Reserved; proofs are stored in the DB so they survive restarts | `backend/uploads` |

**Frontend**: for a remote API, set `VITE_API_BASE` at build time so the app
knows the API origin (it defaults to same-origin, which works in the setups
above). Render builds from source, so this defaults to the Render URL —
no change needed there.

### Free database options

The app works out of the box with the local SQLite file (zero setup). For a
free, always-on database when you deploy for your friends:

- **Neon** — free serverless Postgres (0.5 GB storage). Great fit; set
  `DATABASE_URL=postgresql+psycopg2://user:pass@host/db` and install
  `psycopg2-binary` in the container.
- **Supabase** — free Postgres (500 MB) plus free object storage, which can
  replace the `UPLOAD_DIR` later.
- **Turso** — free edge SQLite (9 GB), stays SQLite-compatible.
- **Railway / Fly.io** — free or near-free tiers that also host the app.

For a squad of ~10–50 friends, free-tier Postgres from Neon or Supabase is
plenty. The only change needed is `DATABASE_URL` + the Postgres driver —
SQLAlchemy handles the rest.

### Security notes

- Never use the default `SECRET_KEY` in production — tokens are signed with it.
- Use HTTPS everywhere (Caddy does this automatically).
- Auth endpoints are rate-limited; keep `CORS_ORIGINS` explicit in production.
- Proof uploads accept images and short videos; a future hardening step could
  add virus scanning and per-user quotas.

## GitHub

Push the repo wherever you like (the commit history is clean and the demo data
is gitignored):

```bash
git remote add origin git@github.com:YOU/sidequest.git
git branch -M main
git push -u origin main
```
