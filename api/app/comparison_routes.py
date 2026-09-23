"""Closed comparison: fixed cohorts, no colleague rows or drill-down endpoints."""
from collections import defaultdict
from math import isfinite
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from app.application.work_scores import personal
from app.models import DemoSession, Employee, WorkPlan


def router(get_db, current_session):
    routes = APIRouter(prefix='/api')

    @routes.get('/comparisons')
    def read(request: Request, period: str = Query(pattern=r'^20\d{2}-Q[1-4]$'),
             db: Session = Depends(get_db), actor: DemoSession = Depends(current_session)):
        if actor.actor_role not in ('employee', 'manager', 'hr'):
            raise HTTPException(403, 'Нет доступа к сравнению')
        # Fixed cohorts prevent arbitrary filters and differencing attacks.
        if set(request.query_params) - {'period'}:
            raise HTTPException(422, 'Доступен только выбор квартала; персональные фильтры запрещены')
        people = db.query(Employee).join(WorkPlan, WorkPlan.employee_id == Employee.employee_id).filter(WorkPlan.period == period)
        owner = db.get(Employee, actor.employee_id) if actor.employee_id else None
        if actor.actor_role == 'employee':
            if owner is None:
                raise HTTPException(403, 'Нет профиля сотрудника')
            people = people.filter(Employee.role == owner.role, Employee.grade == owner.grade)
        elif actor.actor_role == 'manager':
            people = people.filter(Employee.manager_id == actor.employee_id)
        groups = defaultdict(list)
        for employee in people:
            score = next((p['otk'] for p in personal(db, employee.employee_id) if p['period'] == period), None)
            if score is not None and isfinite(score):
                groups[(employee.role, employee.grade)].append((employee.employee_id, score))
        output = []
        for (role, grade), rows in sorted(groups.items()):
            item = {'role': role, 'grade': grade, 'period': period, 'metric': 'otk', 'unit': 'баллы',
                    'hidden': True, 'reason': 'Недостаточно данных для безопасного сравнения'}
            if len(rows) >= 5:
                if actor.actor_role == 'employee':
                    own = next((value for identity, value in rows if identity == actor.employee_id), None)
                    if own is not None:
                        item.update(hidden=False, reason=None, count=len(rows), rank={
                            'from': 1 + sum(value > own for _, value in rows),
                            'to': sum(value >= own for _, value in rows)})
                else:
                    bins = [sum(value < 80 for _, value in rows),
                            sum(80 <= value < 100 for _, value in rows),
                            sum(value >= 100 for _, value in rows)]
                    # Suppress the entire distribution, including totals, if any
                    # nonempty bucket is small: totals cannot reveal a hidden cell.
                    if all(count == 0 or count >= 5 for count in bins):
                        item.update(hidden=False, reason=None, count=len(rows), distribution=[
                            {'range': label, 'count': count} for label, count in zip(('ниже 80', '80–99,99', '100 и выше'), bins)])
            output.append(item)
        return {'scope': {'employee': 'Собственная роль и грейд', 'manager': 'Прямые подчинённые', 'hr': 'Компания'}[actor.actor_role],
                'description': 'Предварительный ОТК по демонстрационным правилам. Только сотрудники с рассчитанным ОТК за выбранный квартал. Фильтрация до персональной строки недоступна.',
                'groups': output}

    return routes
