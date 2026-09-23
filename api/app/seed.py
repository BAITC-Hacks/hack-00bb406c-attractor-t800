import csv
import json
from datetime import date
from app.config import DATASET_PATH
from app.db import SessionLocal
from app.models import ActivityHistory, DatasetState, DemoClock, Employee, Event, RoleProfile, Skill

def load_collection(filename, key):
    with (DATASET_PATH / filename).open(encoding="utf-8") as stream:
        payload = json.load(stream)
    return payload[key]

def seed():
    if not DATASET_PATH.exists():
        raise RuntimeError(f"Starter kit directory not found: {DATASET_PATH}")
    employees = load_collection("employees.json", "employees")
    events = load_collection("events.json", "events")
    skill_data = json.loads((DATASET_PATH / "skills.json").read_text(encoding="utf-8"))
    db = SessionLocal()
    try:
        if db.get(DatasetState, "official_dataset_v1"):
            return
        # Seed the immutable starter kit only once. Future container starts retain all state.
        for row in employees:
            row = {**row, "manager_id": None}
            row["hire_date"] = date.fromisoformat(row["hire_date"])
            row["last_review_date"] = date.fromisoformat(row["last_review_date"])
            db.add(Employee(**row))
        db.flush()
        for row in employees:
            if row["manager_id"]:
                db.query(Employee).filter_by(employee_id=row["employee_id"]).update({"manager_id": row["manager_id"]})
        for row in events:
            db.add(Event(**row))
        db.add_all(Skill(**row) for row in skill_data["skills"])
        db.add_all(RoleProfile(**row) for row in skill_data["role_profiles"])
        # The history rows have foreign keys to employees and events. Flush
        # their parent rows before queuing history inserts in the same transaction.
        db.flush()
        with (DATASET_PATH / "activity_history.csv").open(encoding="utf-8", newline="") as stream:
            for row in csv.DictReader(stream):
                row["date"] = date.fromisoformat(row["date"])
                row["due_date"] = date.fromisoformat(row["due_date"]) if row["due_date"] else None
                for field in ("completion_pct", "score", "feedback_rating"):
                    row[field] = int(row[field]) if row[field] else None
                db.add(ActivityHistory(**row))
        db.add(DatasetState(key="official_dataset_v1", value="1.0"))
        db.add(DemoClock(id=1, as_of_date=date(2026, 10, 1)))
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed()
