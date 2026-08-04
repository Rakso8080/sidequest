from __future__ import annotations

from collections import defaultdict, deque
from time import time

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import User
from ..schemas import LoginIn, RegisterIn, TokenOut
from ..security import create_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])

# Simple in-memory rate limiter for brute-force protection.
AUTH_WINDOW_SECONDS = 300
AUTH_MAX_ATTEMPTS = 10
_attempts: dict = defaultdict(deque)


def _check_rate_limit(key: str) -> None:
    now = time()
    dq = _attempts[key]
    while dq and now - dq[0] > AUTH_WINDOW_SECONDS:
        dq.popleft()
    if len(dq) >= AUTH_MAX_ATTEMPTS:
        raise HTTPException(
            status_code=429,
            detail="Too many attempts. Try again in a few minutes.",
        )
    dq.append(now)


def _rate_key(request: Request, username_or_email: str) -> str:
    ip = request.client.host if request.client else "unknown"
    return f"{ip}:{username_or_email.lower()}"


@router.post("/register", response_model=TokenOut)
def register(payload: RegisterIn, request: Request, db: Session = Depends(get_db)):
    _check_rate_limit(_rate_key(request, payload.username))
    email = payload.email.strip().lower()
    username = payload.username.strip()
    exists = (
        db.query(User)
        .filter(or_(User.email == email, User.username == username))
        .first()
    )
    if exists:
        raise HTTPException(status_code=400, detail="Email or username already taken")
    user = User(
        email=email,
        username=username,
        display_name=payload.display_name.strip() or username,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.flush()
    return TokenOut(token=create_token(user.id), user=user)


@router.post("/login", response_model=TokenOut)
def login(payload: LoginIn, request: Request, db: Session = Depends(get_db)):
    _check_rate_limit(_rate_key(request, payload.username_or_email))
    value = payload.username_or_email.strip().lower()
    user = (
        db.query(User)
        .filter(or_(User.email == value, User.username == value))
        .first()
    )
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return TokenOut(token=create_token(user.id), user=user)


@router.get("/me", response_model=TokenOut)
def me(user: User = Depends(get_current_user)):
    return TokenOut(token="", user=user)
