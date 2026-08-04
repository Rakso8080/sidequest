#!/usr/bin/env bash
# Start SideQuest locally: backend on :8000, frontend on :5173.
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "▶ Starting backend (FastAPI :8000)..."
(
  cd "$ROOT/backend"
  if [ ! -d .venv ]; then
    python3 -m venv .venv
    ./.venv/bin/pip install -q -r requirements.txt
  fi
  ./.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
) &
BACKEND_PID=$!

echo "▶ Starting frontend (Vite :5173)..."
(
  cd "$ROOT/frontend"
  if [ ! -d node_modules ]; then
    npm install --silent
  fi
  npm run dev
) &
FRONTEND_PID=$!

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT

echo
echo "Open http://localhost:5173  (demo: demo@sidequest.app / demo123)"
wait
