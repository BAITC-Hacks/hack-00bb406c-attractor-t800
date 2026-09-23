"""One bulk snapshot for the HR use case; personal inputs never leave application logic."""
from collections import defaultdict
from app.domain.trajectory import build_trajectory
from app.infrastructure.sql_activities import serialize_event
from app.models import ActivityHistory, DatasetState, DemoClock, Employee, Event, RoleProfile, Skill


class SqlHrRepository:
    def __init__(self, db):
        self.db = db

    def snapshot(self):
        events = [serialize_event(e) for e in self.db.query(Event).all()]
        by_id = {e['event_id']: e for e in events}
        names = {s.skill_id: s.name for s in self.db.query(Skill).all()}
        requirements = [{'role': p.role, 'grade': p.grade, 'required_skills': p.required_skills, 'critical_skills': p.critical_skills} for p in self.db.query(RoleProfile).all()]
        as_of_date = self.db.get(DemoClock, 1).as_of_date
        version = self.db.get(DatasetState, 'official_dataset_v1')
        history = defaultdict(list)
        for row in self.db.query(ActivityHistory).all():
            event = by_id[row.event_id]
            history[row.employee_id].append({
                'record_id': row.record_id, 'event_id': row.event_id, 'date': row.date,
                'status': row.status, 'completed_at': row.completed_at,
                **{key: event[key] for key in ('title', 'mandatory', 'format', 'develops_skills')},
            })
        profiles = []
        for person in self.db.query(Employee).order_by(Employee.employee_id).all():
            employee = {key: getattr(person, key) for key in ('employee_id', 'full_name', 'department', 'role', 'grade', 'career_goal', 'last_review_date')}
            rows = sorted(history[person.employee_id], key=lambda row: (-row['date'].toordinal(), row['record_id']))
            profiles.append({
                'employee': employee, 'history': rows, 'as_of_date': as_of_date,
                'dataset_version': version.value if version else 'unknown',
                'trajectory': build_trajectory(employee, person.skills, requirements, rows, names, as_of_date),
            })
        return {'profiles': profiles, 'events': events, 'skill_names': names,
                'as_of_date': as_of_date, 'dataset_version': version.value if version else 'unknown'}
