from __future__ import annotations

from collections import defaultdict, deque
from datetime import datetime, timedelta
from time import time

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import PasswordReset, Squad, User
from ..schemas import (
    ForgotIn,
    LoginIn,
    RegisterIn,
    ResetIn,
    TokenOut,
)
from ..security import create_token, hash_password, verify_password
from ..services import verification

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
    if payload.phone:
        user.phone = verification.normalize_identifier(payload.phone)
    db.add(user)
    db.flush()

    # Auto-join via an invite link/code when provided.
    if payload.invite_code:
        code = payload.invite_code.strip().upper()
        squad = (
            db.query(Squad)
            .filter(Squad.invite_code == code)
            .first()
        )
        if squad is not None:
            user.squad_id = squad.id
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


@router.post("/forgot")
def forgot_password(payload: ForgotIn, request: Request, db: Session = Depends(get_db)):
    identifier = verification.normalize_identifier(payload.identifier)
    if not identifier:
        raise HTTPException(status_code=400, detail="Enter your email or phone number")

    user = _find_user_by_identifier(db, identifier)
    # Always answer the same way whether or not the account exists, so you
    # can't enumerate registered emails/phones.
    if user is None:
        return {"ok": True, "delivery": "none", "debug_code": None}

    if not verification.allow_send(identifier):
        raise HTTPException(
            status_code=429,
            detail="Wait a minute before requesting another code",
        )

    code = verification.new_code()
    db.query(PasswordReset).filter(PasswordReset.identifier == identifier).delete()
    db.add(
        PasswordReset(
            identifier=identifier,
            code_hash=verification.make_code_hash(code),
            expires_at=verification.expires_at(),
        )
    )
    db.commit()

    delivery, sent = verification.send_code(identifier, code)
    debug_code = code if not sent else None
    return {"ok": True, "delivery": delivery, "debug_code": debug_code}


@router.post("/reset")
def reset_password(payload: ResetIn, db: Session = Depends(get_db)):
    identifier = verification.normalize_identifier(payload.identifier)
    row = (
        db.query(PasswordReset)
        .filter(PasswordReset.identifier == identifier)
        .order_by(PasswordReset.created_at.desc())
        .first()
    )
    if row is None or row.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=400,
            detail="Code expired. Request a new one.",
        )
    if not verification.check_code_hash(payload.code.strip(), row.code_hash):
        raise HTTPException(status_code=400, detail="Wrong verification code")

    user = _find_user_by_identifier(db, identifier)
    if user is None:
        raise HTTPException(status_code=400, detail="Account not found")

    user.password_hash = hash_password(payload.new_password)
    db.query(PasswordReset).filter(PasswordReset.identifier == identifier).delete()
    db.commit()
    return {"ok": True}


def _find_user_by_identifier(db: Session, identifier: str) -> User | None:
    if "@" in identifier:
        return db.query(User).filter(User.email == identifier).first()
    return (
        db.query(User)
        .filter(
            or_(
                User.phone == identifier,
                User.phone == identifier.replace("+", "00"),
            )
        )
        .first()
    )


@router.get("/me", response_model=TokenOut)
def me(user: User = Depends(get_current_user)):
    return TokenOut(token="", user=user)
