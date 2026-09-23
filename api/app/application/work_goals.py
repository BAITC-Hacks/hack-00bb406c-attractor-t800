"""Quarterly proposals and atomic, immutable approval of a complete J plan."""
import calendar
from datetime import date, datetime, time, timezone
from uuid import uuid4
from fastapi import HTTPException
from pydantic import BaseModel, Field, ConfigDict, model_validator
from app.models import DemoClock, Employee, WorkGoal, WorkPlan

RULES = {'version': 'demo-j-v1', 'effective_from': '2026-10-01',
         'description': 'Демонстрационные правила, не методика Halyk',
         'weight_total': 100, 'achievement_cap_pct': 150, 'confirmed_results_only': True}


def bounds(period):
    year, quarter = int(period[:4]), int(period[-1])
    month = quarter * 3
    return date(year, month - 2, 1), date(year, month, calendar.monthrange(year, month)[1])


class Proposal(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra='forbid')
    period: str = Field(pattern=r'^20\d{2}-Q[1-4]$')
    title: str = Field(min_length=1, max_length=200)
    due_date: date
    unit: str = Field(min_length=1, max_length=50)
    target: float = Field(gt=0, allow_inf_nan=False)
    task_id: str = Field(pattern=r'^DEMO-[A-Z0-9-]{1,60}$')

    @model_validator(mode='after')
    def within_period(self):
        start, end = bounds(self.period)
        if not start <= self.due_date <= end:
            raise ValueError('Срок должен находиться в выбранном квартале')
        return self


class Weight(BaseModel):
    goal_id: str
    weight: int = Field(strict=True, gt=0, le=100)


class Approval(BaseModel):
    goals: list[Weight] = Field(min_length=1, max_length=100)

    @model_validator(mode='after')
    def total(self):
        if sum(g.weight for g in self.goals) != 100 or len({g.goal_id for g in self.goals}) != len(self.goals):
            raise ValueError('Уникальные цели должны иметь суммарный вес 100%')
        return self


def goal_data(goal):
    return {key: getattr(goal, key) for key in ('id', 'period', 'title', 'unit', 'target', 'task_id', 'status')} | {'due_date': goal.due_date.isoformat(), 'proposed_at': goal.proposed_at.isoformat()}


def read(db, employee_id):
    goals = db.query(WorkGoal).filter_by(employee_id=employee_id).order_by(WorkGoal.period, WorkGoal.id).all()
    plans = db.query(WorkPlan).filter_by(employee_id=employee_id).order_by(WorkPlan.period).all()
    return {'employee_id': employee_id, 'as_of_date': db.get(DemoClock, 1).as_of_date,
            'proposals': [goal_data(g) | {'included_in_j': False} for g in goals if g.status == 'proposed'],
            'plans': [{'period': p.period, 'version': p.version, 'approved_by': p.approved_by, 'approved_at': p.approved_at,
                       'recorded_at': p.recorded_at, 'rules': p.rules, 'goals': p.goals} for p in plans]}


def propose(db, employee_id, payload):
    db.query(Employee).filter_by(employee_id=employee_id).with_for_update().one()
    if db.get(DemoClock, 1).as_of_date >= bounds(payload.period)[0]:
        raise HTTPException(409, 'Цели согласуются до начала квартала')
    if db.get(WorkPlan, (employee_id, payload.period)):
        raise HTTPException(409, 'План этого квартала уже утверждён')
    goal = WorkGoal(id=str(uuid4()), employee_id=employee_id, **payload.model_dump(),
                    status='proposed', proposed_at=datetime.now(timezone.utc))
    db.add(goal)
    db.commit()
    return goal_data(goal)


def approve(db, actor, employee_id, period, payload):
    employee = db.query(Employee).filter_by(employee_id=employee_id).with_for_update().first()
    if actor.actor_role != 'manager' or not employee or employee.manager_id != actor.employee_id or employee_id == actor.employee_id:
        raise HTTPException(403, 'Только непосредственный руководитель утверждает план')
    if db.get(DemoClock, 1).as_of_date >= bounds(period)[0]:
        raise HTTPException(409, 'Утверждение доступно только до начала квартала')
    if db.get(WorkPlan, (employee_id, period)):
        raise HTTPException(409, 'Утверждённый план неизменяем')
    goals = db.query(WorkGoal).filter_by(employee_id=employee_id, period=period, status='proposed').all()
    selected = {g.id: g for g in goals}
    if any(w.goal_id not in selected for w in payload.goals):
        raise HTTPException(422, 'Все цели должны принадлежать сотруднику и кварталу')
    snapshots = []
    for item in payload.goals:
        goal = selected[item.goal_id]
        goal.status = 'approved'
        snapshots.append(goal_data(goal) | {'weight': item.weight, 'included_in_j': True, 'confirmed_actual': 0})
    db.add(WorkPlan(employee_id=employee_id, period=period, version=1, approved_by=actor.employee_id,
                    approved_at=datetime.combine(db.get(DemoClock, 1).as_of_date, time.min, timezone.utc),
                    recorded_at=datetime.now(timezone.utc), goals=snapshots, rules=RULES))
    db.commit()
    return read(db, employee_id)


def seed_work_plan(db):
    if db.get(WorkPlan, ('E0174', '2026-Q4')):
        return
    approved = datetime(2026, 9, 30, tzinfo=timezone.utc)
    goals = []
    for goal_id, title, unit, target, weight, actual, deadline in [
        ('DEMO-GOAL-CONTRACTS', '2 договора за октябрь', 'договор', 2, 40, 0, date(2026, 10, 31)),
        ('DEMO-GOAL-SALES', 'Остальные рабочие цели Sales', 'план', 1, 60, 1, date(2026, 12, 31)),
    ]:
        goal = WorkGoal(id=goal_id, employee_id='E0174', period='2026-Q4', title=title, due_date=deadline,
                        unit=unit, target=target, task_id=goal_id, status='approved', proposed_at=approved)
        db.add(goal)
        goals.append(goal_data(goal) | {'weight': weight, 'included_in_j': True, 'confirmed_actual': actual, 'source': 'synthetic_demo'})
    db.add(WorkPlan(employee_id='E0174', period='2026-Q4', version=1, approved_by='E0169',
                    approved_at=approved, recorded_at=datetime.now(timezone.utc), goals=goals, rules=RULES))
    db.commit()
