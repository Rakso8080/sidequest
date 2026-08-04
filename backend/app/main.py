from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import CORS_ORIGINS, STATIC_DIR
from .database import Base, UPLOAD_DIR, SessionLocal, engine
from .routers import (
    auth,
    chat,
    leaderboard,
    notifications,
    overview,
    punishments,
    quests,
    recap,
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
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

for r in (
    auth,
    users,
    squads,
    quests,
    submissions,
    votes,
    punishments,
    leaderboard,
    notifications,
    chat,
    recap,
    overview,
):
    app.include_router(r.router)


@app.get("/health")
def health():
    return {"status": "ok"}


# Serve the built frontend (SPA) from the same process when it exists —
# lets a single container serve both API and app. API/upload routes take
# precedence because they are registered first.
if os.path.isdir(STATIC_DIR):

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa(full_path: str):
        candidate = os.path.join(STATIC_DIR, full_path)
        if full_path and os.path.isfile(candidate):
            return FileResponse(candidate)
        index = os.path.join(STATIC_DIR, "index.html")
        if os.path.isfile(index):
            return FileResponse(index)
        raise HTTPException(status_code=404, detail="Not found")
