from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.application.ports import ProfileRepository
from app.models import ActivityHistory, DemoClock, Employee, Event, RoleProfile, Skill

class SqlProfileRepository(ProfileRepository):
    def __init__(self, db: Session):
        self.db = db

    def get_profile(self, employee_id: str) -> dict:
        employee = self.db.get(Employee, employee_id)
        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")
        profile = self.db.query(RoleProfile).filter_by(role=employee.role, grade=employee.grade).first()
        skill_ids = set(employee.skills) | (set(profile.required_skills) if profile else set())
        skill_names = {skill.skill_id: skill.name for skill in self.db.query(Skill).filter(Skill.skill_id.in_(skill_ids)).all()}
        history = self.db.query(ActivityHistory, Event).join(Event, ActivityHistory.event_id == Event.event_id).filter(ActivityHistory.employee_id == employee_id).order_by(ActivityHistory.date.desc(), ActivityHistory.record_id).all()
        return {
            "employee": {"employee_id": employee.employee_id, "full_name": employee.full_name, "department": employee.department, "role": employee.role, "grade": employee.grade, "manager_id": employee.manager_id, "hire_date": employee.hire_date, "tenure_months": employee.tenure_months, "work_format": employee.work_format, "preferred_language": employee.preferred_language, "career_goal": employee.career_goal, "last_review_date": employee.last_review_date},
            "skills": [{"skill_id": key, "name": skill_names.get(key, key), "level": employee.skills.get(key, 0), "required_level": profile.required_skills.get(key) if profile else None, "critical": key in (profile.critical_skills if profile else [])} for key in sorted(skill_ids, key=lambda key: skill_names.get(key, key))],
            "history": [{"record_id": record.record_id, "event_id": event.event_id, "title": event.title, "date": record.date, "status": record.status, "completion_pct": record.completion_pct, "score": record.score, "mandatory": event.mandatory} for record, event in history],
            "history_count": len(history), "dataset_version": "1.0", "as_of_date": self.db.get(DemoClock, 1).as_of_date,
        }
