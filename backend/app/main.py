from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from starlette.middleware.base import BaseHTTPMiddleware
from .config import CORS_ORIGINS, STATIC_DIR
from .database import Base, SessionLocal, engine
from .routers import (
    admin,
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
    uploads,
    users,
    votes,
)
from .services.seed import seed_demo, seed_global_quests
from .services.migrations import run_migrations


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    run_migrations(engine)
    db = SessionLocal()
    try:
        seed_global_quests(db)
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

for r in (
    admin,
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
    uploads,
    overview,
):
    # Root routes for the Vite dev proxy (it strips /api) and /api-prefixed
    # routes for production where the SPA talks to the backend directly.
    app.include_router(r.router)
    app.include_router(r.router, prefix="/api")


@app.get("/health")
def health():
    db = SessionLocal()
    try:
        dialect = db.bind.dialect.name if db.bind else "unknown"
    except Exception:
        dialect = "unknown"
    finally:
        db.close()
    return {"status": "ok", "db": dialect}


# Serve the built frontend (SPA) from the same process when it exists —
# lets a single container serve both API and app. API/upload routes take
# precedence because they are registered first.
if os.path.isdir(STATIC_DIR):

    class SpaFallback(BaseHTTPMiddleware):
        """Return index.html for browser navigations to client-side routes like
        /chat or /admin, which would otherwise be shadowed by same-name API
        GET routes (root mounts only exist for the Vite dev proxy)."""

        async def dispatch(self, request, call_next):
            path = request.url.path
            if (
                request.method == "GET"
                and not path.startswith(("/api", "/uploads", "/health"))
                and "text/html" in request.headers.get("accept", "")
                and not os.path.splitext(path)[1]
            ):
                index = os.path.join(STATIC_DIR, "index.html")
                if os.path.isfile(index):
                    return FileResponse(
                        index,
                        headers={"Cache-Control": "no-cache"},
                    )
            return await call_next(request)

    app.add_middleware(SpaFallback)

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa(full_path: str):
        candidate = os.path.join(STATIC_DIR, full_path)
        if full_path and os.path.isfile(candidate):
            return FileResponse(candidate)
        index = os.path.join(STATIC_DIR, "index.html")
        if os.path.isfile(index):
            return FileResponse(index, headers={"Cache-Control": "no-cache"})
        raise HTTPException(status_code=404, detail="Not found")
