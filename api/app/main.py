import hashlib
import hmac
import secrets
from datetime import date, datetime, timedelta, timezone
from fastapi import Cookie, Depends, FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.config import SESSION_SECRET
from app.db import SessionLocal
from app.models import DemoClock, DemoSession, Employee
from app.application.profiles import ProfileService
from app.infrastructure.sql_profiles import SqlProfileRepository

app = FastAPI(title="Career Quest API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:8080"], allow_credentials=True, allow_methods=["GET", "POST", "DELETE"], allow_headers=["Content-Type", "X-CSRF-Token"])
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

class DemoLogin(BaseModel):
    employee_id: str | None = None
    operator: bool = False

class ClockUpdate(BaseModel):
    as_of_date: date

@app.get("/api/health")
def health(db: Session = Depends(get_db)):
    clock = db.get(DemoClock, 1)
    return {"status": "ok", "dataset_version": "1.0", "as_of_date": clock.as_of_date if clock else None}

@app.get("/api/demo/accounts")
def demo_accounts(db: Session = Depends(get_db)):
    rows = db.query(Employee).order_by(Employee.full_name).all()
    managers = {row.manager_id for row in rows if row.manager_id}
    return [{"employee_id": row.employee_id, "full_name": row.full_name, "department": row.department, "role": row.role, "grade": row.grade, "account_role": "manager" if row.employee_id in managers else "employee"} for row in rows]

@app.post("/api/demo/login")
def demo_login(payload: DemoLogin, response: Response, db: Session = Depends(get_db)):
    if payload.operator:
        actor_role, employee_id = "operator", None
    elif payload.employee_id and db.get(Employee, payload.employee_id):
        has_reports = db.query(Employee.employee_id).filter(Employee.manager_id == payload.employee_id).first() is not None
        actor_role, employee_id = ("manager" if has_reports else "employee"), payload.employee_id
    else:
        raise HTTPException(status_code=404, detail="Choose an employee from the official dataset")
    token = secrets.token_urlsafe(32)
    session = DemoSession(token_hash=token_digest(token), actor_role=actor_role, employee_id=employee_id, expires_at=datetime.now(timezone.utc) + timedelta(hours=4))
    db.add(session)
    db.commit()
    response.set_cookie(COOKIE, token, httponly=True, secure=False, samesite="strict", max_age=4 * 60 * 60, path="/")
    return {"actor_role": actor_role, "employee_id": employee_id}

@app.delete("/api/session")
def logout(response: Response, session: DemoSession = Depends(current_session), db: Session = Depends(get_db)):
    db.delete(session)
    db.commit()
    response.delete_cookie(COOKIE, path="/")
    return {"status": "signed_out"}

@app.get("/api/session")
def read_session(session: DemoSession = Depends(current_session), db: Session = Depends(get_db)):
    actor = db.get(Employee, session.employee_id) if session.employee_id else None
    return {"actor_role": session.actor_role, "employee_id": session.employee_id, "actor_name": actor.full_name if actor else "Демо-оператор"}

@app.get("/api/me/profile")
def my_profile(session: DemoSession = Depends(current_session), db: Session = Depends(get_db)):
    if session.actor_role == "operator":
        raise HTTPException(status_code=403, detail="Choose an employee account to open a profile")
    return ProfileService(SqlProfileRepository(db)).get_profile(session.employee_id)

@app.get("/api/employees/{employee_id}")
def employee_profile(employee_id: str, session: DemoSession = Depends(current_session), db: Session = Depends(get_db)):
    if session.actor_role != "operator" and session.employee_id != employee_id:
        raise HTTPException(status_code=403, detail="A demo account can only open its own profile")
    return ProfileService(SqlProfileRepository(db)).get_profile(employee_id)

@app.get("/api/operator/clock")
def read_clock(session: DemoSession = Depends(current_session), db: Session = Depends(get_db)):
    if session.actor_role != "operator":
        raise HTTPException(status_code=403, detail="Operator access required")
    clock = db.get(DemoClock, 1)
    return {"as_of_date": clock.as_of_date, "dataset_date": date(2026, 10, 1)}

@app.put("/api/operator/clock")
def set_clock(payload: ClockUpdate, session: DemoSession = Depends(current_session), db: Session = Depends(get_db)):
    if session.actor_role != "operator":
        raise HTTPException(status_code=403, detail="Operator access required")
    clock = db.get(DemoClock, 1)
    clock.as_of_date = payload.as_of_date
    db.commit()
    return {"as_of_date": clock.as_of_date, "dataset_date": date(2026, 10, 1)}

@app.post("/api/operator/clock/reset")
def reset_clock(session: DemoSession = Depends(current_session), db: Session = Depends(get_db)):
    if session.actor_role != "operator":
        raise HTTPException(status_code=403, detail="Operator access required")
    clock = db.get(DemoClock, 1)
    clock.as_of_date = date(2026, 10, 1)
    db.commit()
    return {"as_of_date": clock.as_of_date}
