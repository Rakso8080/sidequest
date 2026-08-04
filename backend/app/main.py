from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .database import Base, UPLOAD_DIR, SessionLocal, engine
from .routers import (
    auth,
    leaderboard,
    notifications,
    overview,
    punishments,
    quests,
    squads,
    submissions,
    users,
    votes,
)
from .services.seed import seed_demo


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_demo(db)
        db.commit()
    finally:
        db.close()
    yield


app = FastAPI(
    title="SideQuest",
    description="Social accountability game for a squad of friends.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

for r in (auth, users, squads, quests, submissions, votes, punishments, leaderboard, notifications, overview):
    app.include_router(r.router)


@app.get("/health")
def health():
    return {"status": "ok"}
