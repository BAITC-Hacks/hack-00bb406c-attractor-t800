"""Explicit, revocable disclosure to the employee's current direct manager."""
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, StrictBool
from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column
from app.models import Base, Employee
from app.infrastructure.sql_profiles import SqlProfileRepository
from app.domain.trajectory import calculate_levels


class DevelopmentConsent(Base):
    __tablename__ = 'development_consents'
    employee_id: Mapped[str] = mapped_column(ForeignKey('employees.employee_id', ondelete='CASCADE'), primary_key=True)
    category: Mapped[str] = mapped_column(String, primary_key=True)
    manager_id: Mapped[str] = mapped_column(ForeignKey('employees.employee_id', ondelete='CASCADE'))
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


CATEGORIES = ('history', 'career_goal', 'skills')


class ConsentUpdate(BaseModel):
    enabled: StrictBool
    manager_id: str


def permissions(db, employee):
    rows = db.query(DevelopmentConsent).filter_by(employee_id=employee.employee_id, manager_id=employee.manager_id).all()
    return {category: any(row.category == category and row.enabled for row in rows) for category in CATEGORIES}


def router(get_db, current_session):
    routes = APIRouter(prefix='/api')

    def private_response(response: Response):
        response.headers['Cache-Control'] = 'no-store'

    def owner(actor, db):
        if actor.actor_role not in ('employee', 'manager') or not actor.employee_id:
            raise HTTPException(403, 'Доступно только сотруднику')
        return db.get(Employee, actor.employee_id)

    @routes.get('/me/development-consents', dependencies=[Depends(private_response)])
    def read(db=Depends(get_db), actor=Depends(current_session)):
        employee = owner(actor, db)
        manager = db.get(Employee, employee.manager_id) if employee.manager_id else None
        return {'manager_id': employee.manager_id, 'manager_name': manager.full_name if manager else None,
                'consents': permissions(db, employee)}

    @routes.post('/me/development-consents/{category}', dependencies=[Depends(private_response)])
    def update(category: Literal['history', 'career_goal', 'skills'], payload: ConsentUpdate,
               db=Depends(get_db), actor=Depends(current_session)):
        employee = owner(actor, db)
        if not employee.manager_id or employee.manager_id != payload.manager_id:
            raise HTTPException(409, 'Руководитель изменился. Обновите настройки согласий')
        row = db.get(DevelopmentConsent, (employee.employee_id, category))
        if row is None:
            row = DevelopmentConsent(employee_id=employee.employee_id, category=category)
            db.add(row)
        row.manager_id, row.enabled = employee.manager_id, payload.enabled
        db.commit()
        return read(db, actor)

    def disclosure(db, employee):
        allowed = permissions(db, employee)
        result = {'employee_id': employee.employee_id, 'full_name': employee.full_name, 'consents': allowed}
        # Never serialize a full employee profile or trajectory into this response.
        if any(allowed.values()):
            profile = SqlProfileRepository(db).get_profile(employee.employee_id)
            if allowed['career_goal']:
                result['career_goal'] = employee.career_goal
            if allowed['history']:
                result['history'] = [{key: row[key] for key in ('record_id', 'title', 'date', 'status', 'completion_pct')}
                                     for row in profile['history'] if not row['mandatory']]
            if allowed['skills']:
                levels, _ = calculate_levels(employee.skills, employee.last_review_date, profile['history'], profile['as_of_date'])
                result['skills'] = [{'skill_id': key, 'name': profile['skill_names'].get(key, key),
                                     'assessed_level': employee.skills.get(key, 0), 'calculated_level': value}
                                    for key, value in sorted(levels.items())]
        return result

    def manager(actor):
        if actor.actor_role != 'manager' or not actor.employee_id:
            raise HTTPException(403, 'Доступно только непосредственному руководителю')

    @routes.get('/manager/development', dependencies=[Depends(private_response)])
    def team(db=Depends(get_db), actor=Depends(current_session)):
        manager(actor)
        return [disclosure(db, employee) for employee in db.query(Employee).filter_by(manager_id=actor.employee_id).order_by(Employee.full_name)]

    @routes.get('/manager/employees/{employee_id}/development', dependencies=[Depends(private_response)])
    def person(employee_id: str, db=Depends(get_db), actor=Depends(current_session)):
        manager(actor)
        employee = db.get(Employee, employee_id)
        if employee is None or employee.manager_id != actor.employee_id:
            raise HTTPException(403, 'Сотрудник не является прямым подчинённым')
        return disclosure(db, employee)

    return routes
