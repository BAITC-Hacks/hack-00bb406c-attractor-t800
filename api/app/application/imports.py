"""Additive jury dataset; provenance lives in the existing dataset-state journal."""
import csv
import hashlib
import hmac
import io
import json
from datetime import date, datetime, timezone
from typing import Annotated, Literal
from uuid import uuid4

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from sqlalchemy import or_, text
from app.config import SESSION_SECRET
from app.models import ActivityHistory, DatasetState, DemoClock, DemoSession, Employee, Event, RoleProfile, Skill

IntLevel = Annotated[int, Field(strict=True, ge=0, le=5)]
Nonempty = Annotated[str, Field(min_length=1)]
PREFIX = 'jury_import:'

class Schema(BaseModel):
    model_config = ConfigDict(extra='forbid')

class Goal(Schema):
    target_role: Nonempty
    target_grade: Nonempty

class Person(Schema):
    employee_id: Nonempty
    full_name: Nonempty
    department: Nonempty
    role: Nonempty
    grade: Nonempty
    manager_id: Nonempty | None
    hire_date: date
    tenure_months: Annotated[int, Field(strict=True, ge=0)]
    work_format: Literal['office', 'hybrid', 'remote']
    preferred_language: Literal['kk', 'ru', 'en']
    career_goal: Goal | None
    skills: dict[str, IntLevel]
    last_review_date: date

class History(Schema):
    record_id: Nonempty
    employee_id: Nonempty
    event_id: Nonempty
    date: date
    due_date: date | None
    status: Literal['planned', 'in_progress', 'completed', 'no_show', 'declined', 'dropped', 'overdue']
    completion_pct: Annotated[int, Field(strict=True, ge=0, le=100)]
    score: Annotated[int, Field(strict=True, ge=0, le=100)] | None
    feedback_rating: Annotated[int, Field(strict=True, ge=1, le=5)] | None
    assigned_by: Literal['self', 'manager', 'hr']

class Upload(Schema):
    employees_json: str | None = Field(default=None, max_length=5_000_000)
    activity_history_csv: str | None = Field(default=None, max_length=5_000_000)
    confirmation: str | None = None


def canonical(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(',', ':'), default=str)


def lock(db):
    # Serialize previews/applications/resets across API workers. Mutations to
    # existing history are rechecked at application time, never overwritten.
    if db.bind.dialect.name == 'postgresql':
        db.execute(text('LOCK TABLE employees, activity_history, dataset_state IN SHARE ROW EXCLUSIVE MODE'))


def prepare(db, upload):
    errors, people, history = [], {}, {}
    unchanged = 0
    affected = set()
    def error(file, row, field, message):
        errors.append(dict(file=file, row=row, field=field, message=message))
    def parse(schema, raw, file, row):
        try:
            return schema.model_validate(raw).model_dump()
        except ValidationError as exc:
            for item in exc.errors():
                error(file, row, '.'.join(map(str, item['loc'])), item['msg'])
    if upload.employees_json is None and upload.activity_history_csv is None:
        error('upload', 0, 'files', 'Выберите хотя бы один файл')
    employee_rows = []
    if upload.employees_json is not None:
        try:
            document = json.loads(upload.employees_json)
            if not isinstance(document, dict) or set(document) != {'meta', 'employees'}:
                raise ValueError('Ожидается объект meta/employees')
            if document['meta'] != dict(dataset='Career Quest', version='1.0', as_of_date='2026-10-01'):
                error('employees.json', 1, 'meta', 'Ожидается Career Quest / 1.0 / 2026-10-01')
            if not isinstance(document['employees'], list):
                raise ValueError('employees должен быть массивом')
            employee_rows = document['employees']
        except (ValueError, TypeError) as exc:
            error('employees.json', 1, 'schema', str(exc))
    history_rows = []
    if upload.activity_history_csv is not None:
        try:
            reader = csv.DictReader(io.StringIO(upload.activity_history_csv.lstrip('\ufeff')), strict=True)
            if reader.fieldnames is None or len(reader.fieldnames) != len(History.model_fields) or set(reader.fieldnames) != set(History.model_fields):
                raise ValueError('Заголовок должен содержать ровно поля официальной CSV-схемы')
            for row in reader:
                line = reader.line_num
                if None in row or None in row.values():
                    error('activity_history.csv', line, 'schema', 'Неверное количество столбцов')
                    continue
                for field in ('completion_pct', 'score', 'feedback_rating'):
                    try:
                        row[field] = int(row[field]) if row[field] else None
                    except ValueError:
                        pass
                row['due_date'] = row['due_date'] or None
                history_rows.append((line, row))
        except (ValueError, csv.Error) as exc:
            error('activity_history.csv', 1, 'schema', str(exc))
    existing_people = {p.employee_id: p for p in db.query(Employee)}
    existing_history = {h.record_id: h for h in db.query(ActivityHistory)}
    locations = {}
    for schema, rows, dest, existing, file, key in (
        (Person, enumerate(employee_rows, 1), people, existing_people, 'employees.json', 'employee_id'),
        (History, history_rows, history, existing_history, 'activity_history.csv', 'record_id'),
    ):
        seen = {}
        for line, raw in rows:
            row = parse(schema, raw, file, line)
            if row is None:
                continue
            identity = row[key]
            locations[(file, identity)] = line
            previous = seen.get(identity)
            if previous is None and identity in existing:
                previous = {f: getattr(existing[identity], f) for f in schema.model_fields}
            if previous is not None:
                if canonical(previous) != canonical(row):
                    error(file, line, key, f'Конфликт существующего ключа {identity}')
                else:
                    unchanged += 1
            else:
                dest[identity] = row
            seen[identity] = row
            affected.add(identity if schema is Person else row['employee_id'])
    roles = {(r.role, r.grade) for r in db.query(RoleProfile)}
    skills = {s.skill_id for s in db.query(Skill)}
    all_people = {k: {f: getattr(p, f) for f in Person.model_fields} for k, p in existing_people.items()} | people
    today = db.get(DemoClock, 1).as_of_date
    for identity, row in people.items():
        def bad(field, message):
            error('employees.json', locations[('employees.json', identity)], field, message)
        if (row['role'], row['grade']) not in roles:
            bad('role', 'Неизвестная пара роли и грейда')
        goal = row['career_goal']
        if goal and (goal['target_role'], goal['target_grade']) not in roles:
            bad('career_goal', 'Неизвестная целевая роль/грейд')
        for skill in row['skills'].keys() - skills:
            bad(f'skills.{skill}', 'Неизвестный навык')
        if not row['hire_date'] <= row['last_review_date'] <= today:
            bad('last_review_date', 'Оценка должна быть между наймом и датой среза')
        manager = all_people.get(row['manager_id'])
        if row['manager_id'] and (not manager or manager['grade'] != 'Lead' or manager['department'] != row['department']):
            bad('manager_id', 'Нужен существующий Lead того же подразделения')
        visited, current = {identity}, row['manager_id']
        while current and current in all_people:
            if current in visited:
                bad('manager_id', 'Цикл руководителей')
                break
            visited.add(current)
            current = all_people[current]['manager_id']
    events = {e.event_id for e in db.query(Event)}
    completed = {(h.employee_id, h.event_id) for h in existing_history.values() if h.status == 'completed'}
    for identity, row in history.items():
        def bad(field, message):
            error('activity_history.csv', locations[('activity_history.csv', identity)], field, message)
        person = all_people.get(row['employee_id'])
        if not person:
            bad('employee_id', 'Неизвестный сотрудник')
        elif not person['hire_date'] <= row['date'] <= today:
            bad('date', 'Дата участия должна быть между наймом и датой среза')
        if row['event_id'] not in events:
            bad('event_id', 'Неизвестная активность')
        if row['due_date'] and row['due_date'] < row['date']:
            bad('due_date', 'Срок раньше даты участия')
        if row['status'] == 'completed' and row['completion_pct'] != 100:
            bad('completion_pct', 'Для completed требуется 100')
        if row['status'] != 'completed' and row['completion_pct'] == 100:
            bad('completion_pct', '100 допустимо только для completed')
        pair = (row['employee_id'], row['event_id'])
        if row['status'] == 'completed':
            if pair in completed and row['event_id'] not in {'EV_001', 'EV_002', 'EV_003', 'EV_036'}:
                bad('status', 'Активность уже завершена')
            completed.add(pair)
    report = dict(new_profiles=len(people), new_history=len(history), unchanged=unchanged,
                  affected_employees=sorted(affected), errors=errors)
    digest = hashlib.sha256(canonical([upload.employees_json, upload.activity_history_csv]).encode()).hexdigest()
    # A signed preview binds confirmation to both files and the current result.
    signature = hmac.new(SESSION_SECRET.encode(), canonical([digest, report]).encode(), hashlib.sha256).hexdigest()
    return report | dict(hash=digest, confirmation=signature if not errors else None), people, history


def apply(db, upload):
    lock(db)
    report, people, history = prepare(db, upload)
    if report['errors']:
        raise HTTPException(422, report)
    if not upload.confirmation or not hmac.compare_digest(upload.confirmation, report['confirmation']):
        raise HTTPException(409, 'Сначала выполните предпросмотр и подтвердите актуальный результат')
    for row in people.values():
        db.add(Employee(**(row | {'manager_id': None})))
    db.flush()
    for identity, row in people.items():
        db.get(Employee, identity).manager_id = row['manager_id']
    db.flush()
    db.add_all(ActivityHistory(**row) for row in history.values())
    batch_id = str(uuid4())
    db.add(DatasetState(key=PREFIX + batch_id, value=canonical(dict(
        batch_id=batch_id, hash=report['hash'], created_at=datetime.now(timezone.utc),
        employees=list(people), history=list(history)))))
    db.commit()
    return report | dict(batch_id=batch_id)


def reset(db):
    lock(db)
    batches = db.query(DatasetState).filter(DatasetState.key.startswith(PREFIX)).all()
    people, history = set(), set()
    for batch in batches:
        data = json.loads(batch.value)
        people.update(data['employees'])
        history.update(data['history'])
    history_count = db.query(ActivityHistory).filter(or_(ActivityHistory.record_id.in_(history), ActivityHistory.employee_id.in_(people))).delete(synchronize_session=False)
    db.query(DemoSession).filter(DemoSession.employee_id.in_(people)).delete(synchronize_session=False)
    # Remove dependent rows for imported people only; preserve official demo work.
    from app.models import Base
    for table in reversed(Base.metadata.sorted_tables):
        if table.name in {'employees', 'activity_history', 'demo_sessions'}:
            continue
        employee_refs = [table.c[fk.parent.name] for fk in table.foreign_keys if fk.target_fullname == 'employees.employee_id']
        if employee_refs:
            db.execute(table.delete().where(or_(*(col.in_(people) for col in employee_refs))))
    db.query(Employee).filter(Employee.employee_id.in_(people)).update({'manager_id': None}, synchronize_session=False)
    count = db.query(Employee).filter(Employee.employee_id.in_(people)).delete(synchronize_session=False)
    for batch in batches:
        db.delete(batch)
    db.commit()
    return dict(deleted_profiles=count, deleted_history=history_count, deleted_batches=len(batches))
