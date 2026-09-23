"""Pure, reproducible learning calculations; never mutate the last assessment."""
from datetime import date

GRADES = ("Junior", "Middle", "Senior", "Lead")
# Official kit / issue #6: the public-speaking club is the only repeatable voluntary event.
REPEATABLE_EVENTS = frozenset({"EV_036"})


def target_profile(employee, profiles):
    goal = employee.get("career_goal")
    role, grade = employee["role"], employee["grade"]
    kind = "goal" if goal else "current"
    if goal:
        role, grade = goal["target_role"], goal["target_grade"]
    elif grade in GRADES and grade != GRADES[-1]:
        grade = GRADES[GRADES.index(grade) + 1]
        kind = "provisional"
    profile = next((p for p in profiles if (p["role"], p["grade"]) == (role, grade)), None)
    return {"role": role, "grade": grade, "kind": kind, "profile_available": profile is not None}, profile


def day(value):
    return date.fromisoformat(str(value)[:10])


def apply_gain(current, gain, max_level):
    return max(current, min(5, current + gain, max_level))


def calculate_levels(assessed, review_date, history, as_of_date):
    levels = dict(assessed)
    sources, seen_records, seen_events = [], set(), set()
    for row in sorted(history, key=lambda r: (str(r.get("completed_at") or r["date"]), r["record_id"])):
        if row["record_id"] in seen_records:
            continue
        seen_records.add(row["record_id"])
        source = {"record_id": row["record_id"], "event_id": row["event_id"], "title": row["title"], "date": row["date"], "changes": []}
        when = day(row.get("completed_at") or row["date"])
        if row["status"] != "completed":
            reason = "Не завершено — прирост не начислен"
        elif when > day(as_of_date):
            reason = "После даты среза — прирост не начислен"
        else:
            duplicate = row["event_id"] in seen_events and not row["mandatory"] and row["event_id"] not in REPEATABLE_EVENTS
            seen_events.add(row["event_id"])
            if duplicate:
                reason = "Конфликт: повтор неповторяемой активности"
            elif when <= day(review_date):
                reason = "Дата завершения неизвестна: self-paced зачисление не позже оценки" if row["format"] == "self_paced" and not row.get("completed_at") else "На дату оценки или раньше — уже учтено в опорной оценке"
            else:
                reason = "Учтено после оценки"
                if row["format"] == "self_paced" and not row.get("completed_at"):
                    reason += "; порядок по зачислению, точная дата завершения неизвестна"
                for rule in row["develops_skills"]:
                    skill = rule["skill_id"]
                    before = levels.get(skill, 0)
                    after = apply_gain(before, rule["gain"], rule["max_level"])
                    levels[skill] = after
                    source["changes"].append({"skill_id": skill, "before": before, "after": after, "gain": rule["gain"], "max_level": rule["max_level"]})
                if not row["develops_skills"]:
                    reason = "Активность не содержит правил прироста"
        sources.append({**source, "reason": reason})
    return levels, sources


def build_trajectory(employee, assessed, profiles, history, names, as_of_date):
    target, profile = target_profile(employee, profiles)
    levels, sources = calculate_levels(assessed, employee["last_review_date"], history, as_of_date)
    required = profile["required_skills"] if profile else {}
    critical = profile["critical_skills"] if profile else []
    skills = [{"skill_id": key, "name": names.get(key, key), "assessed_level": assessed.get(key, 0), "calculated_level": levels.get(key, 0), "required_level": required.get(key), "critical": key in critical, "gap": max(0, required.get(key, 0) - levels.get(key, 0))} for key in sorted(set(levels) | set(required), key=lambda k: (k not in required, names.get(k, k)))]
    return {"target": target, "skills": skills, "sources": sources, "requirements_met": all(s["gap"] == 0 for s in skills) if profile else None, "critical_gaps": [s["skill_id"] for s in skills if s["critical"] and s["gap"] > 0]}
