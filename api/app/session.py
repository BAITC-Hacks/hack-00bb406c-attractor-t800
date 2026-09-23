"""Cookie session validation shared by API routers."""
import hashlib
import hmac
from datetime import datetime, timezone

from fastapi import Cookie, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import SESSION_SECRET
from app.db import SessionLocal
from app.models import DemoSession

COOKIE = "cq_session"


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def token_digest(token: str) -> str:
    return hmac.new(SESSION_SECRET.encode(), token.encode(), hashlib.sha256).hexdigest()


def current_session(cq_session: str | None = Cookie(default=None), db: Session = Depends(get_db)):
    if not cq_session:
        raise HTTPException(status_code=401, detail="Sign in with a synthetic demo account")
    session = db.get(DemoSession, token_digest(cq_session))
    if not session or session.expires_at <= datetime.now(timezone.utc):
        if session:
            db.delete(session)
            db.commit()
        raise HTTPException(status_code=401, detail="Demo session expired")
    return session
