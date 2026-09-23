"""Versioned evidence packages and unique, confirmed contributions."""
from datetime import datetime, timezone
from uuid import uuid4
from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy.exc import IntegrityError
from app.models import Employee, WorkGoal, WorkPlan, WorkResult, ConfirmedRecord

ANALYSTS = ('analyst', 'analyst_backup')

class Evidence(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra='forbid')
    record_id: str = Field(min_length=1, max_length=100, pattern=r'^[A-Za-z0-9_-]+$')
    description: str = Field(min_length=1, max_length=4000)
    amount: float = Field(default=1, gt=0, allow_inf_nan=False)

class Draft(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra='forbid')
    claimed_actual: float = Field(gt=0, allow_inf_nan=False)
    evidence: list[Evidence] = Field(default_factory=list, max_length=200)

    @model_validator(mode='after')
    def unique_records(self):
        if len({e.record_id.upper() for e in self.evidence}) != len(self.evidence):
            raise ValueError('ID доказательств должны быть уникальны')
        return self

class Create(Draft):
    goal_id: str

class ReturnReason(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra='forbid')
    reason: str = Field(min_length=1, max_length=2000)


def snapshot(row, action, actor, reason=None):
    row.history = [*row.history, {'action': action, 'actor': actor, 'reason': reason,
        'at': datetime.now(timezone.utc).isoformat(), 'version': row.version,
        'claimed_actual': row.claimed_actual, 'evidence': row.evidence}]


def data(db, row):
    employee = db.get(Employee, row.employee_id)
    goal = db.get(WorkGoal, row.goal_id)
    return {key: getattr(row, key) for key in ('id', 'goal_id', 'employee_id', 'assigned_to', 'status', 'version', 'claimed_actual', 'evidence', 'history', 'rules')} | {
        'author': {'full_name': employee.full_name, 'department': employee.department},
        'goal': {'title': goal.title, 'period': goal.period, 'target': goal.target, 'unit': goal.unit, 'task_id': goal.task_id},
        'confirmed_actual': sum(r.amount for r in db.query(ConfirmedRecord).filter_by(result_id=row.id)) if row.status == 'confirmed' else 0}


def accessible(db, actor, result_id, lock=False):
    query = db.query(WorkResult).filter_by(id=result_id)
    row = (query.with_for_update() if lock else query).first()
    if not row or not ((actor.actor_role in ('employee', 'manager') and row.employee_id == actor.employee_id)
                       or (actor.actor_role in ANALYSTS and row.assigned_to == actor.actor_role and row.employee_id != actor.employee_id)):
        raise HTTPException(404, 'Результат недоступен')
    return row


def listing(db, actor):
    query = db.query(WorkResult)
    if actor.actor_role in ANALYSTS:
        query = query.filter_by(assigned_to=actor.actor_role)
        if actor.employee_id:
            query = query.filter(WorkResult.employee_id != actor.employee_id)
    elif actor.actor_role in ('employee', 'manager'):
        query = query.filter_by(employee_id=actor.employee_id)
    else:
        raise HTTPException(403, 'Нет доступа к результатам')
    return [data(db, row) for row in query.order_by(WorkResult.id)]


def create(db, actor, payload):
    if actor.actor_role not in ('employee', 'manager'):
        raise HTTPException(403, 'Только сотрудник подаёт свой результат')
    goal = db.get(WorkGoal, payload.goal_id)
    if not goal or goal.employee_id != actor.employee_id or goal.status != 'approved':
        raise HTTPException(422, 'Выберите собственную утверждённую цель')
    row = WorkResult(id=str(uuid4()), employee_id=actor.employee_id, goal_id=goal.id,
                     assigned_to='analyst', status='draft', version=1, history=[], rules=None,
                     claimed_actual=payload.claimed_actual, evidence=[e.model_dump() | {'record_id': e.record_id.upper()} for e in payload.evidence])
    snapshot(row, 'created', actor.employee_id)
    db.add(row)
    db.commit()
    return data(db, row)


def change(db, actor, result_id, action, payload=None):
    row = accessible(db, actor, result_id, lock=True)
    if action in ('edit', 'submit'):
        if actor.actor_role not in ('employee', 'manager') or row.employee_id != actor.employee_id:
            raise HTTPException(403, 'Только автор меняет и подаёт результат')
        if row.status not in ('draft', 'returned'):
            raise HTTPException(409, 'Проверяемая версия неизменна')
        if action == 'edit':
            row.version += 1
            row.claimed_actual = payload.claimed_actual
            row.evidence = [e.model_dump() | {'record_id': e.record_id.upper()} for e in payload.evidence]
        else:
            if not row.evidence:
                raise HTTPException(422, 'Добавьте доказательства')
            row.status = 'submitted'
    else:
        if actor.actor_role not in ANALYSTS or row.assigned_to != actor.actor_role or row.employee_id == actor.employee_id:
            raise HTTPException(403, 'Проверка доступна только назначенному аналитику')
        if action == 'confirm' and row.status == 'confirmed':
            return data(db, row)
        if row.status != 'submitted':
            raise HTTPException(409, 'Результат не находится на проверке')
        if action == 'return':
            row.status = 'returned'
        else:
            from math import isclose
            goal = db.get(WorkGoal, row.goal_id)
            if goal.unit == 'договор' and any(e['amount'] != 1 for e in row.evidence):
                raise HTTPException(422, 'Каждый ID договора подтверждает ровно один договор')
            if not isclose(sum(e['amount'] for e in row.evidence), row.claimed_actual, rel_tol=1e-9):
                raise HTTPException(422, f"Заявлено {row.claimed_actual:g}, доказано {sum(e['amount'] for e in row.evidence):g}. Верните результат с причиной")
            row.status = 'confirmed'
            plan = db.get(WorkPlan, (row.employee_id, goal.period))
            row.rules = {'plan_version': plan.version, 'rules': plan.rules}
            for evidence in row.evidence:
                db.add(ConfirmedRecord(record_id=evidence['record_id'], result_id=row.id,
                                       employee_id=row.employee_id, goal_id=row.goal_id, amount=evidence['amount']))
    snapshot(row, action, actor.employee_id or actor.actor_role, payload.reason if action == 'return' else None)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, 'Один из ID уже учтён в подтверждённом результате') from exc
    return data(db, row)
