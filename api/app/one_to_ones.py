"""Participant-scoped persistence and simulation rules for one-to-one meetings."""
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import DemoSession, Employee, OneToOneCommand, OneToOneMeeting, OneToOneReward
from app.session import current_session, get_db

router = APIRouter(prefix="/api/one-to-ones", tags=["one-to-ones"])
HEARTBEAT_INTERVAL_SECONDS = 10
HEARTBEAT_TIMEOUT_SECONDS = 30
QUALIFYING_SECONDS = 900


class CreateMeeting(BaseModel):
    topic: str = Field(min_length=1, max_length=240)
    scheduled_at: datetime
    idempotency_key: str = Field(min_length=1, max_length=100)

    @field_validator("topic")
    @classmethod
    def clean_topic(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Topic cannot be blank")
        return value

    @field_validator("scheduled_at")
    @classmethod
    def require_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("Choose a date and time with a timezone")
        return value


class MeetingCommand(BaseModel):
    action: str = Field(min_length=1, max_length=40)
    idempotency_key: str = Field(min_length=1, max_length=100)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def require_employee(session: DemoSession) -> str:
    if session.actor_role == "operator" or not session.employee_id:
        raise HTTPException(status_code=403, detail="Choose an employee account to use one-to-one")
    return session.employee_id


def visible_meeting(db: Session, meeting_id: str, employee_id: str, lock: bool = False) -> OneToOneMeeting:
    query = db.query(OneToOneMeeting).filter(OneToOneMeeting.meeting_id == meeting_id)
    if lock:
        query = query.with_for_update()
    meeting = query.first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    if employee_id not in (meeting.employee_id, meeting.manager_id):
        raise HTTPException(status_code=403, detail="Only meeting participants can access it")
    return meeting


def grant_rewards(db: Session, meeting: OneToOneMeeting, now: datetime) -> None:
    if meeting.qualifying_seconds < QUALIFYING_SECONDS or meeting.qualified:
        return
    meeting.qualifying_seconds = QUALIFYING_SECONDS
    meeting.qualified = True
    existing = {row.recipient_id for row in db.query(OneToOneReward).filter_by(meeting_id=meeting.meeting_id).all()}
    for recipient in (meeting.employee_id, meeting.manager_id):
        if recipient not in existing:
            db.add(OneToOneReward(reward_id=str(uuid.uuid4()), meeting_id=meeting.meeting_id,
                                  recipient_id=recipient, points=100, created_at=now))


def advance_clock(db: Session, meeting: OneToOneMeeting, now: datetime, *, extend_heartbeat: bool = True) -> None:
    """Credit active time at commands; reads only expire stale heartbeats."""
    previous = as_utc(meeting.heartbeat_at)
    if meeting.status == "active" and previous:
        elapsed = max(0, int((now - previous).total_seconds()))
        expired = elapsed > HEARTBEAT_TIMEOUT_SECONDS
        # A live screen pings every 10 seconds. Credit a read only once a stale
        # heartbeat has timed out, then pause it; reads never extend the lease.
        if extend_heartbeat or expired:
            credited = min(elapsed, HEARTBEAT_TIMEOUT_SECONDS)
        else:
            credited = 0
        if meeting.manager_present and meeting.simulated_microphone_on:
            meeting.qualifying_seconds = min(QUALIFYING_SECONDS,
                                            meeting.qualifying_seconds + credited)
        if expired:
            meeting.status = "paused"
            meeting.heartbeat_at = None
        elif extend_heartbeat:
            meeting.heartbeat_at = now
        grant_rewards(db, meeting, now)


def serialize(db: Session, meeting: OneToOneMeeting) -> dict:
    employee = db.get(Employee, meeting.employee_id)
    manager = db.get(Employee, meeting.manager_id)
    rewards = db.query(OneToOneReward).filter_by(meeting_id=meeting.meeting_id).all()
    return {
        "meeting_id": meeting.meeting_id,
        "employee": {"employee_id": meeting.employee_id, "full_name": employee.full_name},
        "manager": {"employee_id": meeting.manager_id, "full_name": manager.full_name},
        "topic": meeting.topic,
        "scheduled_at": meeting.scheduled_at.isoformat(),
        "status": meeting.status,
        "qualified": meeting.qualified,
        "qualifying_seconds": meeting.qualifying_seconds,
        "employee_confirmed": meeting.employee_confirmed,
        "manager_confirmed": meeting.manager_confirmed,
        "manager_present": meeting.manager_present,
        "simulated_microphone_on": meeting.simulated_microphone_on,
        "accelerated": meeting.accelerated,
        "heartbeat_at": meeting.heartbeat_at.isoformat() if meeting.heartbeat_at else None,
        "ended_at": meeting.ended_at.isoformat() if meeting.ended_at else None,
        "rewards": [{"recipient_id": row.recipient_id, "points": row.points} for row in rewards],
    }


@router.get("/context")
def one_to_one_context(session: DemoSession = Depends(current_session), db: Session = Depends(get_db)):
    employee_id = require_employee(session)
    employee = db.get(Employee, employee_id)
    manager = db.get(Employee, employee.manager_id) if employee.manager_id else None
    reward_rows = db.query(OneToOneReward).filter_by(recipient_id=employee_id).all()
    return {
        "employee": {"employee_id": employee.employee_id, "full_name": employee.full_name},
        "manager": {"employee_id": manager.employee_id, "full_name": manager.full_name} if manager else None,
        "demo_xp": sum(reward.points for reward in reward_rows),
        "heartbeat_interval_seconds": HEARTBEAT_INTERVAL_SECONDS,
        "heartbeat_timeout_seconds": HEARTBEAT_TIMEOUT_SECONDS,
        "qualifying_seconds": QUALIFYING_SECONDS,
    }


@router.post("")
def create_meeting(payload: CreateMeeting, session: DemoSession = Depends(current_session), db: Session = Depends(get_db)):
    employee_id = require_employee(session)
    prior = db.query(OneToOneMeeting).filter_by(created_by=employee_id, create_key=payload.idempotency_key).first()
    if prior:
        return serialize(db, prior)
    employee = db.get(Employee, employee_id)
    if not employee.manager_id:
        raise HTTPException(status_code=409, detail="A one-to-one is unavailable because no manager is assigned")
    manager = db.get(Employee, employee.manager_id)
    if not manager:
        raise HTTPException(status_code=409, detail="The assigned manager is not available in the employee dataset")
    meeting = OneToOneMeeting(
        meeting_id=str(uuid.uuid4()), employee_id=employee_id, manager_id=manager.employee_id,
        topic=payload.topic, scheduled_at=payload.scheduled_at.astimezone(timezone.utc),
        status="scheduled", qualified=False, qualifying_seconds=0, employee_confirmed=False,
        manager_confirmed=False, manager_present=True, simulated_microphone_on=True,
        accelerated=False, created_by=employee_id, create_key=payload.idempotency_key, created_at=utcnow(),
    )
    db.add(meeting)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        same_key = db.query(OneToOneMeeting).filter_by(created_by=employee_id, create_key=payload.idempotency_key).first()
        if same_key:
            return serialize(db, same_key)
        raise HTTPException(status_code=409, detail="A meeting for this pair is already planned at that time") from exc
    db.refresh(meeting)
    return serialize(db, meeting)


@router.get("")
def list_meetings(session: DemoSession = Depends(current_session), db: Session = Depends(get_db)):
    employee_id = require_employee(session)
    rows = db.query(OneToOneMeeting).filter(
        (OneToOneMeeting.employee_id == employee_id) | (OneToOneMeeting.manager_id == employee_id)
    ).order_by(OneToOneMeeting.scheduled_at.desc()).all()
    now = utcnow()
    for meeting in rows:
        advance_clock(db, meeting, now, extend_heartbeat=False)
    db.commit()
    return [serialize(db, row) for row in rows]


@router.get("/{meeting_id}")
def read_meeting(meeting_id: str, session: DemoSession = Depends(current_session), db: Session = Depends(get_db)):
    employee_id = require_employee(session)
    meeting = visible_meeting(db, meeting_id, employee_id, lock=True)
    advance_clock(db, meeting, utcnow(), extend_heartbeat=False)
    db.commit()
    return serialize(db, meeting)


@router.post("/{meeting_id}/commands")
def command_meeting(meeting_id: str, payload: MeetingCommand,
                    session: DemoSession = Depends(current_session), db: Session = Depends(get_db)):
    employee_id = require_employee(session)
    meeting = visible_meeting(db, meeting_id, employee_id, lock=True)
    previous = db.query(OneToOneCommand).filter_by(meeting_id=meeting_id, idempotency_key=payload.idempotency_key).first()
    if previous:
        if previous.action != payload.action:
            raise HTTPException(status_code=409, detail="Idempotency key was already used for another command")
        return serialize(db, meeting)

    now = utcnow()
    advance_clock(db, meeting, now)
    action = payload.action
    if action == "confirm_demo":
        if meeting.status not in ("scheduled", "ready"):
            raise HTTPException(status_code=409, detail="Demo confirmation is only available before the meeting starts")
        meeting.employee_confirmed = True
        meeting.manager_confirmed = True
        meeting.status = "ready"
    elif action == "start":
        if meeting.status != "ready" or not (meeting.employee_confirmed and meeting.manager_confirmed):
            raise HTTPException(status_code=409, detail="Confirm the simulated demo notice before starting")
        meeting.status = "active"
        meeting.heartbeat_at = now
        meeting.last_heartbeat_at = now
    elif action == "heartbeat":
        if meeting.status != "active":
            raise HTTPException(status_code=409, detail="Only an active meeting accepts heartbeats")
        meeting.heartbeat_at = now
        meeting.last_heartbeat_at = now
    elif action == "pause":
        if meeting.status != "active":
            raise HTTPException(status_code=409, detail="Only an active meeting can be paused")
        meeting.status = "paused"
        meeting.heartbeat_at = None
    elif action == "resume":
        if meeting.status != "paused":
            raise HTTPException(status_code=409, detail="Only a paused meeting can be resumed")
        meeting.status = "active"
        meeting.heartbeat_at = now
        meeting.last_heartbeat_at = now
    elif action == "toggle_manager":
        if meeting.status not in ("ready", "active", "paused"):
            raise HTTPException(status_code=409, detail="Manager presence can only change during a demo")
        meeting.manager_present = not meeting.manager_present
    elif action == "toggle_microphone":
        if meeting.status not in ("ready", "active", "paused"):
            raise HTTPException(status_code=409, detail="The simulated microphone can only change during a demo")
        meeting.simulated_microphone_on = not meeting.simulated_microphone_on
    elif action in ("fast_forward_minute", "fast_forward_last_second", "fast_forward_threshold"):
        if meeting.status != "active":
            raise HTTPException(status_code=409, detail="Time can only be accelerated while the demo is active")
        if action == "fast_forward_minute":
            seconds = 60
        elif action == "fast_forward_last_second":
            seconds = max(0, QUALIFYING_SECONDS - 1 - meeting.qualifying_seconds)
        else:
            seconds = max(0, QUALIFYING_SECONDS - meeting.qualifying_seconds)
        meeting.accelerated = True
        if meeting.manager_present and meeting.simulated_microphone_on:
            meeting.qualifying_seconds = min(QUALIFYING_SECONDS, meeting.qualifying_seconds + seconds)
        grant_rewards(db, meeting, now)
    elif action == "finish":
        if meeting.status not in ("ready", "active", "paused"):
            raise HTTPException(status_code=409, detail="This meeting has already ended")
        meeting.status = "ended"
        meeting.ended_at = now
        meeting.heartbeat_at = None
    else:
        raise HTTPException(status_code=422, detail="Unknown one-to-one command")

    db.add(OneToOneCommand(command_id=str(uuid.uuid4()), meeting_id=meeting_id,
                           idempotency_key=payload.idempotency_key, action=action, created_at=now))
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Command could not be applied; refresh the meeting") from exc
    return serialize(db, meeting)
