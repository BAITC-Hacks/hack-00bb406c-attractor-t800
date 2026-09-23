from datetime import date, datetime, timezone
from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
class Base(DeclarativeBase): pass
class DatasetState(Base):
    __tablename__ = "dataset_state"
    key: Mapped[str] = mapped_column(String, primary_key=True)
    value: Mapped[str] = mapped_column(String, nullable=False)
class Employee(Base):
    __tablename__ = "employees"
    employee_id: Mapped[str] = mapped_column(String, primary_key=True)
    full_name: Mapped[str] = mapped_column(String, nullable=False)
    department: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[str] = mapped_column(String, nullable=False)
    grade: Mapped[str] = mapped_column(String, nullable=False)
    manager_id: Mapped[str | None] = mapped_column(ForeignKey("employees.employee_id"))
    hire_date: Mapped[date] = mapped_column(Date, nullable=False)
    tenure_months: Mapped[int] = mapped_column(Integer, nullable=False)
    work_format: Mapped[str] = mapped_column(String, nullable=False)
    preferred_language: Mapped[str] = mapped_column(String, nullable=False)
    career_goal: Mapped[dict | None] = mapped_column(JSON)
    skills: Mapped[dict] = mapped_column(JSON, nullable=False)
    last_review_date: Mapped[date] = mapped_column(Date, nullable=False)
class Event(Base):
    __tablename__ = "events"
    event_id: Mapped[str] = mapped_column(String, primary_key=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    type: Mapped[str] = mapped_column(String, nullable=False)
    format: Mapped[str] = mapped_column(String, nullable=False)
    duration_hours: Mapped[float] = mapped_column(Float, nullable=False)
    mandatory: Mapped[bool] = mapped_column(Boolean, nullable=False)
    target_roles: Mapped[list] = mapped_column(JSON, nullable=False)
    target_grades: Mapped[list] = mapped_column(JSON, nullable=False)
    develops_skills: Mapped[list] = mapped_column(JSON, nullable=False)
    prerequisites: Mapped[dict] = mapped_column(JSON, nullable=False)
    upcoming_sessions: Mapped[list] = mapped_column(JSON, nullable=False)
class Skill(Base):
    __tablename__ = "skills"
    skill_id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    type: Mapped[str] = mapped_column(String, nullable=False)
    category: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
class RoleProfile(Base):
    __tablename__ = "role_profiles"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    role: Mapped[str] = mapped_column(String, nullable=False, index=True)
    grade: Mapped[str] = mapped_column(String, nullable=False)
    required_skills: Mapped[dict] = mapped_column(JSON, nullable=False)
    critical_skills: Mapped[list] = mapped_column(JSON, nullable=False)
class ActivityHistory(Base):
    __tablename__ = "activity_history"
    record_id: Mapped[str] = mapped_column(String, primary_key=True)
    employee_id: Mapped[str] = mapped_column(ForeignKey("employees.employee_id"), index=True)
    event_id: Mapped[str] = mapped_column(ForeignKey("events.event_id"), index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=False)
    completion_pct: Mapped[int] = mapped_column(Integer, nullable=False)
    score: Mapped[int | None] = mapped_column(Integer)
    feedback_rating: Mapped[int | None] = mapped_column(Integer)
    assigned_by: Mapped[str] = mapped_column(String, nullable=False)
class DemoSession(Base):
    __tablename__ = "demo_sessions"
    token_hash: Mapped[str] = mapped_column(String, primary_key=True)
    actor_role: Mapped[str] = mapped_column(String, nullable=False)
    employee_id: Mapped[str | None] = mapped_column(ForeignKey("employees.employee_id"))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
class DemoClock(Base):
    __tablename__ = "demo_clock"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    as_of_date: Mapped[date] = mapped_column(Date, nullable=False)

class OneToOneMeeting(Base):
    __tablename__ = "one_to_one_meetings"
    __table_args__ = (
        UniqueConstraint("employee_id", "manager_id", "scheduled_at", name="uq_one_to_one_pair_time"),
        UniqueConstraint("created_by", "create_key", name="uq_one_to_one_create_key"),
    )
    meeting_id: Mapped[str] = mapped_column(String, primary_key=True)
    employee_id: Mapped[str] = mapped_column(ForeignKey("employees.employee_id"), nullable=False, index=True)
    manager_id: Mapped[str] = mapped_column(ForeignKey("employees.employee_id"), nullable=False, index=True)
    topic: Mapped[str] = mapped_column(String(240), nullable=False)
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="scheduled")
    qualified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    qualifying_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    employee_confirmed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    manager_confirmed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    manager_present: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    simulated_microphone_on: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    accelerated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    heartbeat_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_heartbeat_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_by: Mapped[str] = mapped_column(ForeignKey("employees.employee_id"), nullable=False)
    create_key: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

class OneToOneReward(Base):
    __tablename__ = "one_to_one_rewards"
    __table_args__ = (UniqueConstraint("meeting_id", "recipient_id", name="uq_one_to_one_reward_recipient"),)
    reward_id: Mapped[str] = mapped_column(String, primary_key=True)
    meeting_id: Mapped[str] = mapped_column(ForeignKey("one_to_one_meetings.meeting_id"), nullable=False, index=True)
    recipient_id: Mapped[str] = mapped_column(ForeignKey("employees.employee_id"), nullable=False, index=True)
    points: Mapped[int] = mapped_column(Integer, nullable=False, default=100)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

class OneToOneCommand(Base):
    __tablename__ = "one_to_one_commands"
    __table_args__ = (UniqueConstraint("meeting_id", "idempotency_key", name="uq_one_to_one_command_key"),)
    command_id: Mapped[str] = mapped_column(String, primary_key=True)
    meeting_id: Mapped[str] = mapped_column(ForeignKey("one_to_one_meetings.meeting_id"), nullable=False)
    idempotency_key: Mapped[str] = mapped_column(String(100), nullable=False)
    action: Mapped[str] = mapped_column(String(40), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
