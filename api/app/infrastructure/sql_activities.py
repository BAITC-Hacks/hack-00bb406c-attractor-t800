from datetime import datetime, timezone
from uuid import uuid4
from fastapi import HTTPException
from app.application.profiles import ProfileService
from app.infrastructure.sql_profiles import SqlProfileRepository
from app.models import ActivityHistory, Employee, Event


def serialize_record(row):
    return {key: getattr(row, key) for key in ('record_id', 'event_id', 'date', 'status', 'completed_at', 'recorded_at')}


def serialize_event(row):
    return {column.name: getattr(row, column.name) for column in Event.__table__.columns}


class SqlActivityRepository:
    def __init__(self, db):
        self.db = db

    def profile(self, employee_id):
        return ProfileService(SqlProfileRepository(self.db)).get_profile(employee_id)

    def events(self):
        return [serialize_event(row) for row in self.db.query(Event).order_by(Event.event_id).all()]

    def event(self, event_id):
        row = self.db.get(Event, event_id)
        if row is None:
            raise HTTPException(404, 'Активность не найдена')
        return serialize_event(row)

    def lock_employee(self, employee_id):
        # Serialize every write for a person, including requests from separate sessions.
        self.db.query(Employee).filter_by(employee_id=employee_id).with_for_update().one()

    def participation(self, employee_id, record_id):
        row = self.db.query(ActivityHistory).filter_by(employee_id=employee_id, record_id=record_id).first()
        if row is None:
            raise HTTPException(404, 'Участие не найдено')
        return serialize_record(row)

    def enroll(self, employee_id, event_id, session_date):
        row = ActivityHistory(record_id=f'APP_{uuid4().hex}', employee_id=employee_id, event_id=event_id, date=session_date, status='planned', completion_pct=0, assigned_by='self')
        self.db.add(row)
        self.db.commit()
        return serialize_record(row)

    def transition(self, record_id, status, as_of_date):
        row = self.db.get(ActivityHistory, record_id)
        row.status = status
        if status == 'completed':
            now = datetime.now(timezone.utc)
            row.completed_at = datetime.combine(as_of_date, now.timetz())
            row.recorded_at = now
            row.completion_pct = 100
        self.db.commit()
        return serialize_record(row)
