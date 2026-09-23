"""Import or refresh the mounted Career Quest snapshot without embedding unchanged records."""

import csv
import json
from pathlib import Path

from app.config import DATASET_DIR
from app.db import connection, initialize
from app.models import Document
from app.store import upsert

NAMESPACE = "career-quest"


def read_json(folder: Path, filename: str):
    return json.loads((folder / filename).read_text(encoding="utf-8"))


def documents(folder: Path):
    employees = read_json(folder, "employees.json")
    events = read_json(folder, "events.json")
    skills = read_json(folder, "skills.json")
    version = str(employees.get("meta", {}).get("version", "1"))
    skill_names = {item["skill_id"]: item["name"] for item in skills["skills"]}
    event_names = {item["event_id"]: item["title"] for item in events["events"]}

    for item in skills["skills"]:
        skill_id = item["skill_id"]
        yield Document(
            namespace=NAMESPACE, source_id=f"skill:{skill_id}", kind="skill",
            title=item["name"],
            content=f"Skill {item['name']} ({skill_id}). Category: {item['category']}. Type: {item['type']}. {item['description']}",
            metadata={"skill_id": skill_id, "category": item["category"], "type": item["type"]},
            source_version=version,
        )

    for item in skills["role_profiles"]:
        role, grade = item["role"], item["grade"]
        requirements = "; ".join(
            f"{skill_names.get(skill_id, skill_id)} ({skill_id}) required level {level}"
            + (" critical" if skill_id in item["critical_skills"] else "")
            for skill_id, level in item["required_skills"].items()
        )
        yield Document(
            namespace=NAMESPACE, source_id=f"role:{role}:{grade}", kind="role_profile",
            title=f"{role} / {grade}",
            content=f"Role {role}, grade {grade}. Required skills: {requirements}.",
            metadata={"role": role, "grade": grade, "required_skills": item["required_skills"],
                      "critical_skills": item["critical_skills"]},
            source_version=version,
        )

    for item in events["events"]:
        event_id = item["event_id"]
        gains = "; ".join(
            f"{skill_names.get(g['skill_id'], g['skill_id'])} gain {g['gain']} max level {g['max_level']}"
            for g in item["develops_skills"]
        ) or "none"
        prerequisites = "; ".join(
            f"{skill_names.get(k, k)} at least level {v}" for k, v in item["prerequisites"].items()
        ) or "none"
        content = (
            f"Event {item['title']} ({event_id}). {item['description']} "
            f"Type {item['type']}, format {item['format']}, duration {item['duration_hours']} hours. "
            f"Mandatory {item['mandatory']}. Target roles: {', '.join(item['target_roles'])}. "
            f"Target grades: {', '.join(item['target_grades'])}. "
            f"Develops skills: {gains}. Prerequisites: {prerequisites}. "
            f"Upcoming sessions: {', '.join(item['upcoming_sessions']) or 'self-paced or none'}."
        )
        yield Document(
            namespace=NAMESPACE, source_id=f"event:{event_id}", kind="event", title=item["title"],
            content=content,
            metadata={"event_id": event_id, "type": item["type"], "format": item["format"],
                      "mandatory": item["mandatory"], "target_roles": item["target_roles"],
                      "target_grades": item["target_grades"], "develops_skills": item["develops_skills"],
                      "prerequisites": item["prerequisites"], "upcoming_sessions": item["upcoming_sessions"],
                      "duration_hours": item["duration_hours"]},
            source_version=version,
        )

    for item in employees["employees"]:
        employee_id = item["employee_id"]
        owned = "; ".join(
            f"{skill_names.get(k, k)} ({k}) level {v}" for k, v in item["skills"].items()
        )
        goal = item.get("career_goal") or {}
        yield Document(
            namespace=NAMESPACE, source_id=f"employee:{employee_id}", kind="employee",
            title=f"Employee {employee_id}: {item['full_name']}",
            content=(f"Employee {item['full_name']} ({employee_id}). Role {item['role']}, grade {item['grade']}, "
                     f"department {item['department']}. Career goal: {goal.get('target_role', 'not set')} "
                     f"{goal.get('target_grade', '')}. Skills at last review: {owned}. "
                     f"Last review date {item['last_review_date']}."),
            metadata={"employee_id": employee_id, "department": item["department"],
                      "role": item["role"], "grade": item["grade"],
                      "manager_id": item.get("manager_id"), "career_goal": goal,
                      "last_review_date": item["last_review_date"], "preferred_language": item["preferred_language"]},
            source_version=version,
        )

    with (folder / "activity_history.csv").open(encoding="utf-8-sig", newline="") as stream:
        for item in csv.DictReader(stream):
            record_id = item["record_id"]
            event_title = event_names.get(item["event_id"], item["event_id"])
            yield Document(
                namespace=NAMESPACE, source_id=f"activity:{record_id}", kind="activity",
                title=f"Participation {record_id}: {event_title}",
                content=(f"Participation record {record_id}. Employee {item['employee_id']} in event "
                         f"{event_title} ({item['event_id']}). Status {item['status']}, "
                         f"completion {item['completion_pct']} percent. Date {item['date']}. "
                         f"Due date {item['due_date'] or 'none'}. Score {item['score'] or 'none'}. "
                         f"Feedback rating {item['feedback_rating'] or 'none'}. "
                         f"Assigned by {item['assigned_by']}."),
                metadata={**item, "event_title": event_title},
                source_version=version,
            )


def main():
    folder = Path(DATASET_DIR)
    initialize()
    seen: set[str] = set()
    changed = 0
    with connection() as conn:
        for index, doc in enumerate(documents(folder), 1):
            result = upsert(conn, doc)
            changed += int(result["changed"])
            seen.add(doc.source_id)
            if index % 200 == 0:
                print(f"Processed {index}, updated {changed}", flush=True)
        stale = conn.execute(
            "SELECT source_id FROM sources WHERE namespace=%s AND kind = ANY(%s::text[])",
            (NAMESPACE, ["skill", "role_profile", "event", "employee", "activity"]),
        ).fetchall()
        removed = 0
        for row in stale:
            if row["source_id"] not in seen:
                conn.execute("DELETE FROM sources WHERE namespace=%s AND source_id=%s", (NAMESPACE, row["source_id"]))
                removed += 1
    print(f"Done: {len(seen)} records, {changed} updated, {removed} removed", flush=True)


if __name__ == "__main__":
    main()
