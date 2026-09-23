from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.application import work_scores as service
from app.application.work_results import ReturnReason
from app.models import DemoSession, Employee, ConfirmedRecord, WorkGoal, WorkPlan


def router(get_db, current_session):
    routes = APIRouter(prefix='/api')

    @routes.get('/work-scores')
    def read(db: Session = Depends(get_db), actor: DemoSession = Depends(current_session)):
        if actor.actor_role in ('employee', 'manager'):
            return {'personal': service.personal(db, actor.employee_id),
                    'team': service.team_summary(db, actor.employee_id) if actor.actor_role == 'manager' else []}
        if actor.actor_role == 'hr':
            count = db.query(Employee).count()
            rows = db.query(WorkGoal.period, ConfirmedRecord.amount).join(ConfirmedRecord, ConfirmedRecord.goal_id == WorkGoal.id).filter(WorkGoal.unit == 'договор').all()
            periods = {}
            baselines = {}
            for plan in db.query(WorkPlan):
                for period, ids in plan.rules.get('team_baselines', {}).items():
                    baselines.setdefault(period, set()).update(ids)
            periods.update({period: len(ids) for period, ids in baselines.items()})
            for period, amount in rows:
                periods[period] = periods.get(period, 0) + amount
            return {'aggregate': [{'period': p, 'unit': 'договор', 'actual': n if count >= 5 else None} for p, n in sorted(periods.items())],
                    'description': 'Подтверждённые договоры сотрудников; без CRM и личного ОТК'}
        raise HTTPException(403, 'Нет доступа к оценкам')

    @routes.post('/work-results/{result_id}/records/{record_id}/cancel')
    def cancel(result_id: str, record_id: str, payload: ReturnReason,
               db: Session = Depends(get_db), actor: DemoSession = Depends(current_session)):
        return service.cancel(db, actor, result_id, record_id, payload.reason)

    return routes
